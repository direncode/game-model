"""Generic connector utilities — schema introspection, entity mapping, edge inference."""
from .schema_introspector import SchemaIntrospector
from .entity_mapper import EntityMapper, EntityMappingConfig
from .edge_inferrer import EdgeInferrer
from .type_classifier import TypeClassifier

__all__ = [
    "SchemaIntrospector",
    "EntityMapper",
    "EntityMappingConfig",
    "EdgeInferrer",
    "TypeClassifier",
]
