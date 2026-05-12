"""4-pane rich.Live layout for the gauntlet.

    ┌─ OCEAN program ──────────┬─ artifact ledger ─┐
    │ program.ocean            │ corpus rows…       │
    │ (current verb bold)      │ sha + cost          │
    ├─ corpus N/5: <name> ─────┴─────────────────────┤
    │ format / records / label / current verb       │
    ├─ status ──────────────────────────────────────┤
    │ elapsed · verb · corpus · cost · seed         │
    └────────────────────────────────────────────────┘

No scrolling. The full transcript is written to disk separately.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from pathlib import Path

from rich.align import Align
from rich.console import Console, Group, RenderableType
from rich.layout import Layout
from rich.live import Live
from rich.panel import Panel
from rich.progress_bar import ProgressBar
from rich.table import Table
from rich.text import Text

from .receipts import Ledger, Receipt


MIN_WIDTH = 120
MIN_HEIGHT = 32


VERB_KEYWORDS = (
    "load", "embed", "reduce", "cluster", "align", "find", "narrate", "save",
)


@dataclass
class CorpusStage:
    """What's happening for one corpus right now."""
    index: int                 # 1-based for display
    total: int
    corpus_id: str
    display_name: str
    on_disk_format: str
    n_records: int
    label_field: str
    current_verb: str | None = None
    progress_pct: float = 0.0
    last_event_text: str = ""


@dataclass
class DemoState:
    """All TUI-visible state. Mutated by the sequencer."""
    seed: int = 42
    started_at: float = field(default_factory=time.time)
    cost_usd: float = 0.0
    program_path: Path | None = None
    program_text: str = ""
    current_stage: CorpusStage | None = None
    ledger: Ledger = field(default_factory=Ledger)
    mode: str = "gauntlet"     # "gauntlet" | "replay" | "client"
    cloud_replay_active: bool = False
    operator_paused: bool = False

    def elapsed(self) -> float:
        return time.time() - self.started_at


def _format_elapsed(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    return f"{m:02d}:{s:02d}"


def _current_verb_for_line(line: str) -> str | None:
    """Return the OCEAN verb a program line begins with, or None."""
    stripped = line.lstrip()
    if not stripped or stripped.startswith("#"):
        return None
    head = stripped.split(maxsplit=1)[0]
    return head if head in VERB_KEYWORDS else None


def render_program_pane(state: DemoState) -> RenderableType:
    """Top-left pane: the .ocean program with current verb highlighted."""
    lines = state.program_text.splitlines() if state.program_text else []
    rendered = Text()
    current = state.current_stage.current_verb if state.current_stage else None
    for line in lines:
        verb_on_line = _current_verb_for_line(line)
        if verb_on_line and verb_on_line == current:
            rendered.append("  ▶ ", style="bold cyan")
            rendered.append(line + "\n", style="bold white on grey15")
        elif line.lstrip().startswith("#"):
            rendered.append("    " + line + "\n", style="dim italic")
        elif verb_on_line is not None:
            rendered.append("    " + line + "\n", style="white")
        else:
            rendered.append("    " + line + "\n", style="white")
    title = "OCEAN program"
    if state.program_path:
        title += f" · {state.program_path.name}"
    return Panel(rendered, title=title, border_style="cyan", padding=(0, 1))


def render_ledger_pane(state: DemoState) -> RenderableType:
    """Top-right pane: receipts accumulating as corpora complete."""
    table = Table(
        show_header=True, header_style="bold cyan",
        expand=True, padding=(0, 1), border_style="grey42",
    )
    table.add_column("corpus", style="white", no_wrap=True)
    table.add_column("sha", style="green", no_wrap=True)
    if state.cloud_replay_active or any(
        r.cloud_artifact_sha256 for r in state.ledger.receipts
    ):
        table.add_column("cloud", style="magenta", no_wrap=True)
        table.add_column("✓", style="bold", no_wrap=True)
    table.add_column("cost", style="yellow", no_wrap=True, justify="right")

    show_cloud = state.cloud_replay_active or any(
        r.cloud_artifact_sha256 for r in state.ledger.receipts
    )
    for r in state.ledger.receipts:
        row = [r.corpus_id, r.short_sha()]
        if show_cloud:
            row.append(r.short_cloud_sha())
            if r.cloud_matches_local is True:
                row.append("✓")
            elif r.cloud_matches_local is False:
                row.append("✗")
            else:
                row.append("…")
        row.append(f"${r.estimated_cost_usd:.4f}")
        table.add_row(*row)

    title = "artifact ledger"
    if state.cloud_replay_active:
        title += " · cloud replay"
    return Panel(table, title=title, border_style="green", padding=(0, 0))


def render_corpus_pane(state: DemoState) -> RenderableType:
    """Middle pane: current corpus header + current verb + progress bar."""
    stage = state.current_stage
    if not stage:
        body = Align.center(
            Text(
                "press ENTER to begin\n\nthe OCEAN gauntlet across five corpora",
                style="dim italic",
                justify="center",
            ),
            vertical="middle",
        )
        return Panel(body, title="corpus", border_style="grey42")

    header_parts = [
        f"format: [bold]{stage.on_disk_format}[/bold]",
        f"records: [bold]{stage.n_records:,}[/bold]",
        f"label: [bold]{stage.label_field}[/bold] → label",
    ]
    header = Text.from_markup(" · ".join(header_parts), style="white")

    body_parts: list[RenderableType] = [header, Text()]
    if stage.current_verb:
        body_parts.append(
            Text.from_markup(
                f"  ▶ [bold cyan]{stage.current_verb}[/bold cyan]",
            )
        )
        if stage.last_event_text:
            body_parts.append(Text("    " + stage.last_event_text, style="dim"))
    pb = ProgressBar(total=100, completed=stage.progress_pct, width=None)
    body_parts.append(Text())
    body_parts.append(pb)

    title = f"corpus {stage.index}/{stage.total} · {stage.display_name}"
    if state.operator_paused:
        title += " · [PAUSED]"
    return Panel(
        Group(*body_parts),
        title=title,
        border_style="cyan" if not state.operator_paused else "yellow",
        padding=(1, 2),
    )


def render_status_pane(state: DemoState) -> RenderableType:
    elapsed = _format_elapsed(state.elapsed())
    verb = state.current_stage.current_verb if state.current_stage else "-"
    corpus = (
        f"{state.current_stage.index}/{state.current_stage.total}"
        if state.current_stage else "-"
    )
    line = Text.from_markup(
        f"elapsed: [bold]{elapsed}[/bold] · "
        f"verb: [bold cyan]{verb}[/bold cyan] · "
        f"corpus: [bold]{corpus}[/bold] · "
        f"cost: [yellow]${state.ledger.total_cost():.4f}[/yellow] · "
        f"seed: [bold]{state.seed}[/bold] · "
        f"mode: [magenta]{state.mode}[/magenta]"
    )
    return Panel(line, border_style="grey42", padding=(0, 1))


def build_layout(state: DemoState) -> Layout:
    layout = Layout()
    layout.split_column(
        Layout(name="top", ratio=4),
        Layout(name="middle", ratio=5),
        Layout(name="status", size=3),
    )
    layout["top"].split_row(
        Layout(name="program", ratio=3),
        Layout(name="ledger", ratio=2),
    )
    layout["program"].update(render_program_pane(state))
    layout["ledger"].update(render_ledger_pane(state))
    layout["middle"].update(render_corpus_pane(state))
    layout["status"].update(render_status_pane(state))
    return layout


def make_live(state: DemoState, console: Console) -> Live:
    """Construct the rich.Live wrapper. Caller is responsible for `.start()`
    / `.stop()` or use it as a context manager.
    """
    return Live(
        build_layout(state),
        console=console,
        refresh_per_second=12,
        transient=False,
        screen=True,
    )


def update_live(live: Live, state: DemoState) -> None:
    live.update(build_layout(state))


def assert_terminal_large_enough(console: Console) -> None:
    """Refuse to start if the terminal is too small for the gauntlet."""
    w, h = console.size.width, console.size.height
    if w < MIN_WIDTH or h < MIN_HEIGHT:
        raise SystemExit(
            f"lo demo: terminal too small ({w}x{h}); "
            f"need at least {MIN_WIDTH}x{MIN_HEIGHT}. "
            f"Resize the window and re-run `lo demo`."
        )
