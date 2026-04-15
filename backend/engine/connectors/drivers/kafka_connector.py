"""Kafka connector — consume from Kafka topics as entity stream."""
from __future__ import annotations

import json
import logging
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


class KafkaConnector(BaseDatasetAdapter):
    """Connect to Kafka topics and consume messages as entities.

    Each message becomes an entity. Topics can be entity types.

    Requires ``kafka-python``. Install with: ``pip install kafka-python``

    Usage::

        connector = KafkaConnector(
            bootstrap_servers="localhost:9092",
            topics=["orders", "users", "products"],
            group_id="latentocean",
        )
    """

    def __init__(
        self,
        bootstrap_servers: str | list[str] = "localhost:9092",
        topics: list[str] | None = None,
        group_id: str = "latentocean",
        name_field: str | None = None,
        auto_offset_reset: str = "earliest",
        consumer_timeout_ms: int = 10_000,
        security_protocol: str = "PLAINTEXT",
        sasl_mechanism: str | None = None,
        sasl_plain_username: str | None = None,
        sasl_plain_password: str | None = None,
        value_deserializer: str = "json",
    ) -> None:
        try:
            from kafka import KafkaConsumer  # noqa: F401
            self._KafkaConsumer = KafkaConsumer
        except ImportError:
            raise ImportError(
                "kafka-python is required for Kafka support. "
                "Install with: pip install kafka-python"
            )

        if isinstance(bootstrap_servers, str):
            self._bootstrap_servers = [bootstrap_servers]
        else:
            self._bootstrap_servers = list(bootstrap_servers)

        self._topics = topics or []
        self._group_id = group_id
        self._name_field = name_field
        self._auto_offset_reset = auto_offset_reset
        self._consumer_timeout_ms = consumer_timeout_ms
        self._security_protocol = security_protocol
        self._sasl_mechanism = sasl_mechanism
        self._sasl_plain_username = sasl_plain_username
        self._sasl_plain_password = sasl_plain_password
        self._value_deserializer = value_deserializer

        self._all_keys: set[str] = set()
        self._consumed_records: list[dict] | None = None
        self._consumed_topics: set[str] = set()

    def _build_consumer_kwargs(self) -> dict:
        """Build kwargs dict for KafkaConsumer."""
        kwargs: dict[str, Any] = {
            "bootstrap_servers": self._bootstrap_servers,
            "group_id": self._group_id,
            "auto_offset_reset": self._auto_offset_reset,
            "consumer_timeout_ms": self._consumer_timeout_ms,
            "security_protocol": self._security_protocol,
            "enable_auto_commit": False,
        }

        if self._value_deserializer == "json":
            kwargs["value_deserializer"] = lambda m: json.loads(m.decode("utf-8")) if m else {}

        if self._sasl_mechanism:
            kwargs["sasl_mechanism"] = self._sasl_mechanism
        if self._sasl_plain_username:
            kwargs["sasl_plain_username"] = self._sasl_plain_username
        if self._sasl_plain_password:
            kwargs["sasl_plain_password"] = self._sasl_plain_password

        return kwargs

    def _consume(self, limit: int) -> list[dict]:
        """Consume messages from Kafka topics."""
        if self._consumed_records is not None:
            return self._consumed_records[:limit]

        if not self._topics:
            raise ValueError(
                "No topics specified. Provide topics=['topic1', 'topic2'] "
                "to the KafkaConnector constructor."
            )

        kwargs = self._build_consumer_kwargs()
        consumer = self._KafkaConsumer(*self._topics, **kwargs)

        records: list[dict] = []
        try:
            for message in consumer:
                if len(records) >= limit:
                    break

                value = message.value
                if not isinstance(value, dict):
                    # Try to parse as JSON string
                    if isinstance(value, (str, bytes)):
                        try:
                            raw = value.decode("utf-8") if isinstance(value, bytes) else value
                            value = json.loads(raw)
                        except (json.JSONDecodeError, UnicodeDecodeError):
                            value = {"raw_value": str(value)}
                    else:
                        value = {"raw_value": str(value)}

                # Enrich with Kafka metadata
                value["_kafka_topic"] = message.topic
                value["_kafka_partition"] = message.partition
                value["_kafka_offset"] = message.offset
                if message.timestamp:
                    value["_kafka_timestamp"] = message.timestamp
                if message.key:
                    key_str = message.key.decode("utf-8") if isinstance(message.key, bytes) else str(message.key)
                    value["_kafka_key"] = key_str

                records.append(value)
                self._consumed_topics.add(message.topic)
                self._all_keys.update(value.keys())

        except Exception as e:
            logger.error("Kafka consume error: %s", e)
            if not records:
                raise
        finally:
            consumer.close()

        self._consumed_records = records

        if self._name_field is None:
            self._name_field = self._pick_name_field()

        logger.info("Consumed %d messages from Kafka topics %s", len(records), list(self._consumed_topics))
        return records[:limit]

    def _pick_name_field(self) -> str:
        priority = ["name", "title", "label", "key", "id", "_id", "_kafka_key"]
        lower_keys = {k.lower(): k for k in self._all_keys}
        for candidate in priority:
            if candidate in lower_keys:
                return lower_keys[candidate]
        return ""

    # ------------------------------------------------------------------ #
    #  BaseDatasetAdapter interface
    # ------------------------------------------------------------------ #

    def get_meta(self) -> DatasetMeta:
        topic_str = ", ".join(self._topics) if self._topics else "no topics"
        entity_types: list[EntityTypeConfig] = []
        colors = ["#ff922b", "#20c997", "#e64980", "#00d4ff", "#ffd43b"]

        for i, topic in enumerate(self._topics):
            entity_types.append(
                EntityTypeConfig(
                    name=_singularize(topic),
                    color=colors[i % len(colors)],
                    primary_field=self._name_field or "name",
                    secondary_field="_kafka_topic",
                    detail_fields=sorted(self._all_keys)[:8] if self._all_keys else [],
                )
            )

        return DatasetMeta(
            dataset_id=f"kafka:{self._bootstrap_servers[0]}",
            display_name=f"Kafka: {topic_str}",
            description=f"Streaming from {len(self._topics)} topic(s)",
            entity_types=entity_types,
            lookup_field="name",
            lookup_label="Message",
        )

    def fetch_entities(self, limit: int = 10_000) -> list[dict]:
        records = self._consume(limit)
        entities: list[dict] = []

        for idx, record in enumerate(records):
            # Entity type from topic name
            topic = record.get("_kafka_topic", "message")
            entity_type = _singularize(topic)

            # Entity name
            if self._name_field and self._name_field in record:
                name = str(record[self._name_field])
            elif "_kafka_key" in record and record["_kafka_key"]:
                name = f"{entity_type}:{record['_kafka_key']}"
            else:
                name = f"{entity_type}:{idx}"

            # Build attributes
            attributes: dict[str, Any] = {}
            for key, value in record.items():
                if value is None:
                    continue
                if isinstance(value, (dict, list)):
                    attributes[key] = json.dumps(value, default=str)
                else:
                    attributes[key] = value

            entities.append({
                "name": name,
                "type": entity_type,
                "attributes": attributes,
            })

        logger.info("Produced %d entities from Kafka", len(entities))
        return entities

    def fetch_edges(self, entities: list[dict]) -> list[dict]:
        """Infer edges from _id fields in Kafka messages."""
        entity_index: dict[tuple[str, str], str] = {}
        for ent in entities:
            ename = ent["name"]
            etype = ent["type"]
            entity_index[(etype, ename)] = ename
            for k, v in ent.get("attributes", {}).items():
                if isinstance(v, (str, int, float)):
                    entity_index[(etype, str(v))] = ename

        id_fields = [k for k in self._all_keys if k.endswith(("_id", "Id")) and not k.startswith("_kafka")]
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

        logger.info("Inferred %d edges from Kafka message fields", len(edges))
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
