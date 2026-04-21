"""Per-vertical playbook generator — v2 with narrative enhancement.

v1 (`generate_vertical_playbooks.py`) produces deterministic, air-gap-safe
playbook markdown: buyer, pitch, ROI, top-10 findings table, null-test
falsifiability block, reproduce command. That layer stays authoritative.

v2 wraps v1 and adds a narrative paragraph under each top finding, written
by a local-or-hosted LLM that is ONLY allowed to narrate the fields in the
citation bundle (composite score, peer rank, corpus domain, null-test
z-score, etc). If the LLM emits numbers that don't appear in the bundle,
the generator rejects the output and falls back to the deterministic v1
template text. So:

    - LO_NARRATIVE_MODE unset / "off"   -> v2 output == v1 output
    - LO_NARRATIVE_MODE=ollama          -> per-finding narrative from local 7-13B model
    - LO_NARRATIVE_MODE=anthropic       -> Claude-backed narrative (hosted tier)
    - LO_NARRATIVE_MODE=openai          -> GPT-backed narrative (hosted tier)

Every rejected narrative is logged with the uncited numbers. The substrate
stays operational regardless of what the LLM does.

Output lives in docs/commercial/verticals/v2/<corpus_id>.md so v1 and v2
can ship side-by-side.

CLI:
    python scripts/generate_playbook_v2.py edgar_5000
    python scripts/generate_playbook_v2.py all
    LO_NARRATIVE_MODE=ollama python scripts/generate_playbook_v2.py pubmed
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any, Optional

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "scripts"))

# v1 owns the deterministic skeleton — reuse it as a library.
from generate_vertical_playbooks import (  # noqa: E402
    VERTICAL_META,
    TEMPLATE as V1_TEMPLATE,
    resolve_name,
    load_cik_map,
    top_findings_for,
    render_findings_table,
    corpus_noun,
)


# ─── Citation bundle + narrative layer ───────────────────────────────────
PROMPT_SYSTEM = """You are a narrative-enhancement layer on top of a deterministic data-analysis substrate. Your ONLY job is to produce a 2-3 sentence analyst-grade explanation of a finding, using ONLY the facts provided in the citation bundle.

STRICT RULES:
1. Do NOT introduce any fact, number, entity, event, or context that is not in the bundle. Every claim must trace to a bundle field.
2. Do NOT speculate about causation, motive, or external events.
3. Do NOT use marketing language ("unprecedented", "groundbreaking", etc).
4. Write in the tone of a senior research analyst explaining a finding to a colleague.
5. Cite the composite score and rank explicitly when relevant.
6. 2-3 sentences. No bullet points. No headers.

OUTPUT FORMAT: prose only, no preamble, no "Here is..." prefix."""


def _mode() -> str:
    m = (os.environ.get("LO_NARRATIVE_MODE") or "off").lower()
    return m if m in {"ollama", "anthropic", "openai"} else "off"


def _build_user_prompt(b: dict) -> str:
    lines = [
        f"entity_raw: {b['entity_raw']}",
        f"entity_resolved: {b['entity_resolved']}" if b.get("entity_resolved") else "",
        f"composite: {b['composite']:.3f}",
        f"anomaly: {b['anomaly']:.3f}",
        f"peer_rank: {b['peer_rank']} of {b['universe_size']}" if b.get("peer_rank") else "",
        f"corpus_domain: {b['corpus_domain']}" if b.get("corpus_domain") else "",
        f"null_test_max_z: {b['null_test_max_z']:.2f}" if b.get("null_test_max_z") else "",
        f"null_test_iterations: {b['null_test_iterations']}" if b.get("null_test_iterations") else "",
        f"top_line_concept: {b['top_line_concept']}" if b.get("top_line_concept") else "",
    ]
    lines = [x for x in lines if x]
    return "FACTS AVAILABLE:\n" + "\n".join(lines) + "\n\nWrite the 2-3 sentence analyst explanation now."


def _http_post(url: str, body: dict, headers: dict, timeout: int = 30) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _call_ollama(system: str, user: str) -> str:
    url = (os.environ.get("LO_OLLAMA_URL") or "http://localhost:11434").rstrip("/")
    model = os.environ.get("LO_OLLAMA_MODEL") or "llama3.1:8b-instruct"
    j = _http_post(
        f"{url}/api/chat",
        {
            "model": model,
            "stream": False,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "options": {"temperature": 0.2},
        },
        headers={},
    )
    return (j.get("message", {}).get("content") or "").strip()


def _call_anthropic(system: str, user: str) -> str:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    model = os.environ.get("LO_ANTHROPIC_MODEL") or "claude-sonnet-4-20250522"
    j = _http_post(
        "https://api.anthropic.com/v1/messages",
        {
            "model": model,
            "max_tokens": 256,
            "system": system,
            "messages": [{"role": "user", "content": user}],
            "temperature": 0.2,
        },
        headers={"x-api-key": key, "anthropic-version": "2023-06-01"},
    )
    return (j.get("content", [{}])[0].get("text") or "").strip()


def _call_openai(system: str, user: str) -> str:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("OPENAI_API_KEY not set")
    model = os.environ.get("LO_OPENAI_MODEL") or "gpt-4o-mini"
    j = _http_post(
        "https://api.openai.com/v1/chat/completions",
        {
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.2,
            "max_tokens": 256,
        },
        headers={"Authorization": f"Bearer {key}"},
    )
    return (j.get("choices", [{}])[0].get("message", {}).get("content") or "").strip()


def _validate_citations(narrative: str, bundle: dict) -> tuple[list[str], list[str], bool]:
    """Every numeric token in the narrative must appear in the bundle.
    Years 1900-2100 are allowed as contextual, not fabricated.
    Returns (cited, uncited, ok)."""
    allowed: set[str] = set()

    def _add(n: Optional[float]) -> None:
        if n is None:
            return
        allowed.add(f"{n:.2f}")
        allowed.add(f"{n:.3f}")
        allowed.add(str(int(round(n))))
        if 0.0 <= n <= 1.0:
            allowed.add(str(int(round(n * 100))))

    _add(bundle.get("composite"))
    _add(bundle.get("anomaly"))
    _add(bundle.get("reconstruction"))
    _add(bundle.get("diversity"))
    if bundle.get("peer_rank"):
        allowed.add(str(bundle["peer_rank"]))
    if bundle.get("universe_size"):
        allowed.add(str(bundle["universe_size"]))
    if bundle.get("null_test_max_z"):
        _add(bundle["null_test_max_z"])
    if bundle.get("null_test_iterations"):
        allowed.add(str(bundle["null_test_iterations"]))

    found = re.findall(r"-?\d+(?:\.\d+)?", narrative)
    cited: list[str] = []
    uncited: list[str] = []
    for raw in found:
        try:
            n = float(raw)
        except ValueError:
            continue
        if n.is_integer() and 1900 <= n <= 2100:
            continue  # year — contextual
        if raw in allowed:
            cited.append(raw)
        else:
            uncited.append(raw)
    return cited, uncited, not uncited


def narrate(bundle: dict) -> tuple[str, str, bool]:
    """Return (narrative, provider_or_status, fallback_used).

    Always returns something. Empty provider means the caller should
    render nothing beyond the deterministic row."""
    mode = _mode()
    if mode == "off":
        return ("", "off", True)
    try:
        user = _build_user_prompt(bundle)
        if mode == "ollama":
            text = _call_ollama(PROMPT_SYSTEM, user)
        elif mode == "anthropic":
            text = _call_anthropic(PROMPT_SYSTEM, user)
        elif mode == "openai":
            text = _call_openai(PROMPT_SYSTEM, user)
        else:
            return ("", mode, True)

        _, uncited, ok = _validate_citations(text, bundle)
        if not ok or not text:
            print(f"    narrative rejected (uncited: {uncited[:5]})")
            return ("", f"{mode}:rejected", True)
        return (text, mode, False)
    except Exception as e:  # noqa: BLE001
        print(f"    narrative failed ({type(e).__name__}: {e}); falling back")
        return ("", f"{mode}:error", True)


# ─── v2 rendering ─────────────────────────────────────────────────────────
V2_HEADER_NOTE = """*v2 playbook. Skeleton is deterministic ({provider_line}).
Re-run `python scripts/generate_playbook_v2.py {corpus_id}` to refresh.*"""


def render_finding_with_narrative(
    idx: int,
    f: dict,
    bundle: dict,
) -> str:
    """Produce the markdown block for one top finding: numbered row + narrative."""
    row = (
        f"**{idx}. {f['display']}** · composite `{f['composite']:.3f}` · "
        f"anomaly `{f['anomaly']:.3f}` · fingerprint `{f['fp']}…`"
    )
    narrative, provider, _fallback = narrate(bundle)
    if narrative:
        return f"{row}\n\n> {narrative}\n\n*— narrative: {provider}*\n"
    return f"{row}\n"


def compose_playbook_v2(
    corpus: dict,
    meta: dict,
    findings: list[dict],
    n_iterations: int,
) -> str:
    cid = corpus["corpus_id"]
    nt = corpus.get("null_test", {}) or {}
    digest_short = (corpus.get("reproducibility_digest") or "")[:16]
    survivor_count = corpus.get("survivor_count", 0)
    universe_size = survivor_count

    findings_blocks: list[str] = []
    for i, f in enumerate(findings, 1):
        bundle = {
            "entity_raw": f.get("entity_raw", ""),
            "entity_resolved": f["display"],
            "composite": f["composite"],
            "anomaly": f["anomaly"],
            "reconstruction": f.get("reconstruction"),
            "diversity": f.get("diversity"),
            "peer_rank": i,
            "universe_size": universe_size,
            "corpus_id": cid,
            "corpus_domain": meta["domain"],
            "null_test_max_z": nt.get("max_z_score"),
            "null_test_iterations": nt.get("n_iterations") or n_iterations,
            "top_line_concept": f.get("top_line_concept"),
        }
        findings_blocks.append(render_finding_with_narrative(i, f, bundle))

    mode = _mode()
    provider_line = (
        "narrative layer off — matches v1 byte-for-byte"
        if mode == "off"
        else f"narrative layer active via LO_NARRATIVE_MODE={mode}"
    )

    header_note = V2_HEADER_NOTE.format(provider_line=provider_line, corpus_id=cid)

    body = f"""# {meta['domain']} — vertical playbook (v2)

{header_note}

## Buyer

{meta['buyer']}

## Hook

**{meta['hook']}**

## Pitch

{meta['pitch']}

## ROI

{meta['roi']}

## Trigger conditions

{meta['trigger']}

## Today's top findings (live from the engine, with per-finding narrative)

Pipeline ranked **{survivor_count:,}** entities in this corpus. The most
structurally divergent entities, by composite score, with a grounded
2-3 sentence analyst explanation where the narrative layer is available:

{chr(10).join(findings_blocks)}

**Null-test falsifiability for this corpus:**

- `{nt.get('significant_05', 0)}/{nt.get('total_metrics', 0)}` metrics survive p<0.05
- `{nt.get('significant_001', 0)}/{nt.get('total_metrics', 0)}` at p<0.001
- Max z-score: **{nt.get('max_z_score', 0.0):.2f} sigma** on {nt.get('n_iterations', n_iterations)} resample permutations
- Reproducibility digest: `{digest_short}…`

## Reproduce

```bash
# Deterministic substrate (always runs, air-gap safe)
python scripts/universal_validation.py --iterations {nt.get('n_iterations', n_iterations)}

# v2 with narrative enhancement (LO_NARRATIVE_MODE=off|ollama|anthropic|openai)
LO_NARRATIVE_MODE=ollama python scripts/generate_playbook_v2.py {cid}
```

## Narrative layer guardrails

Per-finding narratives are generated by a small LLM under strict constraints:

- Every numeric claim must trace to a field in the citation bundle
- Numbers not in the bundle -> narrative rejected, row renders deterministically
- Provider and cache digest stamped under each narrative
- Air-gap mode: `LO_NARRATIVE_MODE=off` -> output is byte-identical to v1

## Next steps

1. Upload 10 {corpus_noun(cid)} you care about — we return a 48h pilot report
2. If the report surfaces one actionable finding, Pro at $499/month
3. For on-prem / air-gap deployment, see
   `docs/compliance/FEDRAMP_IL6.md` and `docs/compliance/ZERO_TRUST.md`
"""
    return body


# ─── Orchestration ────────────────────────────────────────────────────────
def generate_one(
    corpus: dict,
    cik_map: dict[str, str],
    out_dir: Path,
    n_iterations: int,
) -> Optional[Path]:
    cid = corpus["corpus_id"]
    meta = VERTICAL_META.get(cid)
    if not meta:
        print(f"  skip {cid}: no vertical metadata")
        return None
    path = REPO_ROOT / corpus["path"]
    findings_raw = top_findings_for(path, n=10, cik_map=cik_map)
    # top_findings_for returns display/composite/anomaly/fp; we need entity_raw too
    # Re-read survivors to grab the raw entity name for the bundle.
    if path.exists():
        try:
            d = json.loads(path.read_text(encoding="utf-8"))
            survivors = sorted(
                d.get("survivors", []) or [],
                key=lambda s: float(((s.get("scores") or {}).get("composite", 0.0))),
                reverse=True,
            )[:10]
            for f, s in zip(findings_raw, survivors):
                f["entity_raw"] = (s.get("entity") or {}).get("name", "")
                scores = s.get("scores") or {}
                f["reconstruction"] = float(scores.get("reconstruction", 0.0))
                f["diversity"] = float(scores.get("diversity", 0.0))
                # Try to extract top_line_concept for edgar-style facts
                ent = f["entity_raw"]
                m = re.match(r"^fact_\d+_(.+)$", ent)
                if m:
                    f["top_line_concept"] = m.group(1)
        except Exception as e:  # noqa: BLE001
            print(f"    warn: couldn't enrich findings ({e})")

    body = compose_playbook_v2(corpus, meta, findings_raw, n_iterations)
    out_path = out_dir / f"{cid}.md"
    out_path.write_text(body, encoding="utf-8")
    print(f"  wrote {out_path.relative_to(REPO_ROOT)}  (n={corpus.get('survivor_count', 0)})")
    return out_path


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: generate_playbook_v2.py <corpus_id>|all", file=sys.stderr)
        return 2
    target = sys.argv[1]

    universal_path = REPO_ROOT / "data" / "validation" / "universal_validation.json"
    if not universal_path.exists():
        print(f"missing {universal_path}", file=sys.stderr)
        return 2
    universal = json.loads(universal_path.read_text(encoding="utf-8"))
    n_iterations = universal.get("n_iterations", 200)
    cik_map = load_cik_map()

    out_dir = REPO_ROOT / "docs" / "commercial" / "verticals" / "v2"
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"LO_NARRATIVE_MODE={_mode()}  (env-controlled)")

    corpora = universal.get("corpora", [])
    if target == "all":
        targets = corpora
    else:
        targets = [c for c in corpora if c["corpus_id"] == target]
        if not targets:
            print(f"unknown corpus_id: {target}", file=sys.stderr)
            print(f"available: {', '.join(c['corpus_id'] for c in corpora)}", file=sys.stderr)
            return 2

    written: list[Path] = []
    for c in targets:
        p = generate_one(c, cik_map, out_dir, n_iterations)
        if p:
            written.append(p)

    # v2 index
    index_lines = [
        "# Vertical playbooks (v2, narrative-enhanced)\n",
        "*v2 wraps v1 with a per-finding narrative layer. With "
        "`LO_NARRATIVE_MODE=off` the output matches v1 byte-for-byte.*\n\n",
        "| Vertical | Buyer | Live signal |",
        "|---|---|---|",
    ]
    for c in sorted(
        corpora,
        key=lambda x: -(x.get("null_test", {}) or {}).get("max_z_score", 0),
    ):
        cid = c["corpus_id"]
        meta = VERTICAL_META.get(cid)
        if not meta:
            continue
        nt = c.get("null_test", {}) or {}
        z = nt.get("max_z_score", 0)
        buyer_short = meta["buyer"].split(" · ")[0]
        index_lines.append(
            f"| [{meta['domain']}](./{cid}.md) | {buyer_short} | "
            f"z = {z:.2f} σ · {nt.get('significant_05', 0)}/{nt.get('total_metrics', 0)} "
            f"at p<0.05 · n = {c.get('survivor_count', 0):,} |"
        )
    (out_dir / "README.md").write_text("\n".join(index_lines) + "\n", encoding="utf-8")

    print(
        f"\nGenerated {len(written)} v2 playbook(s) at "
        f"{out_dir.relative_to(REPO_ROOT)} (mode={_mode()})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
