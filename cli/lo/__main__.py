"""Module entry point for ``python -m lo``.

Lets the CLI run without a pip-installed entry script. The wrappers
(``lo.bat`` and ``lo.ps1`` at the repo root) rely on this; so does
the install-free fallback documented in ``cli/README.md``.
"""
from __future__ import annotations

from .main import app


if __name__ == "__main__":
    app()
