"""Gauntlet flow controller. Cycles the five bundled corpora through the
canonical OCEAN program and updates the TUI as it goes.

The OCEAN run executes in a worker thread so the TUI stays responsive and
the verb marker can walk down the program at a pace the audience can
follow. The artifacts are real even though the verb-pace animation is
decorative — the audience sees the marker land on `save` at the same
moment the SHA-256 row appears in the ledger pane.
"""
from __future__ import annotations

import json
import shutil
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from rich.console import Console

from . import CORPORA_ROOT, CORPUS_ORDER, PROGRAM_FREE
from .ingest import normalize_bundled_corpus
from .receipts import Ledger, Receipt, estimate_cost_usd
from .runner import RunResult, run_program
from .tui import (
    CorpusStage,
    DemoState,
    VERB_KEYWORDS,
    assert_terminal_large_enough,
    build_layout,
    make_live,
    update_live,
)


PROGRAM_VERBS_IN_ORDER = (
    "load", "embed", "cluster", "align", "find", "save",
)


@dataclass
class GauntletConfig:
    program_path: Path = PROGRAM_FREE
    corpora_root: Path = CORPORA_ROOT
    seed: int = 42
    verb_walk_seconds: float = 0.55
    inter_corpus_pause: float = 1.6
    work_root: Path | None = None
    save_transcript_to: Path | None = None
    headless: bool = False     # rehearse mode: skip TUI, run synchronously


def _load_manifest(corpus_id: str, corpora_root: Path) -> dict:
    manifest_path = corpora_root / corpus_id / "manifest.json"
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def _walk_verbs(
    state: DemoState,
    live,
    stage: CorpusStage,
    runner_done: threading.Event,
    walk_seconds_per_verb: float,
) -> None:
    """Animate the verb marker walking down the program until runner_done.

    Walks at `walk_seconds_per_verb` per verb. If the runner finishes faster,
    the walk jumps ahead. If slower, the walk stalls on the last verb until
    runner_done is set.
    """
    pct_step = 100.0 / len(PROGRAM_VERBS_IN_ORDER)
    for i, verb in enumerate(PROGRAM_VERBS_IN_ORDER):
        stage.current_verb = verb
        stage.progress_pct = i * pct_step
        stage.last_event_text = ""
        update_live(live, state)
        t_end = time.time() + walk_seconds_per_verb
        while time.time() < t_end:
            if runner_done.is_set():
                break
            time.sleep(0.06)
            update_live(live, state)
    while not runner_done.is_set():
        stage.progress_pct = 100.0
        update_live(live, state)
        time.sleep(0.1)
    stage.progress_pct = 100.0
    update_live(live, state)


def _run_corpus(
    state: DemoState,
    live,
    config: GauntletConfig,
    corpus_id: str,
    index: int,
    total: int,
    work_root: Path,
) -> Receipt | None:
    """Process one corpus: normalize, run, build receipt, render."""
    manifest = _load_manifest(corpus_id, config.corpora_root)
    source_path = config.corpora_root / corpus_id / "source.ndjson"
    work_dir = work_root / corpus_id
    work_dir.mkdir(parents=True, exist_ok=True)
    corpus_norm = work_dir / "corpus.ndjson"

    ingest_report = normalize_bundled_corpus(
        source_path=source_path,
        label_field=manifest["label_field"],
        output_path=corpus_norm,
    )

    stage = CorpusStage(
        index=index,
        total=total,
        corpus_id=corpus_id,
        display_name=manifest["display_name"],
        on_disk_format=manifest["format"],
        n_records=ingest_report.n_records_out,
        label_field=manifest["label_field"],
    )
    state.current_stage = stage
    update_live(live, state)

    runner_done = threading.Event()
    result_box: dict[str, RunResult] = {}

    def _run_in_thread() -> None:
        try:
            result_box["result"] = run_program(
                program_path=config.program_path,
                corpus_path=corpus_norm,
                work_dir=work_dir,
                seed=config.seed,
            )
        except Exception as e:  # noqa: BLE001
            stage.last_event_text = f"error: {type(e).__name__}: {e}"
        finally:
            runner_done.set()

    worker = threading.Thread(target=_run_in_thread, daemon=True)
    worker.start()

    _walk_verbs(
        state=state, live=live, stage=stage,
        runner_done=runner_done,
        walk_seconds_per_verb=config.verb_walk_seconds,
    )
    worker.join(timeout=120.0)

    result = result_box.get("result")
    if not result or not result.succeeded():
        stage.last_event_text = "✗ run failed; advancing to next corpus"
        update_live(live, state)
        time.sleep(1.0)
        return None

    receipt = Receipt(
        corpus_id=corpus_id,
        display_name=manifest["display_name"],
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
    stage.current_verb = "save"
    stage.progress_pct = 100.0
    update_live(live, state)
    time.sleep(config.inter_corpus_pause)
    return receipt


def _run_corpus_headless(
    state: DemoState,
    config: GauntletConfig,
    corpus_id: str,
    index: int,
    total: int,
    work_root: Path,
) -> Receipt | None:
    """Synchronous, non-TUI version of _run_corpus. Used by `rehearse`."""
    manifest = _load_manifest(corpus_id, config.corpora_root)
    source_path = config.corpora_root / corpus_id / "source.ndjson"
    work_dir = work_root / corpus_id
    work_dir.mkdir(parents=True, exist_ok=True)
    corpus_norm = work_dir / "corpus.ndjson"

    ingest_report = normalize_bundled_corpus(
        source_path=source_path,
        label_field=manifest["label_field"],
        output_path=corpus_norm,
    )
    result = run_program(
        program_path=config.program_path,
        corpus_path=corpus_norm,
        work_dir=work_dir,
        seed=config.seed,
    )
    if not result.succeeded():
        return None
    receipt = Receipt(
        corpus_id=corpus_id,
        display_name=manifest["display_name"],
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
    _ = index
    _ = total
    return receipt


def run_gauntlet(
    *,
    config: GauntletConfig | None = None,
    console: Console | None = None,
    on_corpus_done: Callable[[Receipt], None] | None = None,
) -> Ledger:
    """Run the gauntlet across all five corpora. Returns the receipt ledger."""
    cfg = config or GauntletConfig()
    console = console or Console()

    work_root = cfg.work_root or (Path.home() / ".latentocean" / "demo-runs" /
                                  time.strftime("%Y%m%d-%H%M%S"))
    work_root.mkdir(parents=True, exist_ok=True)

    program_text = cfg.program_path.read_text(encoding="utf-8")
    state = DemoState(
        seed=cfg.seed,
        program_path=cfg.program_path,
        program_text=program_text,
    )

    total = len(CORPUS_ORDER)

    if cfg.headless:
        for i, corpus_id in enumerate(CORPUS_ORDER, start=1):
            receipt = _run_corpus_headless(
                state=state, config=cfg,
                corpus_id=corpus_id, index=i, total=total,
                work_root=work_root,
            )
            if receipt and on_corpus_done:
                on_corpus_done(receipt)
    else:
        assert_terminal_large_enough(console)
        with make_live(state, console) as live:
            update_live(live, state)
            time.sleep(0.8)
            for i, corpus_id in enumerate(CORPUS_ORDER, start=1):
                receipt = _run_corpus(
                    state=state, live=live, config=cfg,
                    corpus_id=corpus_id, index=i, total=total,
                    work_root=work_root,
                )
                if receipt and on_corpus_done:
                    on_corpus_done(receipt)
            state.current_stage = None
            update_live(live, state)
            time.sleep(2.0)

    if cfg.save_transcript_to:
        state.ledger.save(cfg.save_transcript_to)
    else:
        state.ledger.save(work_root / "transcript.json")

    return state.ledger


def _walk_verb_for_stage(stage: CorpusStage, verb: str, pct: float) -> None:
    stage.current_verb = verb
    stage.progress_pct = pct


__all__ = ["GauntletConfig", "run_gauntlet"]
