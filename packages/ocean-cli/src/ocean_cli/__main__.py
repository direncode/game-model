"""Allow `python -m ocean_cli ...`."""
from __future__ import annotations

from ocean_cli.main import main

if __name__ == "__main__":
    raise SystemExit(main())
