"""Local OCEAN runner. Executes a `.ocean` program against a normalized
`corpus.ndjson` and returns the artifact path, its SHA-256, the verb-level
timings, and a parsed module summary.

The runner uses an in-process call to `ocean_cli` rather than a subprocess
so the TUI thread can observe execution without parsing subprocess pipes.
Stdout is redirected to a capture buffer that emits per-verb progress
events to the supplied callback.
"""
from __future__ import annotations

import io
import json
import os
import shutil
import sys
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Iterator

from .. import obs
from .receipts import sha256_of_bytes, sha256_of_file


REPO_ROOT = Path(__file__).resolve().parents[3]
OCEAN_CLI_SRC = REPO_ROOT / "packages" / "ocean-cli" / "src"
OCEAN_CLI_VENDORED = OCEAN_CLI_SRC / "ocean_cli" / "_vendored"


def _ensure_ocean_on_path() -> None:
    """Add the ocean-cli source tree to sys.path. Idempotent."""
    for p in (OCEAN_CLI_SRC, OCEAN_CLI_VENDORED):
        sp = str(p)
        if sp not in sys.path:
            sys.path.insert(0, sp)


class RunnerError(RuntimeError):
    """OCEAN execution failed; details in `.stdout` / `.stderr`."""


@dataclass
class VerbEvent:
    """Single verb-completion event emitted during a run."""
    verb: str            # e.g. "embed", "cluster"
    operator: str        # e.g. "embed.tfidf_jl"
    wall_seconds: float
    signature: str       # operator signature hash from the pipeline


@dataclass
class RunResult:
    artifact_path: Path
    artifact_sha256: str
    corpus_sha256: str
    wall_seconds: float
    stdout: str
    stderr: str
    verb_events: list[VerbEvent] = field(default_factory=list)
    n_records: int = 0
    n_modules: int | None = None

    def succeeded(self) -> bool:
        return self.artifact_path.exists() and bool(self.artifact_sha256)


@contextmanager
def _capture_stdout() -> Iterator[tuple[io.StringIO, io.StringIO]]:
    """Redirect sys.stdout/stderr to in-memory buffers for the duration.

    Yields the (stdout, stderr) buffers. Callers should read both AFTER
    the context exits — `.getvalue()` is safe at that point.
    """
    old_out, old_err = sys.stdout, sys.stderr
    buf_out, buf_err = io.StringIO(), io.StringIO()
    sys.stdout, sys.stderr = buf_out, buf_err
    try:
        yield buf_out, buf_err
    finally:
        sys.stdout, sys.stderr = old_out, old_err


def _parse_verb_events(stdout: str) -> list[VerbEvent]:
    """Parse the `[pipeline] step` and final timings table from stdout.

    The universal pipeline runner prints lines like:
        [pipeline] step embed_0      embed.tfidf_jl    1.42s  sig=abc123
    """
    events: list[VerbEvent] = []
    in_table = False
    for raw in stdout.splitlines():
        line = raw.strip()
        if line.startswith("PIPELINE COMPLETE"):
            in_table = True
            continue
        if not in_table:
            continue
        if not line or line.startswith("=") or line.startswith("TOTAL"):
            continue
        # The table rows look like: "step_name  kind  wall_s  sig=..."
        parts = line.split()
        if len(parts) < 4:
            continue
        try:
            wall_s = float(parts[-2].rstrip("s"))
        except ValueError:
            continue
        sig = parts[-1].split("=", 1)[-1] if "=" in parts[-1] else parts[-1]
        operator = parts[1]
        verb = operator.split(".")[0]
        events.append(VerbEvent(
            verb=verb,
            operator=operator,
            wall_seconds=wall_s,
            signature=sig,
        ))
    return events


def _deterministic_artifact_sha(artifact: Path) -> str:
    """Hash a canonicalized form of the artifact, stripping wall-clock fields.

    The open-core OCEAN engine writes `_meta.generated_at` (a wall-clock
    timestamp) into every persist.json artifact. Including this in the
    hash would break the determinism contract — same seed, same input,
    different SHA. We strip the offending fields and re-serialize with
    sorted keys before hashing.

    Fields stripped:
        _meta.generated_at      (ISO timestamp)
        _meta.wall_seconds      (occasionally present)

    Everything else — modules, alignments, dispersion, label counts —
    contributes to the hash. So two runs at the same seed against the
    same corpus produce identical deterministic SHAs.
    """
    try:
        data = json.loads(artifact.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return sha256_of_file(artifact)  # fall back to raw bytes
    if isinstance(data.get("_meta"), dict):
        data["_meta"].pop("generated_at", None)
        data["_meta"].pop("wall_seconds", None)
        data["_meta"].pop("started_at", None)
    canonical = json.dumps(data, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return sha256_of_bytes(canonical)


def _module_count_from_artifact(artifact: Path) -> int | None:
    try:
        data = json.loads(artifact.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    for key in ("aligned_modules", "modules", "clusters"):
        v = data.get(key)
        if isinstance(v, list):
            return len(v)
        if isinstance(v, dict):
            return len(v)
    return None


def _copy_unless_same(src: Path, dst: Path) -> None:
    """Copy ``src`` to ``dst`` unless they already refer to the same file.

    On Windows, ``Path.resolve()`` can produce mixed-style strings (Git-Bash
    surfaces `/c/Users/...` while CPython prefers `C:\\Users\\...`). Comparing
    the two as strings then handing both to ``shutil.copyfile`` raises
    ``SameFileError`` even though the user-visible paths look different.

    ``Path.samefile`` consults the OS inode / file-id, which is the only
    reliable equivalence on case-insensitive Windows filesystems. We still
    guard the call with ``OSError`` in case ``src`` does not exist yet.
    """
    try:
        if src.exists() and dst.exists() and src.samefile(dst):
            return
    except OSError:
        pass
    try:
        shutil.copyfile(src, dst)
    except shutil.SameFileError:
        return


def _record_count_from_artifact(artifact: Path, corpus: Path | None = None) -> int:
    """Best-effort record count. The artifact rarely surfaces this directly;
    we count corpus.ndjson lines as the source of truth."""
    if corpus and corpus.exists():
        with corpus.open("r", encoding="utf-8") as f:
            return sum(1 for line in f if line.strip())
    try:
        data = json.loads(artifact.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return 0
    for key in ("n_records", "n_input"):
        v = data.get(key)
        if isinstance(v, int):
            return v
    return 0


def run_program(
    program_path: Path,
    corpus_path: Path,
    work_dir: Path,
    *,
    on_progress: Callable[[str], None] | None = None,
    seed: int | None = None,
) -> RunResult:
    """Run a .ocean program against a normalized corpus.

    Layout:
        work_dir/
            program.ocean        (copy of program_path)
            corpus.ndjson        (copy of corpus_path)
            result.json          (produced by the program's `save to`)
            result.json.sha256   (produced by the persist operator)

    The program loads `corpus.ndjson` relative to CWD; we cd into work_dir
    for the run so the program text never changes between corpora.
    """
    _ensure_ocean_on_path()
    work_dir = work_dir.resolve()
    work_dir.mkdir(parents=True, exist_ok=True)

    # Resolve to absolutes BEFORE we os.chdir, otherwise the run-time
    # invocation of `Path.resolve()` will re-anchor relative inputs to
    # the new CWD and double the path.
    work_program = (work_dir / "program.ocean").resolve()
    work_corpus = (work_dir / "corpus.ndjson").resolve()
    work_artifact = (work_dir / "result.json").resolve()

    _copy_unless_same(Path(program_path), work_program)
    _copy_unless_same(Path(corpus_path), work_corpus)
    if work_artifact.exists():
        work_artifact.unlink()

    if on_progress:
        on_progress(f"loaded program from {program_path.name}")

    saved_cwd = Path.cwd()
    saved_argv = sys.argv[:]
    os.chdir(work_dir)

    t0 = time.time()
    rc = 0
    captured_out = ""
    captured_err = ""
    try:
        from ocean_cli.main import main as ocean_main  # type: ignore
        # Pass the program as an absolute path so the `ocean run` preset
        # regex (^ident.ident$) does not mis-classify `program.ocean` as
        # a preset reference. corpus.ndjson is still resolved from CWD.
        program_arg = str(work_program)
        argv = ["run", program_arg]
        if seed is not None:
            argv += ["--seed", str(seed)]
        if on_progress:
            on_progress("ocean run program.ocean (in-process)")
        with _capture_stdout() as (buf_out, buf_err):
            try:
                rc = ocean_main(argv) or 0
            except SystemExit as e:
                rc = int(getattr(e, "code", 0) or 0)
        captured_out = buf_out.getvalue()
        captured_err = buf_err.getvalue()
    except Exception as e:  # noqa: BLE001
        # Catch absolutely anything from the engine so the TUI never crashes.
        # The structured logger preserves the full traceback in the
        # rolling NDJSON log; the TUI surfaces only `last_event_text`.
        obs.exception(
            "runner.engine_failed",
            program=str(program_path),
            corpus=str(corpus_path),
            seed=seed,
        )
        return RunResult(
            artifact_path=work_artifact,
            artifact_sha256="",
            corpus_sha256=sha256_of_file(work_corpus),
            wall_seconds=time.time() - t0,
            stdout=captured_out,
            stderr=f"{type(e).__name__}: {e}\n{captured_err}",
        )
    finally:
        os.chdir(saved_cwd)
        sys.argv = saved_argv

    wall = time.time() - t0

    if rc != 0 or not work_artifact.exists():
        return RunResult(
            artifact_path=work_artifact,
            artifact_sha256="",
            corpus_sha256=sha256_of_file(work_corpus),
            wall_seconds=wall,
            stdout=captured_out,
            stderr=captured_err or f"ocean run exited with code {rc}",
        )

    artifact_sha = _deterministic_artifact_sha(work_artifact)
    corpus_sha = sha256_of_file(work_corpus)
    events = _parse_verb_events(captured_out)
    n_modules = _module_count_from_artifact(work_artifact)
    n_records = _record_count_from_artifact(work_artifact, work_corpus)

    obs.event(
        "runner.completed",
        program=Path(program_path).name,
        corpus=Path(corpus_path).name,
        seed=seed,
        artifact_sha256=artifact_sha,
        wall_s=round(wall, 3),
        n_records=n_records,
        n_modules=n_modules,
        n_verb_events=len(events),
    )

    if on_progress:
        on_progress(f"artifact landed · sha {artifact_sha[:8]}…")

    return RunResult(
        artifact_path=work_artifact,
        artifact_sha256=artifact_sha,
        corpus_sha256=corpus_sha,
        wall_seconds=wall,
        stdout=captured_out,
        stderr=captured_err,
        verb_events=events,
        n_records=n_records,
        n_modules=n_modules,
    )
