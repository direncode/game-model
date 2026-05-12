"""The "and-now-yours" segment.

Takes a client-supplied file (PDF, CSV, NDJSON, .txt, .json, .html), runs
it through the format-aware ingest adapter, then through the same
canonical OCEAN program the gauntlet used. The TUI flow is identical — the
audience watches their own data resolve into modules in real time.
"""
from __future__ import annotations

import time
from pathlib import Path

from rich.console import Console

from . import PROGRAM_FREE
from .ingest import IngestError, normalize_client_file
from .receipts import Ledger, Receipt, estimate_cost_usd
from .runner import run_program
from .tui import (
    CorpusStage,
    DemoState,
    assert_terminal_large_enough,
    make_live,
    update_live,
)


def run_client_file(
    source_path: Path,
    *,
    console: Console | None = None,
    program_path: Path = PROGRAM_FREE,
    seed: int = 42,
    work_root: Path | None = None,
    verb_walk_seconds: float = 0.7,
) -> Receipt | None:
    """Run the canonical program against the client's file. Returns the
    receipt if successful, or None if anything failed."""
    console = console or Console()
    assert_terminal_large_enough(console)

    work_root = work_root or (Path.home() / ".latentocean" / "demo-runs" /
                              f"client-{time.strftime('%Y%m%d-%H%M%S')}")
    work_root.mkdir(parents=True, exist_ok=True)
    work_dir = work_root / "client"
    work_dir.mkdir(parents=True, exist_ok=True)

    try:
        ingest_report = normalize_client_file(
            source_path=source_path,
            output_path=work_dir / "corpus.ndjson",
        )
    except IngestError as e:
        console.print(f"[red]ingest failed:[/red] {e}")
        return None

    program_text = program_path.read_text(encoding="utf-8")
    state = DemoState(
        seed=seed,
        program_path=program_path,
        program_text=program_text,
        mode="client",
    )
    stage = CorpusStage(
        index=1,
        total=1,
        corpus_id="client",
        display_name=source_path.name,
        on_disk_format=f"{ingest_report.detected_format} (auto-detected)",
        n_records=ingest_report.n_records_out,
        label_field=ingest_report.label_field_original,
    )
    state.current_stage = stage
    state.ledger = Ledger()

    receipt: Receipt | None = None
    with make_live(state, console) as live:
        update_live(live, state)
        time.sleep(0.8)

        verbs = ("load", "embed", "cluster", "align", "find", "save")
        result = None
        # Animate verb walk while running synchronously (fast enough for
        # client files of <50k records).
        import threading
        done = threading.Event()
        result_box: dict = {}

        def _run() -> None:
            try:
                result_box["r"] = run_program(
                    program_path=program_path,
                    corpus_path=work_dir / "corpus.ndjson",
                    work_dir=work_dir,
                    seed=seed,
                )
            finally:
                done.set()

        worker = threading.Thread(target=_run, daemon=True)
        worker.start()
        pct_step = 100.0 / len(verbs)
        for i, verb in enumerate(verbs):
            stage.current_verb = verb
            stage.progress_pct = i * pct_step
            update_live(live, state)
            t_end = time.time() + verb_walk_seconds
            while time.time() < t_end and not done.is_set():
                time.sleep(0.06)
                update_live(live, state)
        while not done.is_set():
            update_live(live, state)
            time.sleep(0.12)
        worker.join(timeout=180.0)
        result = result_box.get("r")

        if not result or not result.succeeded():
            stage.last_event_text = "✗ run failed"
            update_live(live, state)
            time.sleep(1.6)
        else:
            receipt = Receipt(
                corpus_id="client",
                display_name=source_path.name,
                corpus_sha256=ingest_report.output_sha256,
                artifact_sha256=result.artifact_sha256,
                wall_seconds=result.wall_seconds,
                estimated_cost_usd=estimate_cost_usd(
                    n_records=ingest_report.n_records_out,
                    wall_seconds=result.wall_seconds,
                ),
                n_records=ingest_report.n_records_out,
                n_modules=result.n_modules,
            )
            state.ledger.add(receipt)
            stage.last_event_text = (
                f"✓ artifact sha {receipt.short_sha()} · "
                f"{result.wall_seconds:.1f}s · "
                f"{receipt.n_modules or '?'} modules"
            )
            stage.progress_pct = 100.0
            update_live(live, state)
            time.sleep(2.0)

    return receipt


__all__ = ["run_client_file"]
