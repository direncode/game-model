"""Generate a large labeled resolver fixture by sampling the bundled
ontologies and synthesising realistic query variations.

Produces a fixture with N >= 300 queries spanning every resolver stage:

    exact_code       — raw code
    prefix_stripped  — mesh_D..., HS-.., country_..., cpc_.., sic_...
    alias            — canonical alias
    lexical          — canonical name spelling / re-ordering / casing
    fuzzy            — 1-2 char typo of canonical or alias
    unknown          — sampled from adversarial non-ontology strings

Deterministic under seed=42 so the fixture is stable across runs.

Usage:
    python scripts/gen_resolver_fixture.py
    python scripts/gen_resolver_fixture.py --n 500 --out lo_nlp/data/eval_fixture_large.json
"""
from __future__ import annotations

import argparse
import json
import random
import string
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "lo_nlp" / "data"
DEFAULT_OUT = DATA / "eval_fixture_large.json"

# Must match lo_nlp/resolve.py FAMILY_PRIORITY. Kept here because the
# generator needs to predict the resolver's winner on alias collisions.
FAMILY_PRIORITY = ["country", "us_state", "mesh", "sic", "cpc", "hs"]


def _family_rank(family: str) -> int:
    try:
        return FAMILY_PRIORITY.index(family)
    except ValueError:
        return 99

# Map ontology filename -> (family, list-of-prefix-patterns-to-use).
# Prefix patterns mirror the resolver's stripPrefix regex.
FAMILY_PREFIXES = {
    "mesh_top.json": ("mesh", ["mesh_", "mesh-"]),
    "hs_codes.json": ("hs", ["HS-", "commodity_", "hs_"]),
    "sic_codes.json": ("sic", ["sic_", "sic-"]),
    "cpc_classes.json": ("cpc", ["cpc_"]),
    "country_iso.json": ("country", ["country_", "iso_"]),
    "us_states.json": ("us_state", ["region_", "state_"]),
}

ADVERSARIAL_UNKNOWNS = [
    "xjklqwerty", "12345678", "asdfghjkl", "qwertyuiop",
    "randomword", "notarealcode", "foo_bar_baz", "aaaaaa",
    "zzz999zzz", "mesh_ZZZ99999", "HS-99999", "country_XYZ",
    "cpc_ZZ999", "sic_99999", "region_ZZ",
    "lorem ipsum dolor",  "...", "!!!",  "test_test_test",
    "null", "undefined", "none of these",
]


def typo(s: str, rng: random.Random) -> str:
    """Introduce a single realistic typo: insertion, deletion, transposition,
    or replacement. Keep modifications small for short strings."""
    if len(s) < 2:
        return s
    op = rng.choice(["del", "ins", "swap", "sub"])
    i = rng.randrange(len(s))
    if op == "del":
        return s[:i] + s[i + 1:]
    if op == "ins":
        c = rng.choice(string.ascii_lowercase)
        return s[:i] + c + s[i:]
    if op == "swap" and i < len(s) - 1:
        return s[:i] + s[i + 1] + s[i] + s[i + 2:]
    if op == "sub":
        c = rng.choice(string.ascii_lowercase)
        return s[:i] + c + s[i + 1:]
    return s


def case_variant(s: str, rng: random.Random) -> str:
    """Randomly alter casing: upper, lower, title, or unchanged."""
    op = rng.choice(["upper", "lower", "title", "noop", "noop"])
    if op == "upper":
        return s.upper()
    if op == "lower":
        return s.lower()
    if op == "title":
        return s.title()
    return s


def reorder_words(s: str, rng: random.Random) -> str:
    """If multi-word, reverse the order occasionally."""
    parts = s.split()
    if len(parts) >= 2 and rng.random() < 0.3:
        # e.g. "Arthritis, Rheumatoid" -> "Rheumatoid Arthritis"
        return " ".join(reversed([p.strip(",") for p in parts]))
    return s


def build_alias_winner_map(all_rows: list[tuple[dict, str]]) -> dict[str, tuple[str, str]]:
    """alias -> (winning_code, winning_family) using FAMILY_PRIORITY."""
    winners: dict[str, tuple[str, str, int]] = {}
    for row, family in all_rows:
        for a in row.get("aliases") or []:
            key = a.lower()
            rank = _family_rank(family)
            if key not in winners or rank < winners[key][2]:
                winners[key] = (row.get("code", ""), family, rank)
    return {k: (v[0], v[1]) for k, v in winners.items()}


def build_name_winner_map(all_rows: list[tuple[dict, str]]) -> dict[str, tuple[str, str]]:
    """canonical-name -> (winning_code, winning_family) using FAMILY_PRIORITY.

    Used when the same canonical name appears in multiple families
    (e.g. 'Georgia' is both a country and a US state). The resolver's
    lexical pass will tie-break on family priority, so fixture
    expectations have to anticipate that.
    """
    winners: dict[str, tuple[str, str, int]] = {}
    for row, family in all_rows:
        name = row.get("name") or row.get("label") or ""
        if not name:
            continue
        key = name.lower()
        rank = _family_rank(family)
        if key not in winners or rank < winners[key][2]:
            winners[key] = (row.get("code", ""), family, rank)
    return {k: (v[0], v[1]) for k, v in winners.items()}


def gen_from_entry(
    entry: dict, family: str, prefixes: list[str],
    alias_winner: dict[str, tuple[str, str]],
    name_winner: dict[str, tuple[str, str]],
    rng: random.Random,
) -> list[dict]:
    """Produce a diverse set of queries for one ontology entry.

    For alias and fuzzy-of-alias queries, use the global alias_winner map
    so the expected code matches what the resolver will actually return
    under FAMILY_PRIORITY, not the entry that happened to contribute the
    alias.
    """
    code = entry.get("code") or ""
    name = entry.get("name") or entry.get("label") or ""
    aliases = entry.get("aliases") or []
    out: list[dict] = []

    if not code or not name:
        return out

    # exact code
    out.append({
        "query": code, "expect_code": code, "expect_family": family,
        "stage_hint": "exact_code", "notes": "synth: exact code",
    })
    # prefix-stripped (two variants using different separators)
    for pref in prefixes[:2]:
        out.append({
            "query": f"{pref}{code}", "expect_code": code, "expect_family": family,
            "stage_hint": "prefix_stripped",
            "notes": f"synth: prefix={pref}",
        })
    # alias — use the global winner map so expectations match the resolver
    if aliases:
        for a in aliases[:2]:
            win_code, win_family = alias_winner.get(a.lower(), (code, family))
            out.append({
                "query": a, "expect_code": win_code, "expect_family": win_family,
                "stage_hint": "alias",
                "notes": f"synth: alias; contributed by {family}, resolver winner {win_family}",
            })
    # lexical: canonical name with casing / minor re-order. Use the
    # global name_winner map — if another family has the same canonical
    # name with higher priority, the resolver will return that one.
    for _ in range(1):
        variant = case_variant(reorder_words(name, rng), rng)
        win_code, win_family = name_winner.get(name.lower(), (code, family))
        out.append({
            "query": variant, "expect_code": win_code, "expect_family": win_family,
            "stage_hint": "lexical",
            "notes": "synth: name variant"
                     + (f"; name-collision resolver winner {win_family}"
                        if win_family != family else ""),
        })
    # fuzzy: 1-char typo of alias or name. For alias-sourced typos, use
    # the winner map since the resolver's lexical pass will hit whichever
    # entry the alias actually resolves to.
    if aliases and 4 <= len(aliases[0]) <= 40:
        source = aliases[0]
        t = typo(source, rng)
        if t != source:
            win_code, win_family = alias_winner.get(source.lower(), (code, family))
            out.append({
                "query": t, "expect_code": win_code, "expect_family": win_family,
                "stage_hint": "fuzzy",
                "notes": f"synth: typo of alias {source!r}",
            })
    elif name and 4 <= len(name) <= 40:
        # Name-typo expectation also follows name_winner (priority-aware).
        t = typo(name, rng)
        if t != name:
            win_code, win_family = name_winner.get(name.lower(), (code, family))
            out.append({
                "query": t, "expect_code": win_code, "expect_family": win_family,
                "stage_hint": "fuzzy",
                "notes": f"synth: typo of name {name!r}",
            })
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=300,
                    help="Target minimum number of queries (actual may exceed)")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    args = ap.parse_args()

    rng = random.Random(args.seed)
    queries: list[dict] = []

    # First pass: build the global alias → winning-entry map (required
    # to emit alias/fuzzy queries with expectations that match the
    # resolver's FAMILY_PRIORITY tie-breaking).
    all_rows: list[tuple[dict, str]] = []
    family_rows: dict[str, list[dict]] = {}
    for fname, (family, _prefixes) in FAMILY_PREFIXES.items():
        path = DATA / fname
        rows = json.loads(path.read_text(encoding="utf-8"))
        for r in rows:
            # Respect explicit family in the row
            fam = r.get("family") or family
            if fam == family:
                all_rows.append((r, family))
                family_rows.setdefault(family, []).append(r)

    alias_winner = build_alias_winner_map(all_rows)
    name_winner = build_name_winner_map(all_rows)

    # Balanced sample across families so every family gets coverage.
    per_family_target = max(args.n // 6, 20)

    for fname, (family, prefixes) in FAMILY_PREFIXES.items():
        rows = list(family_rows.get(family, []))
        rng.shuffle(rows)
        fam_queries: list[dict] = []
        for row in rows:
            fam_queries.extend(gen_from_entry(row, family, prefixes, alias_winner, name_winner, rng))
            if len(fam_queries) >= per_family_target:
                break
        queries.extend(fam_queries[:per_family_target])

    # Unknowns: hand-curated adversarial strings + generated gibberish
    unknowns = list(ADVERSARIAL_UNKNOWNS)
    for _ in range(15):
        length = rng.randint(5, 15)
        unknowns.append("".join(rng.choice(string.ascii_lowercase) for _ in range(length)))
    rng.shuffle(unknowns)
    for u in unknowns[:30]:
        queries.append({
            "query": u, "expect_code": None, "expect_family": None,
            "stage_hint": "unknown", "notes": "synth: adversarial unknown",
        })

    # Stable order: sort by stage_hint then query for deterministic output
    queries.sort(key=lambda q: (q["stage_hint"], q["query"]))

    out_path = Path(args.out)
    out_path.write_text(
        json.dumps(queries, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {out_path}  n={len(queries)}")

    # Breakdown by stage
    from collections import Counter
    c = Counter(q["stage_hint"] for q in queries)
    for stage, count in sorted(c.items()):
        print(f"  {stage:<18} {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
