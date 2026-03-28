"""Auto-detect column roles in tabular datasets for graph conversion.

Heuristics:
- Columns with "id" or unique high-cardinality values → entity identifiers
- Categorical columns with low cardinality → entity types or grouping
- Columns referencing other ID columns → relationships (foreign keys)
- Numeric / text columns → attributes
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

import pandas as pd

logger = logging.getLogger(__name__)

# Patterns that suggest an ID column
_ID_PATTERNS = re.compile(r"(?:^id$|_id$|_key$|_code$|^index$)", re.IGNORECASE)
_NAME_PATTERNS = re.compile(r"(?:^name$|_name$|^title$|^label$)", re.IGNORECASE)
_TYPE_PATTERNS = re.compile(r"(?:^type$|_type$|^category$|^class$|^group$|^sector$|^industry$)", re.IGNORECASE)
_REL_PATTERNS = re.compile(
    r"(?:^source$|^target$|^from$|^to$|^parent|^child|^partner|^supplier|^customer|_ref$)",
    re.IGNORECASE,
)

# Maximum unique ratio for a column to be considered categorical
_CATEGORICAL_THRESHOLD = 0.05  # 5% unique values relative to row count


@dataclass
class ColumnRole:
    """Detected role for a single column."""
    column: str
    role: str  # "entity_id", "entity_name", "entity_type", "relationship", "attribute"
    confidence: float = 0.5


@dataclass
class SchemaMapping:
    """Complete mapping of columns to graph roles."""
    entity_id_column: str | None = None
    entity_name_column: str | None = None
    entity_type_column: str | None = None
    relationship_columns: list[str] = field(default_factory=list)
    attribute_columns: list[str] = field(default_factory=list)
    column_roles: list[ColumnRole] = field(default_factory=list)

    # For edge-list style datasets
    source_column: str | None = None
    target_column: str | None = None
    relationship_type_column: str | None = None
    weight_column: str | None = None

    @property
    def is_edge_list(self) -> bool:
        return self.source_column is not None and self.target_column is not None

    def to_csv_adapter_mapping(self) -> dict:
        """Convert to the dict format expected by CSVAdapter._parse_with_mapping."""
        if self.is_edge_list:
            mapping: dict = {
                "source_column": self.source_column,
                "target_column": self.target_column,
            }
            if self.entity_type_column:
                mapping["entity_type_column"] = self.entity_type_column
            if self.relationship_type_column:
                mapping["relationship_type_column"] = self.relationship_type_column
            if self.weight_column:
                mapping["weight_column"] = self.weight_column
            if self.attribute_columns:
                mapping["attribute_columns"] = self.attribute_columns
            return mapping

        # For entity-table style: use entity_id as source and relationship columns as targets
        mapping = {}
        if self.entity_id_column:
            mapping["source_column"] = self.entity_id_column
        elif self.entity_name_column:
            mapping["source_column"] = self.entity_name_column
        if self.relationship_columns:
            mapping["target_column"] = self.relationship_columns[0]
        if self.entity_type_column:
            mapping["entity_type_column"] = self.entity_type_column
        if self.attribute_columns:
            mapping["attribute_columns"] = self.attribute_columns
        return mapping


class SchemaMapper:
    """Detect column roles in a tabular dataset."""

    def detect(self, df: pd.DataFrame) -> SchemaMapping:
        """Analyze a DataFrame and return a SchemaMapping with detected roles."""
        mapping = SchemaMapping()
        n_rows = len(df)

        if n_rows == 0:
            return mapping

        roles: list[ColumnRole] = []

        for col in df.columns:
            role = self._classify_column(col, df[col], n_rows)
            roles.append(role)

        mapping.column_roles = roles

        # Assign columns to schema slots by priority
        id_cols = [r for r in roles if r.role == "entity_id"]
        name_cols = [r for r in roles if r.role == "entity_name"]
        type_cols = [r for r in roles if r.role == "entity_type"]
        rel_cols = [r for r in roles if r.role == "relationship"]
        attr_cols = [r for r in roles if r.role == "attribute"]

        # Check for edge-list format: two relationship-like columns (source/target)
        source_target = [r for r in roles if _REL_PATTERNS.search(r.column)]
        if len(source_target) >= 2:
            mapping.source_column = source_target[0].column
            mapping.target_column = source_target[1].column
            remaining = [r for r in roles if r.column not in {source_target[0].column, source_target[1].column}]
            for r in remaining:
                if r.role == "entity_type":
                    mapping.relationship_type_column = r.column
                elif r.role == "attribute" and self._is_numeric_col(df[r.column]):
                    if not mapping.weight_column:
                        mapping.weight_column = r.column
                    else:
                        mapping.attribute_columns.append(r.column)
                else:
                    mapping.attribute_columns.append(r.column)
            logger.info("Detected edge-list schema: source=%s, target=%s", mapping.source_column, mapping.target_column)
            return mapping

        # Entity-table format
        if id_cols:
            mapping.entity_id_column = sorted(id_cols, key=lambda r: -r.confidence)[0].column
        if name_cols:
            mapping.entity_name_column = sorted(name_cols, key=lambda r: -r.confidence)[0].column
        if type_cols:
            mapping.entity_type_column = sorted(type_cols, key=lambda r: -r.confidence)[0].column

        mapping.relationship_columns = [r.column for r in rel_cols]
        mapping.attribute_columns = [r.column for r in attr_cols]

        # If no entity_id detected, use entity_name or first column
        if not mapping.entity_id_column and not mapping.entity_name_column:
            mapping.entity_name_column = df.columns[0]

        logger.info(
            "Detected entity-table schema: id=%s, name=%s, type=%s, rels=%d, attrs=%d",
            mapping.entity_id_column,
            mapping.entity_name_column,
            mapping.entity_type_column,
            len(mapping.relationship_columns),
            len(mapping.attribute_columns),
        )
        return mapping

    def _classify_column(self, col_name: str, series: pd.Series, n_rows: int) -> ColumnRole:
        """Classify a single column based on name patterns and value analysis."""
        # Check name patterns first (high confidence)
        if _ID_PATTERNS.search(col_name):
            return ColumnRole(column=col_name, role="entity_id", confidence=0.9)

        if _REL_PATTERNS.search(col_name):
            return ColumnRole(column=col_name, role="relationship", confidence=0.8)

        if _TYPE_PATTERNS.search(col_name):
            return ColumnRole(column=col_name, role="entity_type", confidence=0.8)

        if _NAME_PATTERNS.search(col_name):
            return ColumnRole(column=col_name, role="entity_name", confidence=0.8)

        # Value-based analysis
        n_unique = series.nunique()
        unique_ratio = n_unique / n_rows if n_rows > 0 else 0

        # High uniqueness → ID or name
        if unique_ratio > 0.9 and series.dtype == "object":
            return ColumnRole(column=col_name, role="entity_name", confidence=0.5)

        # Low cardinality string → type/category
        if series.dtype == "object" and unique_ratio <= _CATEGORICAL_THRESHOLD and n_unique <= 50:
            return ColumnRole(column=col_name, role="entity_type", confidence=0.6)

        # Everything else is an attribute
        return ColumnRole(column=col_name, role="attribute", confidence=0.4)

    @staticmethod
    def _is_numeric_col(series: pd.Series) -> bool:
        return pd.api.types.is_numeric_dtype(series)
