"""REST API connector — ingest from any HTTP API endpoint."""
from __future__ import annotations

import base64
import json
import logging
import re
from typing import Any

from ..base import BaseDatasetAdapter, DatasetMeta, EntityTypeConfig

logger = logging.getLogger(__name__)


def _singularize(name: str) -> str:
    if not name:
        return name
    lower = name.lower()
    if lower.endswith("ies") and len(lower) > 3:
        return name[:-3] + "y"
    if lower.endswith("s") and not lower.endswith("ss"):
        return name[:-1]
    return name


def _extract_jsonpath(data: Any, path: str) -> list[dict]:
    """Minimal JSONPath-like extraction.

    Supports:
    - ``$`` or ``$[*]`` — root array
    - ``$.key`` — single key access
    - ``$.key[*]`` — array under key
    - ``$.key1.key2[*]`` — nested key then array

    Returns a list of dicts.
    """
    # Strip leading $
    path = path.lstrip("$").lstrip(".")

    if not path or path == "[*]":
        if isinstance(data, list):
            return [d for d in data if isinstance(d, dict)]
        if isinstance(data, dict):
            return [data]
        return []

    # Walk dot-separated path
    parts = re.split(r"\.\[|\]\.", path)
    # Simpler split: by dots, handling [*]
    segments = []
    for part in path.replace("[*]", "").split("."):
        part = part.strip()
        if part:
            segments.append(part)

    current: Any = data
    for seg in segments:
        if isinstance(current, dict) and seg in current:
            current = current[seg]
        elif isinstance(current, list):
            # Try to descend into list items
            results = []
            for item in current:
                if isinstance(item, dict) and seg in item:
                    results.append(item[seg])
            current = results
            # Flatten nested lists
            if current and isinstance(current[0], list):
                current = [item for sublist in current for item in sublist]
        else:
            return []

    if isinstance(current, list):
        return [d for d in current if isinstance(d, dict)]
    if isinstance(current, dict):
        return [current]
    return []


class APIConnector(BaseDatasetAdapter):
    """Connect to any REST API and ingest responses as entities.

    Supports:
    - Paginated APIs (offset, cursor, link-header)
    - Authenticated APIs (Bearer, API key, Basic)
    - Nested response structures (JSONPath extraction)

    Requires ``httpx``. Install with: ``pip install httpx``

    Usage::

        connector = APIConnector(
            url="https://api.example.com/v1/entities",
            headers={"Authorization": "Bearer ..."},
            pagination="offset",
            entity_path="$.data[*]",
        )
    """

    def __init__(
        self,
        url: str,
        headers: dict | None = None,
        method: str = "GET",
        body: dict | None = None,
        pagination: str | None = None,
        page_size: int = 100,
        entity_path: str = "$[*]",
        entity_type: str | None = None,
        name_field: str | None = None,
        auth_type: str | None = None,
        auth_value: str | None = None,
        max_pages: int = 100,
        timeout: float = 30.0,
    ) -> None:
        try:
            import httpx  # noqa: F401
            self._httpx = httpx
        except ImportError:
            raise ImportError(
                "httpx is required for API connector. "
                "Install with: pip install httpx"
            )

        self._url = url
        self._method = method.upper()
        self._body = body
        self._pagination = pagination
        self._page_size = page_size
        self._entity_path = entity_path
        self._name_field = name_field
        self._max_pages = max_pages
        self._timeout = timeout

        # Derive entity type from URL path
        if entity_type:
            self._entity_type = entity_type
        else:
            # Try to extract from URL path: /v1/users -> user
            path_parts = [p for p in url.rstrip("/").split("/") if p and not p.startswith("v")]
            self._entity_type = _singularize(path_parts[-1]) if path_parts else "record"

        # Build headers with auth
        self._headers = dict(headers or {})
        self._headers.setdefault("Accept", "application/json")
        self._apply_auth(auth_type, auth_value)

        # Will be populated on first fetch
        self._all_keys: set[str] = set()
        self._fetched_records: list[dict] | None = None

    def _apply_auth(self, auth_type: str | None, auth_value: str | None) -> None:
        if not auth_type or not auth_value:
            return
        auth_type = auth_type.lower()
        if auth_type == "bearer":
            self._headers["Authorization"] = f"Bearer {auth_value}"
        elif auth_type == "api_key":
            # Common patterns: X-API-Key header or ?api_key= param
            self._headers["X-API-Key"] = auth_value
        elif auth_type == "basic":
            # auth_value should be "username:password"
            encoded = base64.b64encode(auth_value.encode()).decode()
            self._headers["Authorization"] = f"Basic {encoded}"

    # ------------------------------------------------------------------ #
    #  Fetching with pagination
    # ------------------------------------------------------------------ #

    def _fetch_all(self, limit: int) -> list[dict]:
        """Fetch records from the API, handling pagination."""
        if self._fetched_records is not None:
            return self._fetched_records[:limit]

        client = self._httpx.Client(timeout=self._timeout, follow_redirects=True)
        all_records: list[dict] = []
        url = self._url
        page = 0

        try:
            while url and page < self._max_pages and len(all_records) < limit:
                params = self._build_page_params(page)

                if self._method == "GET":
                    response = client.get(url, headers=self._headers, params=params)
                else:
                    response = client.request(
                        self._method, url, headers=self._headers,
                        params=params, json=self._body,
                    )

                response.raise_for_status()
                data = response.json()

                # Extract records using JSONPath
                records = _extract_jsonpath(data, self._entity_path)
                if not records:
                    break

                all_records.extend(records)
                page += 1

                # Handle pagination
                url = self._get_next_url(response, data, url, page)
                if url is None:
                    break

        except Exception as e:
            logger.error("API fetch error: %s", e)
            if not all_records:
                raise
        finally:
            client.close()

        self._fetched_records = all_records

        # Collect keys
        for rec in all_records:
            self._all_keys.update(rec.keys())

        if self._name_field is None:
            self._name_field = self._pick_name_field()

        logger.info("Fetched %d records from API", len(all_records))
        return all_records[:limit]

    def _build_page_params(self, page: int) -> dict:
        """Build query parameters for the current page."""
        if self._pagination == "offset":
            return {"offset": page * self._page_size, "limit": self._page_size}
        elif self._pagination == "cursor":
            # Cursor is handled via _get_next_url
            return {"limit": self._page_size} if page == 0 else {}
        return {}

    def _get_next_url(
        self,
        response: Any,
        data: Any,
        current_url: str,
        page: int,
    ) -> str | None:
        """Determine the next page URL based on pagination strategy."""
        if self._pagination is None:
            return None

        if self._pagination == "link":
            # RFC 8288 Link header
            link_header = response.headers.get("Link", "")
            match = re.search(r'<([^>]+)>;\s*rel="next"', link_header)
            return match.group(1) if match else None

        if self._pagination == "cursor":
            # Look for cursor in response
            if isinstance(data, dict):
                for key in ("next_cursor", "cursor", "next", "next_page"):
                    cursor = data.get(key)
                    if cursor:
                        sep = "&" if "?" in current_url else "?"
                        return f"{current_url}{sep}cursor={cursor}"
            return None

        if self._pagination == "offset":
            # Continue if we got a full page
            records = _extract_jsonpath(data, self._entity_path)
            if len(records) >= self._page_size:
                return current_url
            return None

        return None

    def _pick_name_field(self) -> str:
        priority = ["name", "title", "label", "key", "id", "_id", "slug"]
        lower_keys = {k.lower(): k for k in self._all_keys}
        for candidate in priority:
            if candidate in lower_keys:
                return lower_keys[candidate]
        return next(iter(self._all_keys), "")

    # ------------------------------------------------------------------ #
    #  BaseDatasetAdapter interface
    # ------------------------------------------------------------------ #

    def get_meta(self) -> DatasetMeta:
        # Trigger a fetch to get metadata
        try:
            records = self._fetch_all(1)
        except Exception:
            records = []

        keys = sorted(self._all_keys)
        primary = self._name_field or (keys[0] if keys else "name")
        secondary = ""
        for k in keys:
            if k != primary:
                secondary = k
                break

        return DatasetMeta(
            dataset_id=f"api:{self._url}",
            display_name=f"API: {self._url.split('/')[-1]}",
            description=f"REST API endpoint — {len(self._all_keys)} fields detected",
            entity_types=[
                EntityTypeConfig(
                    name=self._entity_type,
                    color="#845ef7",
                    primary_field=primary,
                    secondary_field=secondary,
                    detail_fields=keys[:8],
                )
            ],
            lookup_field="name",
            lookup_label="Record",
        )

    def fetch_entities(self, limit: int = 10_000) -> list[dict]:
        records = self._fetch_all(limit)
        entities: list[dict] = []

        for idx, record in enumerate(records):
            if self._name_field and self._name_field in record:
                name = str(record[self._name_field])
            else:
                name = f"{self._entity_type}:{idx}"

            # Flatten nested dicts
            from .json_connector import _flatten
            flat_attrs: dict[str, Any] = {}
            for k, v in record.items():
                if isinstance(v, dict):
                    flat_attrs.update(_flatten(v, k))
                elif v is not None:
                    flat_attrs[k] = v

            entities.append({
                "name": name,
                "type": self._entity_type,
                "attributes": flat_attrs,
            })

        logger.info("Produced %d entities from API", len(entities))
        return entities

    def fetch_edges(self, entities: list[dict]) -> list[dict]:
        """Infer edges from _id/_ref fields."""
        entity_index: dict[tuple[str, str], str] = {}
        for ent in entities:
            ename = ent["name"]
            etype = ent["type"]
            entity_index[(etype, ename)] = ename
            for k, v in ent.get("attributes", {}).items():
                if isinstance(v, (str, int, float)):
                    entity_index[(etype, str(v))] = ename

        id_fields = [k for k in self._all_keys if k.endswith(("_id", "Id", "_ref"))]
        edges: list[dict] = []

        for ent in entities:
            attrs = ent.get("attributes", {})
            for col in id_fields:
                ref_value = attrs.get(col)
                if ref_value is None:
                    continue
                if col.endswith("_id"):
                    ref_type = _singularize(col[:-3])
                elif col.endswith("Id"):
                    ref_type = _singularize(col[:-2]).lower()
                elif col.endswith("_ref"):
                    ref_type = _singularize(col[:-4])
                else:
                    continue
                target_key = (ref_type, str(ref_value))
                target_name = entity_index.get(target_key)
                if target_name and target_name != ent["name"]:
                    edges.append({
                        "source": ent["name"],
                        "target": target_name,
                        "type": f"{ent['type']}_to_{ref_type}",
                        "weight": 1.0,
                    })

        logger.info("Inferred %d edges from API fields", len(edges))
        return edges

    def get_anomaly_tags(
        self,
        record: dict,
        scores: dict,
        cluster_size: int,
        flips: int,
    ) -> list[dict]:
        from .csv_connector import _generic_anomaly_tags
        return _generic_anomaly_tags(record, scores, cluster_size, flips)
