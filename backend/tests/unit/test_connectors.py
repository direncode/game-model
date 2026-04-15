"""Unit tests for generic connectors (no DB required)."""
from __future__ import annotations

import sys
import os
import pytest

# Ensure engine package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from engine.connectors.generic.type_classifier import TypeClassifier
from engine.connectors.generic.schema_introspector import SchemaIntrospector
from engine.connectors.generic.entity_mapper import (
    EntityMapper,
    EntityMappingConfig,
    TableMappingConfig,
)
from engine.connectors.generic.edge_inferrer import EdgeInferrer
from engine.connectors.base import (
    ColumnInfo,
    TableInfo,
    SchemaMap,
    RelationshipSuggestion,
    EntityTypeConfig,
)


# =====================================================================
#  TypeClassifier
# =====================================================================

class TestTypeClassifier:
    """Test classification of database column types."""

    def setup_method(self):
        self.cls = TypeClassifier()

    # -- Text types --

    def test_varchar_classified_as_text(self):
        assert self.cls.classify("description", "varchar") == "text"

    def test_varchar_with_length_classified_as_text(self):
        assert self.cls.classify("title", "varchar(255)") == "text"

    def test_character_varying_classified_as_text(self):
        assert self.cls.classify("name", "character varying") == "text"

    def test_text_type_classified_as_text(self):
        assert self.cls.classify("bio", "text") == "text"

    def test_char_classified_as_text(self):
        assert self.cls.classify("code", "char") == "text"

    def test_citext_classified_as_text(self):
        assert self.cls.classify("email", "citext") == "text"

    # -- Numeric types --

    def test_integer_classified_as_numeric(self):
        assert self.cls.classify("count", "integer") == "numeric"

    def test_int_classified_as_numeric(self):
        assert self.cls.classify("amount", "int") == "numeric"

    def test_bigint_classified_as_numeric(self):
        assert self.cls.classify("population", "bigint") == "numeric"

    def test_float_classified_as_numeric(self):
        assert self.cls.classify("price", "float") == "numeric"

    def test_double_precision_classified_as_numeric(self):
        assert self.cls.classify("latitude", "double precision") == "numeric"

    def test_numeric_classified_as_numeric(self):
        assert self.cls.classify("balance", "numeric") == "numeric"

    def test_decimal_classified_as_numeric(self):
        assert self.cls.classify("rate", "decimal") == "numeric"

    def test_serial_classified_as_numeric(self):
        assert self.cls.classify("seq", "serial") == "numeric"

    def test_money_classified_as_numeric(self):
        assert self.cls.classify("cost", "money") == "numeric"

    def test_smallint_classified_as_numeric(self):
        assert self.cls.classify("age", "smallint") == "numeric"

    # -- Temporal types --

    def test_timestamp_classified_as_temporal(self):
        assert self.cls.classify("event_time", "timestamp") == "temporal"

    def test_timestamptz_classified_as_temporal(self):
        assert self.cls.classify("logged", "timestamptz") == "temporal"

    def test_date_classified_as_temporal(self):
        assert self.cls.classify("dob", "date") == "temporal"

    def test_time_classified_as_temporal(self):
        assert self.cls.classify("start_hour", "time") == "temporal"

    def test_interval_classified_as_temporal(self):
        assert self.cls.classify("duration", "interval") == "temporal"

    def test_timestamp_with_tz_classified_as_temporal(self):
        assert self.cls.classify("ts", "timestamp with time zone") == "temporal"

    # -- Name-based temporal heuristics --

    def test_created_at_name_overrides_type(self):
        assert self.cls.classify("created_at", "varchar") == "temporal"

    def test_updated_at_name_overrides_type(self):
        assert self.cls.classify("updated_at", "bigint") == "temporal"

    def test_modified_date_name_overrides_type(self):
        assert self.cls.classify("modified_date", "text") == "temporal"

    def test_timestamp_in_name(self):
        assert self.cls.classify("event_timestamp", "varchar") == "temporal"

    # -- ID types --

    def test_id_column_classified_as_id(self):
        assert self.cls.classify("id", "integer") == "id"

    def test_user_id_classified_as_id(self):
        assert self.cls.classify("user_id", "integer") == "id"

    def test_column_ending_uuid_classified_as_id(self):
        assert self.cls.classify("order_uuid", "varchar") == "id"

    def test_column_ending_key_classified_as_id(self):
        assert self.cls.classify("api_key", "text") == "id"

    def test_uuid_type_classified_as_id(self):
        assert self.cls.classify("external_ref", "uuid") == "id"

    # -- JSON types --

    def test_json_classified_as_json(self):
        assert self.cls.classify("metadata", "json") == "json"

    def test_jsonb_classified_as_json(self):
        assert self.cls.classify("config", "jsonb") == "json"

    # -- Boolean types --

    def test_boolean_classified_as_boolean(self):
        assert self.cls.classify("active", "boolean") == "boolean"

    def test_bool_classified_as_boolean(self):
        assert self.cls.classify("is_admin", "bool") == "boolean"

    # -- Network types --

    def test_inet_classified_as_text(self):
        assert self.cls.classify("ip_addr", "inet") == "text"

    def test_cidr_classified_as_text(self):
        assert self.cls.classify("subnet", "cidr") == "text"

    def test_macaddr_classified_as_text(self):
        assert self.cls.classify("mac", "macaddr") == "text"

    # -- Range types --

    def test_tstzrange_classified_as_json(self):
        assert self.cls.classify("validity", "tstzrange") == "json"

    def test_int4range_classified_as_json(self):
        assert self.cls.classify("score_range", "int4range") == "json"

    # -- Geometric types --

    def test_point_classified_as_json(self):
        assert self.cls.classify("location", "point") == "json"

    def test_polygon_classified_as_json(self):
        assert self.cls.classify("boundary", "polygon") == "json"

    # -- Binary types --

    def test_bytea_classified_as_text(self):
        assert self.cls.classify("data", "bytea") == "text"

    # -- Enum types --

    def test_enum_classified_as_categorical(self):
        assert self.cls.classify("status", "enum") == "categorical"

    def test_user_defined_classified_as_categorical(self):
        assert self.cls.classify("priority", "user-defined") == "categorical"

    # -- Embedding / Array types --

    def test_float_array_classified_as_embedding(self):
        assert self.cls.classify("embedding", "float[]") == "embedding"

    def test_float4_array_classified_as_embedding(self):
        assert self.cls.classify("vec", "float4[]") == "embedding"

    def test_vector_classified_as_embedding(self):
        assert self.cls.classify("features", "vector") == "embedding"

    def test_text_array_classified_as_json(self):
        assert self.cls.classify("tags", "text[]") == "json"

    def test_integer_array_classified_as_json(self):
        assert self.cls.classify("scores", "integer[]") == "json"

    # -- Fallback --

    def test_unknown_type_falls_back_to_text(self):
        assert self.cls.classify("mystery", "somecustomtype") == "text"

    # -- Name precedence over type --

    def test_id_name_takes_precedence_over_text_type(self):
        assert self.cls.classify("id", "varchar") == "id"

    def test_temporal_name_takes_precedence_over_int_type(self):
        assert self.cls.classify("created_at", "int") == "temporal"


# =====================================================================
#  SchemaIntrospector
# =====================================================================

def _make_table(name, columns, schema="public"):
    return TableInfo(name=name, schema=schema, columns=columns)


def _make_col(name, dtype="varchar", pk=False, fk=False, refs=""):
    return ColumnInfo(
        name=name, dtype=dtype,
        is_primary_key=pk, is_foreign_key=fk,
        references=refs,
    )


class TestSchemaIntrospector:
    """Test schema introspection with mock data."""

    def setup_method(self):
        self.introspector = SchemaIntrospector()

    def test_introspect_extracts_foreign_keys(self):
        tables = [
            _make_table("orders", [
                _make_col("id", "integer", pk=True),
                _make_col("user_id", "integer", fk=True, refs="users.id"),
                _make_col("total", "numeric"),
            ]),
            _make_table("users", [
                _make_col("id", "integer", pk=True),
                _make_col("name", "varchar"),
            ]),
        ]
        schema = self.introspector.introspect(tables)
        assert len(schema.foreign_keys) == 1
        fk = schema.foreign_keys[0]
        assert fk["from_table"] == "orders"
        assert fk["from_col"] == "user_id"
        assert fk["to_table"] == "users"
        assert fk["to_col"] == "id"

    def test_introspect_with_no_fks(self):
        tables = [
            _make_table("products", [
                _make_col("id", "integer", pk=True),
                _make_col("name", "varchar"),
            ]),
        ]
        schema = self.introspector.introspect(tables)
        assert len(schema.foreign_keys) == 0
        assert len(schema.tables) == 1

    def test_introspect_empty_tables(self):
        schema = self.introspector.introspect([])
        assert len(schema.tables) == 0
        assert len(schema.foreign_keys) == 0

    def test_entity_type_suggestion_singularizes(self):
        tables = [
            _make_table("users", [
                _make_col("id", "integer", pk=True),
                _make_col("email", "varchar"),
            ]),
        ]
        schema = self.introspector.introspect(tables)
        suggestions = self.introspector.suggest_entity_types(schema)
        assert len(suggestions) == 1
        assert suggestions[0].name == "user"

    def test_entity_type_suggestion_assigns_color(self):
        tables = [
            _make_table("users", [
                _make_col("id", "integer", pk=True),
                _make_col("name", "varchar"),
            ]),
        ]
        schema = self.introspector.introspect(tables)
        suggestions = self.introspector.suggest_entity_types(schema)
        assert suggestions[0].color.startswith("#")

    def test_entity_type_primary_field_is_first_text_col(self):
        tables = [
            _make_table("companies", [
                _make_col("id", "integer", pk=True),
                _make_col("company_name", "varchar"),
                _make_col("ticker", "varchar"),
            ]),
        ]
        schema = self.introspector.introspect(tables)
        suggestions = self.introspector.suggest_entity_types(schema)
        assert suggestions[0].primary_field == "company_name"
        assert suggestions[0].secondary_field == "ticker"

    def test_relationship_suggestion_from_fk(self):
        tables = [
            _make_table("orders", [
                _make_col("id", "integer", pk=True),
                _make_col("user_id", "integer", fk=True, refs="users.id"),
            ]),
            _make_table("users", [
                _make_col("id", "integer", pk=True),
                _make_col("name", "varchar"),
            ]),
        ]
        schema = self.introspector.introspect(tables)
        rels = self.introspector.suggest_relationships(schema)
        assert len(rels) >= 1
        fk_rels = [r for r in rels if r.basis == "foreign_key"]
        assert fk_rels[0].from_table == "orders"
        assert fk_rels[0].to_table == "users"
        assert fk_rels[0].confidence == 1.0

    def test_junction_table_detection(self):
        tables = [
            _make_table("users", [
                _make_col("id", "integer", pk=True),
                _make_col("name", "varchar"),
            ]),
            _make_table("roles", [
                _make_col("id", "integer", pk=True),
                _make_col("label", "varchar"),
            ]),
            _make_table("user_roles", [
                _make_col("user_id", "integer", fk=True, refs="users.id"),
                _make_col("role_id", "integer", fk=True, refs="roles.id"),
                _make_col("assigned_at", "timestamp"),
            ]),
        ]
        schema = self.introspector.introspect(tables)
        entity_types = self.introspector.suggest_entity_types(schema)
        entity_names = [e.name for e in entity_types]
        # Junction table should be excluded from entity types
        assert "user_role" not in entity_names
        assert "user" in entity_names
        assert "role" in entity_names

    def test_junction_table_many_to_many_relationship(self):
        tables = [
            _make_table("students", [
                _make_col("id", "integer", pk=True),
                _make_col("name", "varchar"),
            ]),
            _make_table("courses", [
                _make_col("id", "integer", pk=True),
                _make_col("title", "varchar"),
            ]),
            _make_table("enrollments", [
                _make_col("student_id", "integer", fk=True, refs="students.id"),
                _make_col("course_id", "integer", fk=True, refs="courses.id"),
                _make_col("enrolled_at", "timestamp"),
            ]),
        ]
        schema = self.introspector.introspect(tables)
        rels = self.introspector.suggest_relationships(schema)
        # Should have a many-to-many relationship between students and courses
        m2m = [r for r in rels if r.confidence == 0.95]
        assert len(m2m) == 1
        assert {m2m[0].from_table, m2m[0].to_table} == {"students", "courses"}

    def test_classify_columns_returns_all_tables(self):
        tables = [
            _make_table("users", [
                _make_col("id", "integer", pk=True),
                _make_col("name", "varchar"),
                _make_col("created_at", "timestamp"),
            ]),
        ]
        schema = self.introspector.introspect(tables)
        classifications = self.introspector.classify_columns(schema)
        assert "users" in classifications
        assert classifications["users"]["id"] == "id"
        assert classifications["users"]["name"] == "text"
        assert classifications["users"]["created_at"] == "temporal"

    def test_name_match_heuristic_relationship(self):
        tables = [
            _make_table("orders", [
                _make_col("id", "integer", pk=True),
                _make_col("customer_id", "integer"),  # Not explicit FK
            ]),
            _make_table("customer", [
                _make_col("id", "integer", pk=True),
                _make_col("name", "varchar"),
            ]),
        ]
        schema = self.introspector.introspect(tables)
        rels = self.introspector.suggest_relationships(schema)
        name_matches = [r for r in rels if r.basis == "name_match"]
        assert len(name_matches) == 1
        assert name_matches[0].from_table == "orders"
        assert name_matches[0].to_table == "customer"
        assert name_matches[0].confidence == 0.8

    def test_estimate_entity_count(self):
        counts = {"users": 1000, "orders": 5000, "products": 200}
        assert self.introspector.estimate_entity_count(counts) == 6200

    def test_estimate_entity_count_empty(self):
        assert self.introspector.estimate_entity_count({}) == 0


# =====================================================================
#  EntityMapper
# =====================================================================

class TestEntityMapper:
    """Test row-to-entity mapping."""

    def test_default_mapping_uses_name_field(self):
        mapper = EntityMapper()
        row = {"id": 1, "name": "Alice", "email": "alice@example.com"}
        entity = mapper.map_row("users", row)
        assert entity["name"] == "Alice"
        assert entity["type"] == "user"

    def test_default_mapping_uses_id_when_no_name(self):
        mapper = EntityMapper()
        row = {"id": 42, "email": "bob@example.com"}
        entity = mapper.map_row("users", row)
        assert entity["name"] == "users:42"

    def test_default_mapping_uses_first_value_as_fallback(self):
        mapper = EntityMapper()
        row = {"code": "ABC", "value": 100}
        entity = mapper.map_row("items", row)
        assert entity["name"] == "ABC"

    def test_empty_row_returns_unknown(self):
        mapper = EntityMapper()
        entity = mapper.map_row("things", {})
        assert entity["name"] == "unknown"
        assert entity["type"] == "thing"

    def test_singularization_of_table_name(self):
        mapper = EntityMapper()
        assert mapper.map_row("companies", {"id": 1})["type"] == "company"
        assert mapper.map_row("addresses", {"id": 1})["type"] == "address"
        assert mapper.map_row("statuses", {"id": 1})["type"] == "statuse"  # naive ses rule

    def test_custom_entity_type_override(self):
        config = EntityMappingConfig(tables={
            "users": TableMappingConfig(
                table_name="users",
                entity_type="person",
            ),
        })
        mapper = EntityMapper(config)
        entity = mapper.map_row("users", {"id": 1, "name": "Alice"})
        assert entity["type"] == "person"

    def test_custom_name_column(self):
        config = EntityMappingConfig(tables={
            "users": TableMappingConfig(
                table_name="users",
                name_column="email",
            ),
        })
        mapper = EntityMapper(config)
        entity = mapper.map_row("users", {"id": 1, "email": "a@b.com", "name": "A"})
        assert entity["name"] == "a@b.com"

    def test_name_template(self):
        config = EntityMappingConfig(tables={
            "users": TableMappingConfig(
                table_name="users",
                name_template="{first_name} {last_name}",
            ),
        })
        mapper = EntityMapper(config)
        entity = mapper.map_row("users", {
            "id": 1, "first_name": "John", "last_name": "Doe",
        })
        assert entity["name"] == "John Doe"

    def test_name_template_with_missing_key_falls_back(self):
        config = EntityMappingConfig(tables={
            "users": TableMappingConfig(
                table_name="users",
                name_template="{first_name} {last_name}",
            ),
        })
        mapper = EntityMapper(config)
        entity = mapper.map_row("users", {"id": 1, "name": "Alice"})
        # Template fails, falls back to name column
        assert entity["name"] == "Alice"

    def test_attributes_exclude_none_values(self):
        mapper = EntityMapper()
        row = {"id": 1, "name": "X", "email": None, "age": 30}
        entity = mapper.map_row("users", row)
        assert "email" not in entity["attributes"]
        assert entity["attributes"]["age"] == 30

    def test_attributes_include_list(self):
        config = EntityMappingConfig(tables={
            "users": TableMappingConfig(
                table_name="users",
                include_columns=["email"],
            ),
        })
        mapper = EntityMapper(config)
        row = {"id": 1, "name": "X", "email": "a@b.com", "age": 30}
        entity = mapper.map_row("users", row)
        assert "email" in entity["attributes"]
        assert "age" not in entity["attributes"]

    def test_attributes_exclude_list(self):
        config = EntityMappingConfig(tables={
            "users": TableMappingConfig(
                table_name="users",
                exclude_columns=["password"],
            ),
        })
        mapper = EntityMapper(config)
        row = {"id": 1, "name": "X", "email": "a@b.com", "password": "secret"}
        entity = mapper.map_row("users", row)
        assert "password" not in entity["attributes"]

    def test_map_rows_batch(self):
        mapper = EntityMapper()
        rows = [{"name": "A"}, {"name": "B"}, {"name": "C"}]
        entities = mapper.map_rows("items", rows)
        assert len(entities) == 3
        assert [e["name"] for e in entities] == ["A", "B", "C"]

    def test_nested_dict_in_attributes(self):
        mapper = EntityMapper()
        row = {"name": "X", "metadata": {"key": "value"}}
        entity = mapper.map_row("items", row)
        assert entity["attributes"]["metadata"] == {"key": "value"}

    def test_list_in_attributes(self):
        mapper = EntityMapper()
        row = {"name": "X", "tags": ["a", "b"]}
        entity = mapper.map_row("items", row)
        assert entity["attributes"]["tags"] == ["a", "b"]


# =====================================================================
#  EdgeInferrer
# =====================================================================

class TestEdgeInferrer:
    """Test FK-based edge creation."""

    def setup_method(self):
        self.inferrer = EdgeInferrer()

    def test_basic_fk_edge(self):
        schema = SchemaMap(
            tables=[
                _make_table("orders", [
                    _make_col("id", "integer", pk=True),
                    _make_col("user_id", "integer", fk=True, refs="users.id"),
                ]),
                _make_table("users", [
                    _make_col("id", "integer", pk=True),
                    _make_col("name", "varchar"),
                ]),
            ],
            foreign_keys=[{
                "from_table": "orders",
                "from_col": "user_id",
                "to_table": "users",
                "to_col": "id",
            }],
        )
        entities = [
            {"name": "Alice", "type": "user", "attributes": {"id": 1}},
            {"name": "orders:10", "type": "order", "attributes": {"id": 10, "user_id": 1}},
        ]
        rows_by_table = {
            "orders": [{"id": 10, "user_id": 1}],
            "users": [{"id": 1, "name": "Alice"}],
        }
        edges = self.inferrer.infer_edges(entities, schema, rows_by_table)
        assert len(edges) == 1
        assert edges[0]["source"] == "orders:10"
        assert edges[0]["target"] == "Alice"
        assert edges[0]["type"] == "order_to_user"
        assert edges[0]["weight"] == 1.0

    def test_no_fk_produces_no_edges(self):
        schema = SchemaMap(
            tables=[_make_table("items", [_make_col("id", "integer", pk=True)])],
            foreign_keys=[],
        )
        entities = [{"name": "Item1", "type": "item", "attributes": {"id": 1}}]
        edges = self.inferrer.infer_edges(entities, schema, {"items": [{"id": 1}]})
        assert edges == []

    def test_null_fk_value_skipped(self):
        schema = SchemaMap(
            tables=[
                _make_table("orders", [
                    _make_col("id", "integer", pk=True),
                    _make_col("user_id", "integer", fk=True, refs="users.id"),
                ]),
                _make_table("users", [_make_col("id", "integer", pk=True)]),
            ],
            foreign_keys=[{
                "from_table": "orders", "from_col": "user_id",
                "to_table": "users", "to_col": "id",
            }],
        )
        entities = [
            {"name": "orders:10", "type": "order", "attributes": {"id": 10}},
        ]
        rows_by_table = {"orders": [{"id": 10, "user_id": None}]}
        edges = self.inferrer.infer_edges(entities, schema, rows_by_table)
        assert edges == []

    def test_missing_target_entity_skipped_gracefully(self):
        schema = SchemaMap(
            tables=[
                _make_table("orders", [
                    _make_col("id", "integer", pk=True),
                    _make_col("user_id", "integer", fk=True, refs="users.id"),
                ]),
                _make_table("users", [_make_col("id", "integer", pk=True)]),
            ],
            foreign_keys=[{
                "from_table": "orders", "from_col": "user_id",
                "to_table": "users", "to_col": "id",
            }],
        )
        # Entity for user_id=999 does not exist
        entities = [
            {"name": "orders:10", "type": "order", "attributes": {"id": 10, "user_id": 999}},
        ]
        rows_by_table = {"orders": [{"id": 10, "user_id": 999}]}
        edges = self.inferrer.infer_edges(entities, schema, rows_by_table)
        assert edges == []

    def test_many_to_many_via_junction_table(self):
        schema = SchemaMap(
            tables=[
                _make_table("students", [
                    _make_col("id", "integer", pk=True),
                    _make_col("name", "varchar"),
                ]),
                _make_table("courses", [
                    _make_col("id", "integer", pk=True),
                    _make_col("title", "varchar"),
                ]),
                _make_table("enrollments", [
                    _make_col("student_id", "integer", fk=True, refs="students.id"),
                    _make_col("course_id", "integer", fk=True, refs="courses.id"),
                    _make_col("enrolled_at", "timestamp"),
                ]),
            ],
            foreign_keys=[
                {"from_table": "enrollments", "from_col": "student_id",
                 "to_table": "students", "to_col": "id"},
                {"from_table": "enrollments", "from_col": "course_id",
                 "to_table": "courses", "to_col": "id"},
            ],
        )
        entities = [
            {"name": "Alice", "type": "student", "attributes": {"id": 1}},
            {"name": "Math 101", "type": "course", "attributes": {"id": 10}},
        ]
        rows_by_table = {
            "enrollments": [{"student_id": 1, "course_id": 10, "enrolled_at": "2024-01-01"}],
            "students": [{"id": 1, "name": "Alice"}],
            "courses": [{"id": 10, "title": "Math 101"}],
        }
        edges = self.inferrer.infer_edges(entities, schema, rows_by_table)
        assert len(edges) == 1
        assert edges[0]["source"] == "Alice"
        assert edges[0]["target"] == "Math 101"

    def test_empty_rows_produce_no_edges(self):
        schema = SchemaMap(
            tables=[
                _make_table("orders", [
                    _make_col("id", "integer", pk=True),
                    _make_col("user_id", "integer", fk=True, refs="users.id"),
                ]),
                _make_table("users", [_make_col("id", "integer", pk=True)]),
            ],
            foreign_keys=[{
                "from_table": "orders", "from_col": "user_id",
                "to_table": "users", "to_col": "id",
            }],
        )
        edges = self.inferrer.infer_edges([], schema, {})
        assert edges == []
