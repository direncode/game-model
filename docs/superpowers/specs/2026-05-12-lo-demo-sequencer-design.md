# `lo demo` — The Sequencer (live OCEAN gauntlet)

**Status:** approved 2026-05-12
**Scope:** a single CLI binary that runs a live, 30-minute end-to-end demonstration of OCEAN against five wildly different raw-data corpora, closes with a cloud-replay hash-match tail, and accepts an "and-now-yours" client-supplied file. Targeted at highest-tier client meetings.

---

## 1. The walk-away

At the end of the demo the client should be able to say, out loud:
*"The same six lines just ate a PDF, a CSV, plain text, NDJSON, and a binary protocol trace — and the artifact hashes match between this laptop and the cloud."*

That sentence is the design north star. Every decision below derives from it.

---

## 2. Strategic locks (from brainstorming)

- **Walk-away shape:** end-to-end operator evolution visible on raw data; all 8 OCEAN verbs represented exactly once (`load → embed → reduce → cluster → align → find → narrate → save`).
- **Data:** 4-5 dramatically different pre-staged corpora baked into the binary.
- **Architecture:** local-first engine for the live segment, with a tail replay against the production cloud that proves byte-identical hashes match.
- **Duration:** 30 minutes (≈22 min of live demo + 8 min of buffer / Q&A / interactive client segment).
- **Binary shape:** "The Sequencer" — single `lo demo` command runs the gauntlet straight through; operator brakes via space-bar.

---

## 3. The canonical OCEAN program

The 9-line program every corpus runs against. Pinned to the top pane the entire demo. Not one byte changes between corpora.

```ocean
require ocean 1.0
seed 42

load corpus.ndjson take 5000 records balanced by label
embed text into 128 dimensions using content fingerprint
reduce using btut
cluster for 16 rounds max 24 modules energy = corpus mean
align modules using 50 nearest records
find dispersion of each label
narrate every module using 3 nearest records
save to result.json
```

**Verb-by-verb justification:**

| Verb | Variant | Why this exact form |
|---|---|---|
| `load` | `take 5000 records balanced by label` | Stratified sampling; same record count across corpora keeps wall-time consistent for the gauntlet pacing |
| `embed` | `content fingerprint` (premium) | The single-word swap from `tf-idf` is the open-core split made visible in one line |
| `reduce` | `btut` (premium) | Where the cost-collapse story lives; without `reduce` the demo skips the most commercially distinctive verb |
| `cluster` | `kmeans` (default, implicit) | Reference operator; demonstrates the free path still works |
| `align` | `module` (default) | Module-to-record k-nearest |
| `find` | `dispersion of each label` | Produces the dispersion-per-label artifact |
| `narrate` | `every module using 3 nearest records` | **Deterministic** narration from anchors, not LLM — critical for the cloud-replay hash match |
| `save` | `result.json` | Pretty-printed JSON + `.sha256` sidecar |

**The normalization contract:** Each ingest adapter guarantees the temporary `corpus.ndjson` has exactly three fields per record: `id` (stable record key), `text` (content to embed), `label` (stratification field). The `.ocean` program never sees the original format. The audience sees the absence of per-corpus schema config — that's the substrate-status proof.

---

## 4. The five corpora

Aligned to existing showcase artifacts (so ingest adapters and ground truth exist) but selected for maximally different on-disk shape.

| # | Corpus | Format | Records (target) | Substrate the demo surfaces |
|---|---|---|---|---|
| 1 | Patents (USPTO sample) | PDFs → text | 5,000 | Technological-domain modules the inventors didn't label |
| 2 | EDGAR 10-K filings | HTML/XBRL → text | 5,000 | Industry-sector modules without SIC codes |
| 3 | DocSouth letters (19th-c correspondence) | plain text | 5,000 (or full ~4.7k available) | Writer social-position modules without biography |
| 4 | Comtrade (international trade data) | CSV tabular numeric | 5,000 | Trade-relationship modules without country labels |
| 5 | Climate sensor measurements | NDJSON time-series | 5,000 | Climate-regime modules without zone labels |

**Why this set:**
- Maximally different on disk (PDF vs HTML vs .txt vs CSV vs NDJSON)
- Maximally different content (legal/technical / financial / historical narrative / numeric tabular / scientific time-series)
- All five are anchored to existing showcases (`docs/commercial/verticals/v2/*`) so the structural findings are pre-validated
- Each surfaces a clearly nameable substrate the audience can verify in seconds

---

## 5. Binary architecture

Additive to the existing `cli/lo/`. Nothing deleted from [main.py](cli/lo/main.py).

```
cli/lo/
  __init__.py
  main.py                    # existing CLI; gains a `demo` command group
  sdk_helpers.py             # NEW: extracted _get_client() so demo can import without dragging typer surface
  demo/                      # NEW: the demo module
    __init__.py
    sequencer.py             # flow controller for the gauntlet
    tui.py                   # 4-pane rich.Live layout
    ingest.py                # format-aware normalization → corpus.ndjson
    runner.py                # invokes local OCEAN engine + cloud SDK
    receipts.py              # SHA-256 ledger, cost meter, oceanlog
    replay.py                # cloud-replay tail
    client_data.py           # "and-now-yours" auto-detect
    program.ocean            # THE canonical 9-line program (read-only)
    narration.yaml           # per-verb narration strings shown to audience
    golden.json              # expected SHAs for `lo demo rehearse` assertions
    corpora/
      patents/
        raw/                 # 5-10 sample PDFs (or pre-extracted text)
        ingested.ndjson      # pre-ingested cache (built at install time, committed)
        manifest.json        # corpus metadata + expected normalized SHA-256
      edgar/    (same shape)
      docsouth/ (same shape)
      comtrade/ (same shape)
      climate/  (same shape)
```

**New surface:**
```
lo demo                      # runs the full gauntlet (default)
lo demo replay --cloud       # tail: re-runs vs production backend, shows hash match
lo demo client <path>        # "and-now-yours" — runs on supplied file
lo demo rehearse             # silent headless dry run for pre-meeting verification
```

---

## 6. Terminal layout (4-pane TUI)

Built on `rich.Live` + `rich.layout.Layout`. No scrolling within the TUI. A full transcript is written to `~/.latentocean/demo-runs/<timestamp>.log` separately.

```
┌─ OCEAN program ──────────────────────────────────────────────┬─ artifact ledger ─────┐
│ require ocean 1.0                                            │  patents ✓            │
│ seed 42                                                      │    sha 7c3a...b41f    │
│ load corpus.ndjson take 5000 records balanced by label       │    cost $0.42         │
│ embed text into 128 dimensions using content fingerprint     │                       │
│ ▶ reduce using btut                                          │  edgar ✓              │
│ cluster for 16 rounds max 24 modules energy = corpus mean    │    sha 9e2d...c08a    │
│ align modules using 50 nearest records                       │    cost $0.51         │
│ find dispersion of each label                                │                       │
│ narrate every module using 3 nearest records                 │  docsouth (running)   │
│ save to result.json                                          │                       │
├─ corpus 3/5: docsouth ───────────────────────────────────────┴───────────────────────┤
│ format: plain text · records: 4,712 · bytes: 18.3 MB · label: writer_class            │
│ ▶ reduce using btut                                                                   │
│   coverage 100% in 312ms · adapters tried: 1 (btut) · footprint -94% vs raw           │
│   ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ 100%        │
├─ status ──────────────────────────────────────────────────────────────────────────────┤
│ elapsed: 06:42 · verb: reduce · corpus: 3/5 · cost: $0.93 · seed: 42 · [space: brake] │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**Behaviors:**
- `▶` marker walks down the verb list as execution advances; current verb rendered in bold
- Space pauses (operator brake); space resumes
- `q` quits cleanly with transcript saved
- Terminal must be ≥ 200×60; smaller is rejected at startup

---

## 7. Demo flow (30-minute beat sheet)

| Beat | Time | What happens on screen |
|---|---|---|
| Cold open | 0:00–1:30 | Single command shown: `lo demo`. Enter pressed. TUI initializes. The 9-line program lands in the top pane. The room reads it once. |
| Corpus 1: patents | 1:30–4:30 | Corpus header shows PDFs on disk. 2s ingest. 8 verbs execute. Modules surface technological domains. SHA lands. |
| Corpus 2: EDGAR | 4:30–7:30 | Pivot: different format (HTML/XBRL), same program. Industry-sector substrate. SHA lands. |
| Corpus 3: DocSouth | 7:30–10:30 | Pivot: plain text 19th-c English. Writer social-position substrate. SHA lands. |
| Corpus 4: Comtrade | 10:30–13:30 | Pivot: pure numeric CSV. Trade-relationship modules. SHA lands. |
| Corpus 5: Climate | 13:30–16:30 | Pivot: NDJSON time-series. Climate-regime substrate. SHA lands. |
| Cloud-replay tail | 16:30–21:30 | `lo demo replay --cloud`. Cloud hashes land next to local hashes. Rows turn green as they match. |
| And-now-yours | 21:30–28:00 | Client provides a file. Auto-detect format. Run same 9-line program. Modules surface live. |
| Receipts | 28:00–30:00 | All SHAs visible. oceanlog ledger downloadable. .ocean source identical to 1:30. |

---

## 8. The cloud-replay tail

`lo demo replay --cloud`:
1. Uses the existing `latentocean` SDK to upload the same five normalized `corpus.ndjson` files (content-addressed by SHA-256) and the same `program.ocean` source
2. Backend executes the same operators at the same seed
3. Cloud artifact hashes returned by the backend appear in a new column next to the local artifact hashes from the gauntlet
4. Each row turns green as the local SHA-256 and cloud SHA-256 match byte-for-byte

This moment is the determinism contract made visible: same `.ocean` source, two different machines, identical artifact bytes.

**Fallback if the venue has no network:** display cached cloud hashes from the most recent successful `lo demo rehearse --cloud` run, with a small "rehearsal cache, <timestamp>" badge so the operator can choose to disclose. Still shows the hash match.

---

## 9. "And now yours"

`lo demo client <path>`:

1. **Detect format** — file extension first, magic-byte sniff second, content shape third
2. **Route to ingest adapter** — PDF / CSV / NDJSON / .txt / .json / .html / fallback-text-extract
3. **Produce `corpus.ndjson`** with `id`, `text`, `label`. If no obvious label field, generate synthetic stratification labels via byte-bucket or file-of-origin
4. **Run the canonical program** — same TUI flow
5. **Render** — same artifact ledger, modules, dispersion

**Failure modes:**
- Format unsupported → single-line clear message, list supported formats, offer to re-run a bundled corpus as substitute
- File empty or too small → message "file too small to crystallize; need ≥ 100 records"
- Corrupt PDF → adapter swallows, message "PDF unreadable; please supply a different source"

The TUI must never crash or render a stack trace during this segment.

---

## 10. Simplification of existing CLI

Nothing deleted. Two changes:

- `_get_client()` from [cli/lo/main.py:22](cli/lo/main.py:22) moves to `cli/lo/sdk_helpers.py` so the demo module can import the SDK client without importing the typer app surface
- Existing commands (`configure`, `deploy`, `status`, `query`, `reduce`, `modules`, `export`) gain an internal `--quiet` flag the demo uses so the SDK doesn't print to stdout during the gauntlet (the TUI owns the screen)

---

## 11. Error handling

| Failure | Behavior |
|---|---|
| Local engine crashes mid-corpus | Catch; render calm single-line error in TUI (`▶ cluster ✗ corpus skipped, receipt preserved in error log`); advance to next corpus; never crash binary |
| Cloud replay unreachable | Fall back to cached cloud hash from latest rehearsal; show match with small "cached" badge |
| Client file unsupported | Clear single-line message; offer bundled corpus as substitute beat |
| Terminal too small | Detect at startup; refuse to start with clear "needs 200×60 terminal" message |
| API key missing for `replay --cloud` | Skip tail entirely; show local artifacts only with note "cloud replay disabled, no API key" |

The TUI must never crash or render a stack trace during the live segment. All errors get a calm one-line treatment in the status pane.

---

## 12. Testing & rehearsal

**`lo demo rehearse` (the most important command in the build):**

Runs the gauntlet headless (no TUI), with machine-readable output. Asserts:

- [ ] All 5 corpora ingest to expected `corpus.ndjson` SHA-256 (per `golden.json`)
- [ ] All 5 OCEAN runs produce expected artifact SHA-256 (per `golden.json`)
- [ ] Cloud replay returns hashes matching the local ones
- [ ] Total wall time < 18 minutes (leaves 12-min buffer)
- [ ] No verb takes > 45 seconds (no awkward silent pauses on stage)
- [ ] Terminal size detection works correctly

Run this in the venue, on the demo laptop, the morning of the meeting. If anything fails, abort.

**Unit tests:**
- Each ingest adapter round-trips a known fixture to known normalized SHA-256
- The `golden.json` is checked into the repo and pinned

**Integration tests:**
- Canonical `.ocean` program produces golden artifact SHAs across all 5 corpora
- Cloud replay produces matching hashes against a staging backend

**E2E test:**
- `lo demo rehearse` returns exit code 0 within timing budget

---

## 13. Out of scope

- Multi-tenant demo session management (one demo, one operator)
- Web-based version of the demo (terminal only)
- Custom corpus authoring tools (the five corpora are hard-coded)
- Internationalization of narration strings
- Recorded video replay mode (the demo is live; pre-recorded asciinema would defeat the determinism narrative)
- Authentication flow for the operator (assumed `LO_API_KEY` is set in the environment before the demo)

---

## 14. Implementation order

1. `cli/lo/sdk_helpers.py` — extract `_get_client()`
2. `cli/lo/demo/program.ocean` — the canonical program
3. `cli/lo/demo/ingest.py` — five ingest adapters; unit tests pinning SHA-256s
4. `cli/lo/demo/corpora/*` — pre-ingested NDJSON caches + manifests
5. `cli/lo/demo/runner.py` — local OCEAN execution
6. `cli/lo/demo/receipts.py` — SHA-256, cost meter, oceanlog
7. `cli/lo/demo/tui.py` — 4-pane Live layout
8. `cli/lo/demo/sequencer.py` — flow control + operator brakes
9. `cli/lo/demo/replay.py` — cloud-replay tail
10. `cli/lo/demo/client_data.py` — "and-now-yours"
11. `cli/lo/demo/golden.json` — expected hashes pinned
12. `lo demo rehearse` — headless verification command
13. Wire into [main.py](cli/lo/main.py); test end-to-end
