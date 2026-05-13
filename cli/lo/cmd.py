"""``lo cmd`` — interactive Command Prompt menu (claude-cmd style).

Run with::

    lo cmd
    python -m lo cmd
    python -m lo.cmd

Renders a big ASCII title, then a sectioned, arrow-key-navigable menu
of every OCEAN operator + stdlib preset. Selecting an operator inserts
its canonical snippet into the in-memory program buffer; selecting a
sample loads a runnable program + corpus; selecting "Run" executes the
buffer in-process against the local engine and prints the artifact
SHA + module summary.

Cross-platform key polling: ``msvcrt`` on Windows, ``termios``+``select``
on POSIX. No third-party TUI dependency.

The menu items are stitched from two sources:

  - ``_OPERATOR_CATALOG`` and ``_STDLIB_PRESETS`` mirrored from
    ``backend/app/api/v1/ocean_run.py`` (same handbook source of truth)
  - The five bundled corpora under ``cli/lo/demo/corpora/`` (so the
    "Run a sample" path doesn't require any network).
"""
from __future__ import annotations

import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

from rich.align import Align
from rich.console import Console, Group
from rich.live import Live
from rich.panel import Panel
from rich.rule import Rule
from rich.text import Text


# Monochrome xAI/Grok palette mirror of frontend/tailwind.config.ts —
# pure white as the primary accent, dim greys for secondary text, gold
# warm-contrast (#c9a96e) reserved for hashes / italicized brand marks,
# scientific green for "free" badges, cyan for active states.
_PALETTE = {
    "primary":  "bold white",
    "dim":      "color(243)",   # ~#9a9a9a
    "muted":    "color(241)",   # ~#737373
    "tertiary": "color(244)",   # ~#808080
    "warm":     "#c9a96e",
    "green":    "#3fb950",
    "red":      "#f85149",
    "cyan":     "#00d4ff",
    "border":   "color(236)",
}

# Editorial serif headline — the same shape the website uses for its
# hero (no orange Claude-CMD-style ASCII art).
_HEADLINE_PRIMARY = "OCEAN"
_HEADLINE_ACCENT  = "runtime"


# ── Menu model ──────────────────────────────────────────────────────────

@dataclass
class MenuItem:
    """A single row in the menu."""
    label:       str
    section:     str
    badge:       str = ""                # "free" | "premium" | "stub" | "sample" | ""
    hint:        str = ""
    on_enter:    Optional[Callable[["AppState"], None]] = None
    is_header:   bool = False
    icon:        str = " "


# Catalog mirror of backend/app/api/v1/ocean_run.py:_OPERATOR_CATALOG.
# Kept in sync manually so the Python CLI works with no backend running.
_OPS: list[dict] = [
    # ── free-tier ─────────────────────────────────────────────
    {"kind": "source.ndjson",                "verb": "load",    "tier": "free",
     "icon": "□", "io": "Path → Records",
     "snippet": "load corpus.ndjson take 100 records balanced by label label field is label",
     "summary": "Load NDJSON corpus, optionally stratified."},
    {"kind": "embed.tfidf_jl",               "verb": "embed",   "tier": "free",
     "icon": "▤", "io": "Records → Z",
     "snippet": "embed text into 64 dimensions using tf-idf",
     "summary": "TF-IDF + JL random projection."},
    {"kind": "embed.transformer.minilm_l6",  "verb": "embed",   "tier": "free",
     "icon": "▤", "io": "Records → Z",
     "snippet": "embed text into 384 dimensions using transformer minilm_l6",
     "summary": "MiniLM-L6 sentence transformer (384 dims)."},
    {"kind": "embed.onehot_numeric",         "verb": "embed",   "tier": "free",
     "icon": "▤", "io": "Records → Z",
     "snippet": "embed text using one-hot numeric",
     "summary": "One-hot encoder for numeric / categorical fields."},
    {"kind": "reduce.stratified",            "verb": "reduce",  "tier": "free",
     "icon": "▼", "io": "Records → Records",
     "snippet": "reduce to 100 records using stratified",
     "summary": "Deterministic stratified-by-label sample."},
    {"kind": "cluster.kmeans",               "verb": "cluster", "tier": "free",
     "icon": "◉", "io": "Z → Modules",
     "snippet": "cluster for 8 rounds max 8 modules using kmeans",
     "summary": "sklearn KMeans with deterministic random_state."},
    {"kind": "cluster.hamming",              "verb": "cluster", "tier": "free",
     "icon": "◉", "io": "Z_FP48 → Modules",
     "snippet": "cluster using hamming",
     "summary": "Hamming-distance clusterer for fp48 fingerprints."},
    {"kind": "align.module",                 "verb": "align",   "tier": "free",
     "icon": "◇", "io": "(Modules,Records,Z) → Aligned",
     "snippet": "align modules using 10 nearest records",
     "summary": "Per-module K-NN with dominant-label tally."},
    {"kind": "find.dispersion_per_label",    "verb": "find",    "tier": "free",
     "icon": "◈", "io": "(Aligned,Records,Z) → Dispersion",
     "snippet": "find dispersion of each label",
     "summary": "Per-label routing: where do labels land?"},
    {"kind": "narrate.plain_english",        "verb": "narrate", "tier": "free",
     "icon": "▶", "io": "Aligned → Aligned",
     "snippet": "narrate every module using plain english",
     "summary": "Deterministic per-module template narration."},
    {"kind": "narrate.llm_summary",          "verb": "narrate", "tier": "free",
     "icon": "▶", "io": "Aligned → Aligned",
     "snippet": "narrate every module using llm",
     "summary": "Anthropic-API narration (requires ANTHROPIC_API_KEY)."},
    {"kind": "persist.json",                 "verb": "save",    "tier": "free",
     "icon": "↧", "io": "Any → Artifact",
     "snippet": "save to result.json",
     "summary": "Write JSON artifact + SHA-256 sidecar."},

    # ── premium ───────────────────────────────────────────────
    {"kind": "embed.content_fp48",           "verb": "embed",   "tier": "premium",
     "icon": "▦", "io": "Records → Z_FP48",
     "snippet": "embed text using content fingerprint",
     "summary": "Bloom-style 48-bit content fingerprint (premium)."},
    {"kind": "reduce.btut",                  "verb": "reduce",  "tier": "premium",
     "icon": "▼", "io": "(Z,Records) → (Z,Records)",
     "snippet": "reduce records using btut target 300 survivors budget $5",
     "summary": "8-tier BTUT lattice-threading reduction (premium)."},
    {"kind": "cluster.tcd_recursive_loop",   "verb": "cluster", "tier": "premium",
     "icon": "◉", "io": "Z → Modules",
     "snippet": "cluster for 16 rounds max 24 modules using tcd recursive loop",
     "summary": "TCD-JEPA recursive loop with persistent-homology (premium)."},
    {"kind": "align.dispersion",             "verb": "align",   "tier": "premium",
     "icon": "◇", "io": "(Modules,Records,Z) → Aligned",
     "snippet": "align modules using 10 nearest records (premium: dispersion-weighted)",
     "summary": "Dispersion-weighted alignment (premium)."},
]


_STDLIB: list[dict] = [
    {"ns": "substrate", "preset": "basic_run",             "tier": "free",
     "summary": "Canonical free-tier pipeline against any NDJSON corpus."},
    {"ns": "substrate", "preset": "seed_sweep",            "tier": "free",
     "summary": "Sweep seeds 42-46 and emit a SHA per seed."},
    {"ns": "substrate", "preset": "anomaly_focused",       "tier": "free",
     "summary": "Cluster around the 'normal' label as energy anchor."},
    {"ns": "substrate", "preset": "content_vs_structural", "tier": "free",
     "summary": "Compare TF-IDF embedding vs content-fingerprint."},
    {"ns": "pulse",     "preset": "uspto",                  "tier": "free",
     "summary": "USPTO patent abstracts (500 records). Bundled."},
    {"ns": "pulse",     "preset": "uspto_pro",              "tier": "premium",
     "summary": "USPTO with BTUT + TCD chain (premium)."},
    {"ns": "atlas",     "preset": "arxiv",                  "tier": "free",
     "summary": "arXiv scientific abstracts (500 records). Bundled."},
    {"ns": "atlas",     "preset": "arxiv_pro",              "tier": "premium",
     "summary": "arXiv with premium operator chain."},
    {"ns": "receipt",   "preset": "edgar",                  "tier": "free",
     "summary": "EDGAR financial filings (500 records). Bundled."},
    {"ns": "receipt",   "preset": "edgar_pro",              "tier": "premium",
     "summary": "EDGAR with premium operator chain."},
    {"ns": "docsouth",  "preset": "narratives",             "tier": "free",
     "summary": "DocSouth historical narratives (200 records). Bundled."},
    {"ns": "docsouth",  "preset": "narratives_pro",         "tier": "premium",
     "summary": "DocSouth with premium operator chain."},
    {"ns": "titan",     "preset": "benchmark",              "tier": "free",
     "summary": "TITAN benchmark corpus (300 records). Bundled."},
    {"ns": "titan",     "preset": "benchmark_pro",          "tier": "premium",
     "summary": "TITAN with premium operator chain."},
    {"ns": "universal", "preset": "substrate",              "tier": "free",
     "summary": "Cross-domain substrate sample (400 records). Bundled."},
    {"ns": "universal", "preset": "substrate_pro",          "tier": "premium",
     "summary": "Universal substrate with premium operators."},
]


# ── App state ───────────────────────────────────────────────────────────

@dataclass
class AppState:
    """In-memory state the menu reads + mutates."""
    program: str = ""
    corpus_path: Optional[Path] = None
    corpus_id: Optional[str] = None         # which bundled sample is loaded
    last_message: str = ""
    last_sha: str = ""
    last_golden_status: str = ""            # "" | "match" | "drift:<exp8>:<got8>"
    quit: bool = False


# ── Key polling (cross-platform) ───────────────────────────────────────

if os.name == "nt":
    import msvcrt

    def read_key() -> str:
        """Block on a keypress, return a normalized name."""
        ch = msvcrt.getch()
        if ch in (b"\x00", b"\xe0"):
            ch2 = msvcrt.getch()
            return {
                b"H": "up",   b"P": "down",
                b"K": "left", b"M": "right",
            }.get(ch2, "")
        if ch in (b"\r", b"\n"): return "enter"
        if ch == b"\x03":         return "ctrl-c"  # ^C
        if ch == b"\x1b":         return "esc"
        try:
            return ch.decode("utf-8", errors="replace")
        except Exception:
            return ""
else:
    import select
    import termios
    import tty

    def read_key() -> str:
        fd = sys.stdin.fileno()
        old = termios.tcgetattr(fd)
        try:
            tty.setraw(fd)
            ch = sys.stdin.read(1)
            if ch == "\x1b":
                # Escape sequence — could be arrow key.
                r, _, _ = select.select([sys.stdin], [], [], 0.05)
                if r:
                    seq = sys.stdin.read(2)
                    return {
                        "[A": "up",   "[B": "down",
                        "[D": "left", "[C": "right",
                    }.get(seq, "esc")
                return "esc"
            if ch in ("\r", "\n"): return "enter"
            if ch == "\x03":        return "ctrl-c"
            return ch
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old)


# ── Menu construction ──────────────────────────────────────────────────

def _make_op_handler(op: dict):
    snippet = op["snippet"]
    kind = op["kind"]
    def _insert(state: AppState) -> None:
        sep = "\n" if (state.program and not state.program.endswith("\n")) else ""
        state.program += sep + snippet + "\n"
        state.last_message = f"inserted {kind}"
    return _insert


def _make_preset_handler(preset: dict):
    label = f"{preset['ns']}.{preset['preset']}"
    def _msg(state: AppState) -> None:
        state.last_message = (
            f"{label} · run via `ocean run {label}` in the CLI · "
            f"{preset['summary']}"
        )
    return _msg


CANONICAL_SAMPLE_PROGRAM = (
    "seed 42\n"
    "load corpus.ndjson take 80 records balanced by label label field is label\n"
    "embed text into 32 dimensions using tf-idf\n"
    "cluster for 4 rounds max 4 modules using kmeans\n"
    "align modules using 5 nearest records\n"
    "find dispersion of each label\n"
    "save to result.json\n"
)


def _golden_path() -> Path:
    return Path(__file__).resolve().parent / "demo" / "golden.json"


def _load_cmd_pin(corpus_id: str) -> Optional[dict]:
    """Return the pinned cmd_samples entry for `corpus_id`, or None."""
    try:
        import json as _json
        data = _json.loads(_golden_path().read_text(encoding="utf-8"))
        return (data.get("cmd_samples") or {}).get(corpus_id)
    except (OSError, ValueError):
        return None


def _make_sample_handler(corpus_id: str):
    def _load(state: AppState) -> None:
        corpora_root = Path(__file__).resolve().parent / "demo" / "corpora"
        candidate = corpora_root / corpus_id / "source.ndjson"
        if not candidate.exists():
            state.last_message = f"bundled corpus missing: {candidate}"
            return
        state.program = CANONICAL_SAMPLE_PROGRAM
        state.corpus_path = candidate
        state.corpus_id = corpus_id
        state.last_golden_status = ""
        state.last_message = f"loaded sample corpus {corpus_id} ({candidate.name})"
    return _load


def _action_clear(state: AppState) -> None:
    state.program = ""
    state.corpus_path = None
    state.corpus_id = None
    state.last_golden_status = ""
    state.last_message = "cleared program + corpus"


def _action_run(state: AppState) -> None:
    if not state.program.strip():
        state.last_message = "program buffer is empty — pick an operator or sample first"
        return
    if not state.corpus_path:
        state.last_message = "no corpus loaded — pick a sample first"
        return
    try:
        from .demo.runner import run_program
        import tempfile
        with tempfile.TemporaryDirectory(prefix="lo-cmd-") as td:
            tdp = Path(td)
            prog_path = tdp / "program.ocean"
            prog_path.write_text(state.program, encoding="utf-8")
            # Copy/normalize the corpus into the work dir.
            corpus_dst = tdp / "corpus.ndjson"
            corpus_dst.write_bytes(state.corpus_path.read_bytes())
            result = run_program(
                program_path=prog_path,
                corpus_path=corpus_dst,
                work_dir=tdp,
                seed=42,
            )
        if result.succeeded():
            state.last_sha = result.artifact_sha256
            state.last_message = (
                f"run OK · sha {result.artifact_sha256[:8]}… · "
                f"{result.n_modules} modules · {result.wall_seconds:.2f}s"
            )
            state.last_golden_status = ""
            if state.corpus_id and state.program == CANONICAL_SAMPLE_PROGRAM:
                pin = _load_cmd_pin(state.corpus_id)
                if pin and pin.get("artifact_sha256"):
                    if pin["artifact_sha256"] == result.artifact_sha256:
                        state.last_golden_status = "match"
                    else:
                        state.last_golden_status = (
                            f"drift:{pin['artifact_sha256'][:8]}:"
                            f"{result.artifact_sha256[:8]}"
                        )
        else:
            tail = (result.stderr or "")[-180:]
            state.last_message = f"run FAILED · {tail}"
    except Exception as e:  # noqa: BLE001
        state.last_message = f"run crashed: {type(e).__name__}: {e}"


def _action_quit(state: AppState) -> None:
    state.quit = True


def build_menu() -> list[MenuItem]:
    items: list[MenuItem] = []

    def hdr(text: str) -> None:
        items.append(MenuItem(label=text, section="header", is_header=True))

    hdr("Operators (free-tier)")
    for op in (o for o in _OPS if o["tier"] == "free"):
        items.append(MenuItem(
            label=op["kind"],
            section="ops_free",
            badge="free",
            hint=f"{op['summary']} · {op['io']}",
            icon=op["icon"],
            on_enter=_make_op_handler(op),
        ))

    hdr("Operators (premium · API key)")
    for op in (o for o in _OPS if o["tier"] == "premium"):
        items.append(MenuItem(
            label=op["kind"],
            section="ops_prem",
            badge="premium",
            hint=f"{op['summary']} · {op['io']}",
            icon=op["icon"],
            on_enter=_make_op_handler(op),
        ))

    hdr("Stdlib presets")
    for p in _STDLIB:
        items.append(MenuItem(
            label=f"{p['ns']}.{p['preset']}",
            section="stdlib",
            badge=p["tier"],
            hint=p["summary"],
            icon="◌",
            on_enter=_make_preset_handler(p),
        ))

    hdr("Bundled corpora (loadable)")
    for cid in ("patents", "edgar", "docsouth", "arxiv", "substrate"):
        items.append(MenuItem(
            label=f"sample · {cid}",
            section="samples",
            badge="sample",
            hint=f"loads cli/lo/demo/corpora/{cid}/source.ndjson + a canonical program",
            icon="▣",
            on_enter=_make_sample_handler(cid),
        ))

    hdr("Actions")
    items.append(MenuItem(label="▶ run pipeline",     section="actions",
                          icon="▶", hint="execute the current program + corpus",
                          on_enter=_action_run))
    items.append(MenuItem(label="✕ clear buffer",     section="actions",
                          icon="✕", hint="reset program + corpus",
                          on_enter=_action_clear))
    items.append(MenuItem(label="↺ quit",             section="actions",
                          icon="↺", hint="exit lo cmd",
                          on_enter=_action_quit))

    return items


# ── Rendering ──────────────────────────────────────────────────────────

def _badge_style(badge: str) -> str:
    return {
        "free":    _PALETTE["green"],
        "premium": _PALETTE["warm"],
        "stub":    _PALETTE["muted"],
        "sample":  _PALETTE["cyan"],
    }.get(badge, "white")


def _selectable_indices(items: list[MenuItem]) -> list[int]:
    return [i for i, m in enumerate(items) if not m.is_header]


def render(state: AppState, items: list[MenuItem], cursor: int, console: Console) -> Group:
    """Return a Rich Group for the full screen.

    Layout mirrors the website (monochrome xAI/Grok style):
        latent /italic/ OCEAN runtime           ← serif-style headline
        dense lede                              ← single-line lede
        ── operators · open core ──             ← uppercase mono section
          › kind                  FREE          ← row
          …
    """
    headline = Text()
    headline.append("latent ", style="dim italic")
    headline.append("OCEAN ", style=_PALETTE["primary"])
    headline.append("runtime", style=f"italic {_PALETTE['warm']}")

    sub = Text()
    sub.append(
        f"open-core structural intelligence  ·  ",
        style=_PALETTE["dim"],
    )
    sub.append(f"{len(_OPS)} operators", style=_PALETTE["primary"])
    sub.append("  +  ", style=_PALETTE["muted"])
    sub.append(f"{len(_STDLIB)} stdlib presets", style=_PALETTE["primary"])

    prompt = Text()
    prompt.append("›  ", style=_PALETTE["primary"])
    prompt.append("what would you like to do? ", style=_PALETTE["primary"])
    prompt.append("(↑/↓ navigate · enter select · q quit)", style=_PALETTE["muted"])

    rows: list[Text] = []
    for i, m in enumerate(items):
        if m.is_header:
            hdr = Text()
            hdr.append("\n── ", style=_PALETTE["muted"])
            hdr.append(m.label.upper(), style=_PALETTE["tertiary"])
            hdr.append(" " + ("─" * max(0, 38 - len(m.label))), style=_PALETTE["muted"])
            rows.append(hdr)
            continue

        line = Text()
        if i == cursor:
            line.append("›  ", style=_PALETTE["primary"])
        else:
            line.append("   ", style=_PALETTE["muted"])
        line.append(f"{m.icon} ", style=_PALETTE["tertiary"])
        line.append(m.label.ljust(34),
                    style=_PALETTE["primary"] if i == cursor else "white")
        if m.badge:
            line.append(f"  {m.badge.upper():<8}", style=_badge_style(m.badge))
        if i == cursor and m.hint:
            line.append(f"  {m.hint}", style=_PALETTE["dim"])
        rows.append(line)

    menu_text = Text("\n").join(rows)

    # Status block — kept narrow and monochrome, no orange.
    status_lines: list[Text] = []
    program_preview = state.program.splitlines() or ["(empty — pick an operator to insert)"]
    label_buf = Text("program buffer  ", style=_PALETTE["tertiary"])
    label_buf.append(f"({len(program_preview)} lines)",
                     style=_PALETTE["muted"])
    status_lines.append(label_buf)
    for ln in program_preview[:6]:
        status_lines.append(Text("  " + ln, style="white"))
    if len(program_preview) > 6:
        status_lines.append(Text(f"  … {len(program_preview)-6} more lines",
                                 style=_PALETTE["muted"]))
    status_lines.append(Text(""))

    meta = Text()
    meta.append("corpus  ", style=_PALETTE["tertiary"])
    meta.append(state.corpus_path.name if state.corpus_path else "(none)",
                style=_PALETTE["primary"] if state.corpus_path else _PALETTE["muted"])
    meta.append("   last sha  ", style=_PALETTE["tertiary"])
    meta.append(state.last_sha[:16] + "…" if state.last_sha else "—",
                style=_PALETTE["warm"] if state.last_sha else _PALETTE["muted"])
    status_lines.append(meta)

    if state.last_golden_status:
        badge = Text()
        badge.append("golden  ", style=_PALETTE["tertiary"])
        if state.last_golden_status == "match":
            badge.append("✓ matches pinned SHA", style=_PALETTE["green"])
        elif state.last_golden_status.startswith("drift:"):
            _, exp, got = state.last_golden_status.split(":", 2)
            badge.append(
                f"✗ DRIFT — expected {exp}…, got {got}…",
                style=_PALETTE["red"],
            )
        status_lines.append(badge)

    msg = Text()
    msg.append("message  ", style=_PALETTE["tertiary"])
    if state.last_message:
        msg.append(state.last_message, style=_PALETTE["primary"])
    else:
        msg.append("(none)", style=_PALETTE["muted"])
    status_lines.append(msg)

    return Group(
        headline,
        sub,
        Text(""),
        prompt,
        Text(""),
        menu_text,
        Text(""),
        Rule(style=_PALETTE["muted"]),
        *status_lines,
    )


# ── Main loop ──────────────────────────────────────────────────────────

def main() -> int:
    console = Console()
    state = AppState()
    items = build_menu()
    selectable = _selectable_indices(items)
    sel_pos = 0  # index into `selectable`

    with Live(render(state, items, selectable[sel_pos], console),
              console=console, screen=True, refresh_per_second=24) as live:
        while not state.quit:
            try:
                key = read_key()
            except KeyboardInterrupt:
                break

            if key == "up":
                sel_pos = (sel_pos - 1) % len(selectable)
            elif key == "down":
                sel_pos = (sel_pos + 1) % len(selectable)
            elif key in ("enter", "right"):
                m = items[selectable[sel_pos]]
                if m.on_enter:
                    m.on_enter(state)
            elif key in ("q", "esc", "ctrl-c"):
                state.quit = True
            else:
                # Unbound key — ignore
                pass

            live.update(render(state, items, selectable[sel_pos], console))

    console.print()
    console.print(f"[{_PALETTE['muted']}]lo cmd · session ended[/{_PALETTE['muted']}]")
    if state.last_sha:
        console.print(f"[{_PALETTE['warm']}]last sha:[/{_PALETTE['warm']}] {state.last_sha}")
    return 0


def verify_samples() -> int:
    """Headless determinism check for the five bundled cmd samples.

    Runs the canonical 7-line program against each corpus, compares the
    resulting artifact SHA against the pinned value in
    ``cli/lo/demo/golden.json::cmd_samples``, and returns:

        0 if every sample matches its pin (or has no pin)
        1 if any sample drifted from its pin
        2 if any sample crashed

    Prints a one-line-per-sample table to stdout.
    """
    from rich.table import Table
    import tempfile

    from .demo.runner import run_program

    console = Console()
    table = Table(show_header=True, header_style="bold")
    table.add_column("corpus")
    table.add_column("sha (got)")
    table.add_column("sha (pinned)")
    table.add_column("modules")
    table.add_column("status")

    drift = 0
    crashed = 0
    samples = ("patents", "edgar", "docsouth", "arxiv", "substrate")
    corpora_root = Path(__file__).resolve().parent / "demo" / "corpora"

    for corpus_id in samples:
        src = corpora_root / corpus_id / "source.ndjson"
        if not src.exists():
            table.add_row(corpus_id, "—", "—", "—",
                          f"[{_PALETTE['red']}]missing corpus[/{_PALETTE['red']}]")
            crashed += 1
            continue
        # All success checks must happen inside the TemporaryDirectory `with`
        # block — once we exit it, the work_dir (and the artifact inside it)
        # is deleted and RunResult.succeeded() returns False even though the
        # run itself completed correctly.
        try:
            with tempfile.TemporaryDirectory(prefix="lo-cmd-verify-") as td:
                tdp = Path(td)
                prog = tdp / "program.ocean"
                prog.write_text(CANONICAL_SAMPLE_PROGRAM, encoding="utf-8")
                corpus_dst = tdp / "corpus.ndjson"
                corpus_dst.write_bytes(src.read_bytes())
                r = run_program(
                    program_path=prog,
                    corpus_path=corpus_dst,
                    work_dir=tdp,
                    seed=42,
                )
                if not r.succeeded():
                    tail = (r.stderr or "").strip().splitlines()
                    last_line = tail[-1] if tail else "(no stderr)"
                    row = (corpus_id, "—", "—", "—",
                           f"[{_PALETTE['red']}]run failed: {last_line[:80]}[/{_PALETTE['red']}]")
                    table.add_row(*row)
                    crashed += 1
                    continue

                pin = _load_cmd_pin(corpus_id)
                pinned_sha = (pin or {}).get("artifact_sha256")
                if not pinned_sha:
                    status = f"[{_PALETTE['muted']}]no pin[/{_PALETTE['muted']}]"
                elif pinned_sha == r.artifact_sha256:
                    status = f"[{_PALETTE['green']}]✓ match[/{_PALETTE['green']}]"
                else:
                    status = f"[{_PALETTE['red']}]✗ DRIFT[/{_PALETTE['red']}]"
                    drift += 1

                table.add_row(
                    corpus_id,
                    r.artifact_sha256[:12],
                    (pinned_sha or "—")[:12],
                    str(r.n_modules) if r.n_modules is not None else "?",
                    status,
                )
        except Exception as e:  # noqa: BLE001
            table.add_row(corpus_id, "—", "—", "—",
                          f"[{_PALETTE['red']}]crash: {type(e).__name__}: {e}[/{_PALETTE['red']}]")
            crashed += 1
            continue

    console.print()
    console.print("[bold]lo cmd verify[/bold] — cmd-sample determinism check")
    console.print(table)
    console.print()
    if crashed:
        console.print(f"[{_PALETTE['red']}]✗ {crashed} sample(s) crashed[/{_PALETTE['red']}]")
        return 2
    if drift:
        console.print(f"[{_PALETTE['red']}]✗ {drift} sample(s) drifted from golden pin[/{_PALETTE['red']}]")
        return 1
    console.print(f"[{_PALETTE['green']}]✓ all cmd samples match pinned SHAs[/{_PALETTE['green']}]")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
