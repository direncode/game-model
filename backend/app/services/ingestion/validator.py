"""Graph validation for parsed entity-relationship data.

Checks structural integrity, detects anomalies, and produces
a detailed validation report with warnings and errors.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum

from app.services.ingestion.csv_adapter import ParsedGraph

logger = logging.getLogger(__name__)


class Severity(str, Enum):
    """Validation issue severity levels."""

    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


@dataclass
class ValidationIssue:
    """A single validation finding."""

    severity: Severity
    code: str
    message: str
    details: dict | None = None


@dataclass
class ValidationReport:
    """Complete validation report for a parsed graph."""

    is_valid: bool
    issues: list[ValidationIssue] = field(default_factory=list)
    entity_count: int = 0
    relationship_count: int = 0

    @property
    def errors(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == Severity.ERROR]

    @property
    def warnings(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == Severity.WARNING]

    def to_dict(self) -> dict:
        return {
            "is_valid": self.is_valid,
            "entity_count": self.entity_count,
            "relationship_count": self.relationship_count,
            "error_count": len(self.errors),
            "warning_count": len(self.warnings),
            "issues": [
                {
                    "severity": i.severity.value,
                    "code": i.code,
                    "message": i.message,
                    "details": i.details,
                }
                for i in self.issues
            ],
        }


class Validator:
    """Validate structural integrity of a parsed graph."""

    async def validate(self, graph: ParsedGraph) -> ValidationReport:
        """Run all validation checks on a parsed graph.

        Checks performed:
        - Dangling references: relationship endpoints without matching entities.
        - Isolated nodes: entities with no relationships.
        - Self-loops: relationships where source == target.
        - Empty names: entities or relationships with blank identifiers.
        - Duplicate relationships: identical source-target-type triples.

        Args:
            graph: Normalized parsed graph.

        Returns:
            ValidationReport with all findings.
        """
        issues: list[ValidationIssue] = []

        entity_names = {e.name for e in graph.entities}
        logger.info(
            "Validating graph: %d entities, %d relationships",
            len(entity_names),
            len(graph.relationships),
        )

        # Check for empty entity names
        empty_names = [e for e in graph.entities if not e.name.strip()]
        if empty_names:
            issues.append(
                ValidationIssue(
                    severity=Severity.ERROR,
                    code="EMPTY_ENTITY_NAME",
                    message=f"{len(empty_names)} entities have empty names",
                )
            )

        # Check dangling references
        dangling = self._check_dangling_references(
            graph.relationships, entity_names
        )
        if dangling:
            issues.append(
                ValidationIssue(
                    severity=Severity.ERROR,
                    code="DANGLING_REFERENCE",
                    message=(
                        f"{len(dangling)} relationship endpoints reference "
                        "non-existent entities"
                    ),
                    details={"dangling_entities": list(dangling)[:50]},
                )
            )

        # Check isolated nodes
        isolated = self._check_isolated_nodes(
            graph.entities, graph.relationships
        )
        if isolated:
            issues.append(
                ValidationIssue(
                    severity=Severity.WARNING,
                    code="ISOLATED_NODE",
                    message=f"{len(isolated)} entities have no relationships",
                    details={"isolated_entities": list(isolated)[:50]},
                )
            )

        # Check self-loops
        self_loops = self._check_self_loops(graph.relationships)
        if self_loops:
            issues.append(
                ValidationIssue(
                    severity=Severity.WARNING,
                    code="SELF_LOOP",
                    message=f"{len(self_loops)} self-loop relationships detected",
                    details={"self_loop_entities": list(self_loops)[:50]},
                )
            )

        # Check duplicate relationships
        duplicates = self._check_duplicate_relationships(graph.relationships)
        if duplicates:
            issues.append(
                ValidationIssue(
                    severity=Severity.WARNING,
                    code="DUPLICATE_RELATIONSHIP",
                    message=f"{duplicates} duplicate relationships found",
                )
            )

        # Check entities with no type
        untyped = [e for e in graph.entities if not e.entity_type]
        if untyped:
            pct = len(untyped) / max(len(graph.entities), 1) * 100
            issues.append(
                ValidationIssue(
                    severity=Severity.INFO if pct < 50 else Severity.WARNING,
                    code="UNTYPED_ENTITY",
                    message=(
                        f"{len(untyped)} entities ({pct:.0f}%) have no type assigned"
                    ),
                )
            )

        has_errors = any(i.severity == Severity.ERROR for i in issues)

        report = ValidationReport(
            is_valid=not has_errors,
            issues=issues,
            entity_count=len(graph.entities),
            relationship_count=len(graph.relationships),
        )

        logger.info(
            "Validation complete: valid=%s, errors=%d, warnings=%d",
            report.is_valid,
            len(report.errors),
            len(report.warnings),
        )
        return report

    @staticmethod
    def _check_dangling_references(
        relationships: list, entity_names: set[str]
    ) -> set[str]:
        """Find relationship endpoints that don't match any entity."""
        dangling: set[str] = set()
        for rel in relationships:
            if rel.source not in entity_names:
                dangling.add(rel.source)
            if rel.target not in entity_names:
                dangling.add(rel.target)
        return dangling

    @staticmethod
    def _check_isolated_nodes(entities: list, relationships: list) -> set[str]:
        """Find entities that participate in no relationships."""
        connected: set[str] = set()
        for rel in relationships:
            connected.add(rel.source)
            connected.add(rel.target)
        return {e.name for e in entities} - connected

    @staticmethod
    def _check_self_loops(relationships: list) -> set[str]:
        """Find relationships where source and target are the same entity."""
        return {rel.source for rel in relationships if rel.source == rel.target}

    @staticmethod
    def _check_duplicate_relationships(relationships: list) -> int:
        """Count duplicate relationships (same source, target, type)."""
        seen: set[tuple[str, str, str | None]] = set()
        duplicates = 0
        for rel in relationships:
            key = (rel.source, rel.target, rel.relationship_type)
            if key in seen:
                duplicates += 1
            else:
                seen.add(key)
        return duplicates
