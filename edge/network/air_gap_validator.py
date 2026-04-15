"""Validates that the deployment makes zero external network calls.

Scans Python source files for patterns that indicate outbound HTTP
requests, socket connections, or use of networking libraries that
would violate an air-gapped deployment policy.
"""

from __future__ import annotations

import ast
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class Violation:
    """A detected air-gap policy violation."""

    file: str
    line: int
    description: str
    severity: str  # "critical", "warning"


class AirGapValidator:
    """Scans the codebase for code patterns that make external network calls."""

    ALLOWED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}

    # Regex patterns that indicate external network access
    EXTERNAL_PATTERNS = [
        (r'https?://(?!localhost|127\.0\.0\.1|0\.0\.0\.0)', "Hardcoded external URL"),
        (r'requests\.(get|post|put|delete|patch|head|options)\s*\(', "requests library HTTP call"),
        (r'httpx\.(get|post|put|delete|patch|head|options|AsyncClient|Client)\s*\(', "httpx library HTTP call"),
        (r'urllib\.request\.(urlopen|urlretrieve|Request)', "urllib outbound request"),
        (r'aiohttp\.ClientSession', "aiohttp outbound session"),
        (r'socket\.connect\s*\(', "Raw socket connection"),
        (r'websockets?\.(connect|serve)', "WebSocket connection"),
        (r'smtplib\.SMTP', "SMTP email connection"),
        (r'ftplib\.FTP', "FTP connection"),
    ]

    # Import patterns that may indicate network usage
    SUSPECT_IMPORTS = {
        "requests": "warning",
        "httpx": "warning",
        "aiohttp": "warning",
        "urllib.request": "warning",
        "smtplib": "critical",
        "ftplib": "critical",
        "paramiko": "critical",
        "boto3": "critical",
        "google.cloud": "critical",
        "azure.storage": "critical",
    }

    def __init__(self, extra_allowed_hosts: list[str] | None = None) -> None:
        self._allowed = set(self.ALLOWED_HOSTS)
        if extra_allowed_hosts:
            self._allowed.update(extra_allowed_hosts)

    def scan_codebase(self, root_path: str) -> list[Violation]:
        """Scan all Python files under *root_path* for air-gap violations."""
        violations: list[Violation] = []
        root = Path(root_path)

        if not root.exists():
            logger.warning("Root path does not exist: %s", root_path)
            return violations

        py_files = sorted(root.rglob("*.py"))
        logger.info("Scanning %d Python files for air-gap violations", len(py_files))

        for py_file in py_files:
            # Skip virtual environments and node_modules
            parts = py_file.parts
            if any(p in (".venv", "venv", "node_modules", "__pycache__", ".git") for p in parts):
                continue

            try:
                source = py_file.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue

            # Regex-based pattern scanning
            for line_num, line in enumerate(source.splitlines(), start=1):
                stripped = line.strip()
                if stripped.startswith("#"):
                    continue
                for pattern, description in self.EXTERNAL_PATTERNS:
                    if re.search(pattern, line):
                        violations.append(
                            Violation(
                                file=str(py_file),
                                line=line_num,
                                description=description,
                                severity="critical",
                            )
                        )

            # AST-based import scanning
            violations.extend(self.scan_imports(str(py_file), source))

        logger.info("Found %d air-gap violations", len(violations))
        return violations

    def scan_imports(self, file_path: str, source: str | None = None) -> list[Violation]:
        """Scan a single file's imports for suspect networking libraries."""
        violations: list[Violation] = []

        if source is None:
            try:
                source = Path(file_path).read_text(encoding="utf-8", errors="ignore")
            except OSError:
                return violations

        try:
            tree = ast.parse(source, filename=file_path)
        except SyntaxError:
            return violations

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    severity = self.SUSPECT_IMPORTS.get(alias.name)
                    if severity:
                        violations.append(
                            Violation(
                                file=file_path,
                                line=node.lineno,
                                description=f"Import of networking library: {alias.name}",
                                severity=severity,
                            )
                        )
            elif isinstance(node, ast.ImportFrom):
                module = node.module or ""
                for suspect, severity in self.SUSPECT_IMPORTS.items():
                    if module == suspect or module.startswith(suspect + "."):
                        violations.append(
                            Violation(
                                file=file_path,
                                line=node.lineno,
                                description=f"Import from networking library: {module}",
                                severity=severity,
                            )
                        )

        return violations
