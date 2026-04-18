"""Bridge to machina-sports/sports-skills soccer data.

Wraps the sports-skills soccer module for fixture schedules,
standings, and team metadata. Falls back gracefully if the
vendor directory is missing.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

SKILLS_DIR = Path(__file__).resolve().parents[4] / "vendor" / "sports-skills"


def is_available() -> bool:
    return (SKILLS_DIR / "skills").exists()


def get_soccer_skill_path() -> Path | None:
    candidates = [
        SKILLS_DIR / "skills" / "soccer",
        SKILLS_DIR / "skills" / "football",
    ]
    for p in candidates:
        if p.exists():
            return p
    # Search for any skill with "soccer" in name
    skills_dir = SKILLS_DIR / "skills"
    if skills_dir.exists():
        for child in skills_dir.iterdir():
            if "soccer" in child.name.lower() or "football" in child.name.lower():
                return child
    return None


def get_available_skills() -> list[str]:
    skills_dir = SKILLS_DIR / "skills"
    if not skills_dir.exists():
        return []
    return [p.name for p in skills_dir.iterdir() if p.is_dir()]


def get_skill_info(skill_name: str) -> dict | None:
    skill_dir = SKILLS_DIR / "skills" / skill_name
    skill_file = skill_dir / "SKILL.md"
    if not skill_file.exists():
        return None
    return {
        "name": skill_name,
        "path": str(skill_dir),
        "has_skill_md": True,
    }
