# OCEAN Handbook — design spec

*Date: 2026-05-11 · Status: approved (sections 1-3) · Author: brainstorming session*

The OCEAN Handbook is a foundations-up book about the OCEAN language, modeled
on *The C Programming Language* (Kernighan & Ritchie) for tightness and
*Crafting Interpreters* (Nystrom) for prose. It fills the gap between the
marketing pitch (the ocean-mcp README, the landing page) and the formal
reference (`docs/OCEAN_LANG.md`). It is consumable by a programmer who has
never run a clustering pipeline and skimmable by a domain expert who has
never programmed.

The handbook ships in three pieces: markdown source, a Stripe-docs-quality
frontend renderer, and a sandboxed runner that lets readers execute inline
`.ocean` snippets against bundled toy corpora.

---

## 1. Audience and reading paths

### 1.1 Primary audience

A general programmer who knows variables, functions, control flow, and files,
but has never run a clustering pipeline and does not know what TF-IDF,
embeddings, or dispersion are. The book teaches both OCEAN and the
substrate-clustering concepts as they appear.

### 1.2 Secondary audience

A domain expert (analyst, scientist, lawyer, journalist) with no programming
background. The book is not a CS-101 prelude for them, but every chapter has
a "Wider system" sidebar that is readable standalone and that frames how that
chapter's material fits the substrate-status story.

### 1.3 Reading paths (documented in `index.md`)

- **Write OCEAN today.** Ch 1 → 2 → 4 → 5 → 6 → 7 → 8 → 9 → 10. About three hours.
- **Understand the system.** Preface, Ch 1, all "Wider system" sidebars, Ch 13, Ch 14. About one hour.
- **The whole book.** Cover to cover. About six hours read, two days work.

---

## 2. Deliverables

Three independent pieces. Each builds and ships on its own; the markdown
source is the canonical artifact that the other two depend on.

### 2.1 Markdown source — `docs/handbook/`

Numbered chapters and lettered appendices. File names use lowercase kebab-case
with two-digit numeric prefixes. The chapter list, target line counts, and
per-chapter shape are locked in §3.

### 2.2 Frontend renderer — `frontend/app/handbook/`

Stripe-docs-quality static site. Persistent left sidebar, right-rail
on-this-page outline, syntax-highlighted code blocks with copy and run
buttons, deep-linkable headings, client-side fuzzy search. Built at compile
time from `docs/handbook/*.md` into a generated TypeScript content module.
Detailed in §4.

### 2.3 Sandboxed runner — `backend/handbook_runner/`

FastAPI endpoint at `POST /api/handbook/run` that compiles, runs, and returns
step timings plus a truncated artifact preview. Runs are constrained by
subprocess rlimits, gated by Redis token-bucket rate limits, and restricted
to three bundled toy corpora and open-core operators only. Detailed in §5.

---

## 3. Chapter outline and per-chapter shape

### 3.1 Files and target line counts

```
docs/handbook/
  00-preface.md                                        ~150 lines
  01-what-ocean-is.md                                  ~400 lines
  02-your-first-pipeline.md                            ~350 lines
  03-source-files-and-tokens.md                        ~300 lines
  04-the-pipeline-types.md                             ~450 lines
  05-load-and-records.md                               ~400 lines
  06-embed-and-z.md                                    ~500 lines
  07-cluster-and-modules.md                            ~550 lines
  08-align-and-find.md                                 ~500 lines
  09-save-and-the-determinism-contract.md              ~400 lines
  10-control-flow.md                                   ~450 lines
  11-functions-modules-stdlib.md                       ~400 lines
  12-tooling-and-the-lsp.md                            ~350 lines
  13-effective-ocean.md                                ~500 lines
  14-interfacing-ocean.md                              ~450 lines

  app-a-grammar.md                                     ~250 lines
  app-b-operator-catalog.md                            ~400 lines
  app-c-primitive-spec-companion.md                    ~200 lines
  app-d-glossary.md                                    ~250 lines
  app-e-reference-card.md                              ~100 lines
  app-f-exercise-solutions.md                          ~300 lines

  index.md                                             ~100 lines

  Total: ~8,350 lines of prose and code combined.
```

### 3.2 Chapter intent summaries

These define what each chapter must accomplish. Phrasing is intentionally
binding: a chapter is done when its intent statement is true for the reader
who finishes it.

- **00 — Preface.** Establishes who the book is for, what background it
  assumes, and how to read it. Names the three reading paths.
- **01 — What OCEAN Is.** Defines OCEAN as a typed declarative DSL for
  substrate-clustering pipelines. Distinguishes substrate-clustering from
  general data processing. Explains why a DSL rather than a library.
- **02 — Your First Pipeline.** A complete six-line pipeline that loads,
  embeds, clusters, aligns, finds dispersion, and saves. The reader runs it
  and sees output. No grammar yet; the rules are introduced retroactively
  in later chapters.
- **03 — Source Files and Tokens.** Encoding, line endings, comments,
  identifiers, literals (including the `Path` literal class), reserved
  words, the verb namespace.
- **04 — The Pipeline Types.** The seven pipeline types (`Records`, `Z`,
  `Modules`, `Aligned`, `Dispersion`, `Artifact`, `Pipeline`) and the
  static DAG. Why static typing matters for determinism.
- **05 — `load` and `Records`.** NDJSON shape, `take`, `balanced by`,
  `text field is`, `label field is`. What a `Records` value contains.
- **06 — `embed` and `Z`.** TF-IDF + JL projection (the free-tier
  embedder), the MiniLM-L6 transformer embedder, one-hot numeric.
  Choosing dimensions. What `Z` is. The chapter introduces the
  premium `content fingerprint` variant by name and shows its grammar,
  but the runnable snippets all use free-tier embedders so they
  execute end-to-end in the sandbox.
- **07 — `cluster` and `Modules`.** TCD recursive loop, k-means baseline,
  `energy = corpus mean` vs `normal anchored on LABEL`, `crystallize
  every K`, `for N rounds`, `max M modules`.
- **08 — `align` and `find`.** Module-to-record alignment via k-nearest,
  `fine label field`. The `find dispersion of each label` operation and
  what dispersion measures.
- **09 — `save` and the Determinism Contract.** JSON+sha256 artifacts. The
  full determinism contract. What makes runs bit-identical.
- **10 — Control Flow.** `let`, `if/elif/else`, `sweep`, `parallel`,
  `compare ... against ... on ...`. Statement-significant newlines.
- **11 — Functions, Modules, the Stdlib.** `define`, default parameters,
  `import "..." as`, `stdlib/substrate.ocean`, when to author a stdlib
  function.
- **12 — Tooling and the LSP.** Compiler, runner, REPL, formatter, linter,
  LSP, the `ocean-mcp` server.
- **13 — Effective OCEAN.** Idioms (small seeds before sweeps, name your
  bindings, prefer `compare` over duplicate pipelines, use `narrate` last),
  anti-patterns (re-`embed` per branch, hidden upstream dependencies via
  positional defaults), when to reach for which variant.
- **14 — Interfacing OCEAN.** Postgres extension (`pg_latentocean`), the
  HTTP API, the MCP server with Claude/Cursor/Goose, the CLI, and the
  agent-loop pattern.

### 3.3 Per-chapter skeleton (binding)

Every chapter follows the same outline:

```markdown
# Ch N — Title

> One-sentence promise: what the reader will be able to do after this chapter.

## Concepts in this chapter
- bullet 1
- bullet 2
- bullet 3

## [Body sections, code-first, each ending with a working snippet]

## Wider system
A 2-3 paragraph sidebar readable standalone. Explains how this chapter's
material fits the substrate-status story (vocabulary capture, deployment
surface, comparable infrastructure pieces). Domain-expert readers can skim
the body and read just these and still leave coherent.

## Exercises
1-3 exercises building on prior chapters. Solutions in Appendix F.

## What's next
One sentence pointing to the next chapter.
```

### 3.4 Voice and style rules (binding)

- **No first-person.** Never "we", "our", "I". Use "you", "the program",
  "OCEAN", "the compiler".
- **No revenue projections, MRR/ARR forecasts, or month-by-month
  timelines.** Structural claims, cost shapes, forcing functions, and
  measured numbers from artifacts only.
- **No marketing slide voice.** Precise but conversational. Stroustrup-precise
  on semantics; Crafting-Interpreters-warm on prose.
- **Code-first.** Every concept introduced by a runnable snippet, then
  explained. Snippets are kept short enough to fit on screen without
  scrolling on a 1080p display.
- **Em dashes** are allowed in handbook prose. The rule against them
  applies only to displayable slide text.
- **Exercises** are bounded: each must be solvable in under thirty minutes
  using only the material introduced so far.

---

## 4. Frontend renderer

### 4.1 Route structure

```
frontend/app/handbook/
  page.tsx                       renders index.md (TOC and reading paths)
  [chapter]/page.tsx             renders any other handbook/*.md
  layout.tsx                     persistent sidebar + right-rail layout
  components/
    HandbookSidebar.tsx          collapsible chapter list with active highlight
    OnThisPage.tsx               right-rail outline from H2/H3 with IntersectionObserver
    OceanCodeBlock.tsx           syntax-highlighted .ocean code with copy and run
    PrevNext.tsx                 bottom-of-chapter navigation
    WiderSystemCallout.tsx       styled callout box for the Wider system sidebar
    Exercise.tsx                 numbered exercise with hide-by-default solution
    HandbookSearch.tsx           Cmd-K fuzzy search over titles and H2s
```

### 4.2 Build-time content pipeline

```
docs/handbook/*.md
       │
       │   scripts/build_handbook.ts
       │   - parses YAML frontmatter (title, slug, chapter_number)
       │   - extracts H2/H3 headings → outline
       │   - compiles markdown to MDX with custom components
       │   - validates that every chapter follows the binding skeleton (§3.3)
       │   - emits frontend/lib/handbook-content.generated.ts
       │
       ▼
frontend/lib/handbook-content.generated.ts
       │
       ▼
Next.js static generation at build time
```

Generated module shape:

```ts
export type HandbookChapter = {
  slug: string;
  number: number | null;            // null for preface, appendices
  title: string;                    // from frontmatter
  promise: string;                  // the one-sentence promise
  concepts: string[];               // from "Concepts in this chapter"
  bodyMdx: string;                  // compiled MDX of the body
  widerSystem: string;              // compiled MDX of the Wider system sidebar
  exercises: { number: number; prompt: string; solutionSlug: string }[];
  outline: { id: string; text: string; level: 2 | 3 }[];
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
};

export const handbookChapters: HandbookChapter[];
```

### 4.3 Syntax highlighting for `.ocean`

Shiki grammar file at `frontend/lib/ocean-syntax.json`. Token categories:

- **keywords**: `require seed let in as on from to into using with by of do end sweep compare against parallel import step take balanced field is for rounds round max modules module energy crystallize every nearest records record dispersion each label fine anchored dimensions dimension loop recursive tcd tf-idf tfidf content fingerprint one-hot numeric mean corpus normal text define return if then else elif true false not and or`
- **verbs** (distinct highlight): `load embed reduce cluster align find narrate save`
- **types** (distinct highlight): `Records Z Modules Aligned Dispersion Artifact Pipeline Number String Path Bool Any`
- **literals**: int, float, string, path, bool, `${interp}`
- **comments**: `#` to end of line
- **operators**: `= == != < > <= >= + - * /`

### 4.4 `OceanCodeBlock` UX

```
┌────────────────────────────────────────────────────────┐
│  ocean                                  [Copy] [Run ▶] │
├────────────────────────────────────────────────────────┤
│  load tmp/corpus.ndjson take 500 records              │
│  embed text into 128 dimensions                        │
│  cluster for 16 rounds max 24 modules                  │
│  save to data/result.json                              │
├────────────────────────────────────────────────────────┤
│  Output (after Run):                                   │
│    [step 1/4] load … 0.42s · 500 records              │
│    [step 2/4] embed … 1.83s · Z shape (500, 128)      │
│    ...                                                  │
└────────────────────────────────────────────────────────┘
```

Fence info string controls behavior:

- ` ```ocean ` → highlighted, copy enabled, run disabled
- ` ```ocean run ` → highlighted, copy enabled, run enabled, uses default corpus
- ` ```ocean run corpus=toy_nslkdd_200 ` → highlighted, run enabled with named corpus
- ` ```ocean static ` → highlighted, copy disabled (used for grammar excerpts)

Snippets that reference an external file other than a known toy corpus auto-disable the Run button with a tooltip: "Needs local corpus — copy and run in the REPL."

### 4.5 Right-rail on-this-page outline

Built at build time from H2 and H3 headings. Sticky scroll. Active section
highlighted via `IntersectionObserver`. Hidden on screens narrower than
1024px.

### 4.6 Search

Phase 1, shipped in this build: Cmd-K opens a client-side fuzzy search over
chapter titles and H2 headings only. Uses `fuse.js`, dataset baked at build
time into the generated content module. Approximate size ~20KB gzipped, no
infrastructure.

Phase 2, out of scope: full-text search via Algolia DocSearch. Document the
opt-in path in a comment in `HandbookSearch.tsx` so it can be added later
without restructuring.

### 4.7 Theming and layout

Match the existing site's typography and color tokens. Use a three-column
docs shell (sidebar, content, right-rail), not the landing page layout.
Honor the site's existing dark/light toggle. Maximum content column width
~720px for readability.

---

## 5. Sandboxed runner

### 5.1 Endpoint contract

```
POST /api/handbook/run
Content-Type: application/json

Request:
{
  "source": "<ocean source code, max 16 KB>",
  "corpus": "toy_tna_50" | "toy_nslkdd_200" | "toy_climate_100"
}

Success response (200):
{
  "ok": true,
  "compile_ms": 12,
  "run_ms": 873,
  "steps": [
    {"verb": "load",    "duration_ms": 42,  "summary": "500 records"},
    {"verb": "embed",   "duration_ms": 183, "summary": "Z shape (500, 128)"},
    {"verb": "cluster", "duration_ms": 421, "summary": "16 modules"},
    {"verb": "save",    "duration_ms": 18,  "summary": "data/result.json"}
  ],
  "artifact_preview": "<first 4 KB of the persisted JSON, pretty-printed>"
}

Error response (400):
{
  "ok": false,
  "category": "type" | "syntax" | "name" | "runtime" | "import",
  "diagnostic": {
    "line": 5,
    "col": 1,
    "token": "cluster",
    "message": "cluster expects Z, got Records (from 'raw')",
    "hint": "pipe through embed first"
  }
}

Other error responses:
  413 — source larger than 16 KB
  429 — rate limit exceeded (Retry-After header set)
  503 — runner unavailable (sandbox spawn failure, Redis down, etc.)
```

### 5.2 Sandbox limits and enforcement

| Limit | Value | Enforcement |
|---|---|---|
| Wall time | 10s | parent watchdog using `setitimer(ITIMER_REAL)` plus subprocess `Popen.wait(timeout=10)` and SIGKILL on expiry |
| CPU time | 5s | `resource.RLIMIT_CPU` |
| RSS | 256 MB | `resource.RLIMIT_AS` |
| Max file size | 8 MB | `resource.RLIMIT_FSIZE` |
| Open files | 64 | `resource.RLIMIT_NOFILE` |
| Source size | 16 KB | validated server-side before sandbox spawn |
| File writes | only to `/tmp/handbook-run-{uuid}/` | path-prefix validation in `save` verb |
| Network | none | `unshare --net` (Linux) or no-network namespace |
| Corpus uploads | none | only three pre-bundled corpora referenceable by name |

### 5.3 Rate limiting

Redis token bucket per-IP:

- 4 concurrent runs maximum
- 30 runs per minute burst
- 200 runs per hour sustained

On limit-exceeded the endpoint returns 429 with a `Retry-After` header.

### 5.4 Toy corpora (bundled, read-only)

```
backend/handbook_runner/corpora/
  toy_tna_50.ndjson          50 records,  2 archive labels,    ~30 KB
  toy_nslkdd_200.ndjson      200 records, normal/attack types, ~80 KB
  toy_climate_100.ndjson     100 records, 4 regions,           ~50 KB
```

Each corpus has a one-page card in Appendix B documenting its fields,
labels, and which chapter snippets use it.

The corpora are checked in to the repo and shipped inside the runner image.
They are not user-overrideable. Adding a new toy corpus is a code change to
the runner, not a runtime upload.

### 5.5 Premium-operator gate

Free-tier operators (callable from the runner):

- `load.ndjson`
- `embed.tfidf_jl`
- `embed.transformer.minilm_l6` (recently added)
- `cluster.kmeans`
- `align.module`
- `find.dispersion_per_label`
- `persist.json`

Premium operators (parsed + type-checked but execution blocked):

- `embed.content_fp48`
- `reduce.btut`
- `cluster.tcd_recursive_loop`
- `align.dispersion`

When a premium operator is encountered at run time, the runner returns:

```
{
  "ok": false,
  "category": "runtime",
  "diagnostic": {
    "line": N, "col": M, "token": "<op>",
    "message": "this operator requires a paid API key",
    "hint": "see https://latentocean.com/protocols for an API key, or copy this snippet and run locally with OCEAN_API_KEY set"
  }
}
```

The compile and type-check phases always succeed for premium operators so
that error messages elsewhere in the snippet stay accurate. Only execution
is blocked.

### 5.6 Implementation layout

```
backend/handbook_runner/
  __init__.py
  server.py                  FastAPI app exposing /api/handbook/run
  sandbox.py                 subprocess + rlimit + unshare wrapper
  rate_limit.py              Redis token bucket
  premium_gate.py            registry of free vs premium operators
  corpora/
    toy_tna_50.ndjson
    toy_nslkdd_200.ndjson
    toy_climate_100.ndjson
  tests/
    test_sandbox_limits.py       wall, cpu, rss, fsize, nofile
    test_rate_limit.py           burst, sustained, concurrent
    test_premium_gate.py         every premium op produces friendly diagnostic
    test_compile_only.py         every diagnostic from the existing compiler still reaches the client unchanged
    test_corpus_isolation.py     no cross-corpus filesystem access
    test_no_network.py           any attempted outbound connect fails
```

The runner imports and calls into the existing
`scripts/operators/ocean/compiler.py` and a stripped-down operator registry
that only registers free-tier operators. No fork of the compiler.

### 5.7 Deployment

Stateless container behind nginx. Shares Redis with the rest of the
platform. Fits into the existing `docker-compose.prod.yml`. Memory
footprint: ~150 MB resident at idle, ~400 MB peak per active run, capped
at 4 concurrent runs per instance → ~1.6 GB peak per instance.

### 5.8 Failure-mode behavior

| Failure | Client UX |
|---|---|
| Compile error | Inline diagnostic in the code block (red underline + tooltip) |
| Runtime error | Output panel shows diagnostic with line/col |
| Sandbox timeout | "Run exceeded 10s — try a smaller `take N` value" |
| Rate limit (429) | "Slow down — try again in N seconds" with countdown |
| Premium operator | "This operator needs an API key. Get one →" with link |
| Server 503 | "Run endpoint unavailable — copy this snippet and try in the REPL" |
| Network error | Same as 503 |

---

## 6. Cross-piece consistency rules

Things that must stay true across markdown, frontend, and runner.

### 6.1 Single source of truth for the operator catalog

The split between free-tier and premium operators is defined once, in
`backend/handbook_runner/premium_gate.py`. The **catalog table** in
Appendix B (operator name, signature, free/premium tier, English schema)
is generated from that registry at build time, not hand-maintained. The
surrounding prose in Appendix B (when to reach for which operator, design
notes) is hand-written. Drift between the registry and the generated
table becomes a CI failure.

### 6.2 Snippet validation

`scripts/build_handbook.ts` runs every ` ```ocean ` and ` ```ocean run `
fenced block through `ocean_validate` at build time. A type or syntax error
in any embedded snippet fails the handbook build. This catches bit-rot from
language changes.

### 6.3 Toy-corpus references

Snippets that load a toy corpus must reference one of the three bundled
names exactly. The build step verifies this.

### 6.4 Exercise solutions

Every exercise has a solution in `app-f-exercise-solutions.md` under a
heading matching the exercise's stable slug. The build step verifies that
every exercise has a solution and that every solution has an exercise.

### 6.5 Glossary terms

Terms italicized with `_substrate_`, `_module_`, `_dispersion_`, etc. on
their first introduction are checked against `app-d-glossary.md`. Missing
glossary entries fail the build.

---

## 7. What is explicitly out of scope

- **Full-text search.** Phase-2 Algolia integration is documented but not
  built.
- **Inline runnable premium-operator snippets.** Premium operators are
  blocked at the runner. No live demo of them in the handbook.
- **User-uploaded corpora.** Only the three bundled toy corpora are
  available to the runner.
- **PDF / EPUB export.** The book is web-native. PDF export is a
  follow-up.
- **Translations.** English only.
- **Versioning the handbook independently of OCEAN.** Handbook version
  tracks OCEAN language version. Breaking changes to OCEAN cause a
  corresponding handbook revision.
- **A CS-101 prelude for readers with no programming background.** The
  "Wider system" sidebars are the bridge for that audience, not a
  programming primer.

---

## 8. Done criteria

The handbook is shippable when every one of these is true:

1. All 15 chapters and 6 appendices in `docs/handbook/` exist and follow
   the binding skeleton in §3.3.
2. Every chapter's "Wider system" sidebar is readable standalone (no
   forward references to body content).
3. Every snippet in every chapter compiles cleanly through `ocean_validate`.
4. Every snippet marked `run` runs to completion in under 5 seconds against
   its declared corpus, on a typical dev laptop.
5. The frontend renders all chapters with sidebar, right-rail, copy and
   run buttons, prev/next, and Cmd-K search working.
6. The runner enforces every limit in §5.2 (verified by the test suite in
   §5.6).
7. Every premium operator returns the friendly diagnostic in §5.5 when
   executed.
8. The catalog table in Appendix B is generated from
   `backend/handbook_runner/premium_gate.py`; the generated portion
   matches the registry byte-for-byte and a CI check enforces no manual
   edits to that section.
9. CI fails if any snippet, exercise, or glossary reference drifts.
10. The three reading paths in §1.3 each work end-to-end without dead
    links or broken cross-references.

---

## 9. Open questions deferred to implementation

These are not blocking for the design but should be revisited during the
implementation plan.

- **MDX vs plain markdown.** MDX lets `WiderSystemCallout` and `Exercise`
  components be authored inline. Plain markdown keeps the source readable
  to readers who view it on GitHub. Recommendation: MDX, with frontmatter
  and section-heading conventions that degrade gracefully on GitHub.
- **Shiki vs Prism for highlighting.** Shiki produces VS-Code-grade
  highlighting and supports custom JSON grammars cleanly. Prism is
  lighter. Recommendation: Shiki.
- **Where to host the runner.** Vercel Function (cold-start penalty) vs
  dedicated container on the existing infra (faster, more state to
  manage). Recommendation: dedicated container under existing
  `docker-compose.prod.yml`, with a Vercel rewrite from `/api/handbook/run`.
- **Toy corpus licensing.** NSL-KDD has known licensing terms; the toy
  subset must respect them. Verify before shipping the runner image.
