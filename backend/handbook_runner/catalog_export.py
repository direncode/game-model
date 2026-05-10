"""Export the operator registry as JSON so Plan A's build.py can ingest it.

Usage:
    python -m backend.handbook_runner.catalog_export > tmp/operator-catalog.json
"""
from __future__ import annotations

import json
import sys
from dataclasses import asdict

from backend.handbook_runner.premium_gate import OPERATOR_REGISTRY


def main() -> int:
    payload = {
        name: asdict(spec)
        for name, spec in OPERATOR_REGISTRY.items()
    }
    json.dump(payload, sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
