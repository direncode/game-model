# Showcase stdlib + unified `ocean` CLI — design spec

*Date: 2026-05-11 · Status: approved (sections 1-3, with IP protection
constraint added in §6) · Author: brainstorming session*

This spec covers two coordinated subsystems shipping together: a set of
showcase imports under `stdlib/` that turn six existing proof-artifact
showcase pages into callable OCEAN presets, and a unified `ocean` CLI
that puts the whole language behind one binary. The two ship together
because they meet at one user moment: typing `ocean run pulse.uspto`
and watching the substrate run.

The design is explicit about IP protection. The pip-published package
ships the language tooling, free-tier operator implementations, and
the SOURCE of every preset including premium variants. It does not
ship implementations of `embed.content_fp48`, `reduce.btut`,
`cluster.tcd_recursive_loop`, or `align.dispersion`; those algorithms
remain trade secrets executed only by the proprietary backend behind
an API key. The trim pattern from `packages/ocean-mcp/` (commit
`4801f1c`) is reused.

---

## 1. Audience and rationale

### 1.1 Primary audience

A developer who has just heard about OCEAN, opens a terminal, runs
`pip install latentocean-ocean`, and types `ocean run pulse.uspto`. In
under 10 seconds, they see a substrate-clustering pipeline finish, an
artifact land on disk, and a dispersion score printed in the terminal.
This is the muscle-memory moment that converts a curious developer
into someone who already speaks OCEAN's vocabulary.

### 1.2 Secondary audience

A buyer evaluating LatentOcean for production. The same developer
inside the buyer's team types `ocean run pulse.uspto_pro` with
`OCEAN_API_KEY` set, sees a 5-10% higher dispersion than the
free-tier path, and learns by direct inspection what the paid tier
adds. The website's showcase pages render the same delta visually
for non-technical buyers.

### 1.3 The strategic frame

The handbook (chapter 14) names a deployment surface list: Postgres
extension, MCP server, HTTP API, CLI, agent loops. The CLI surface
has been documented but not built. The showcase pages have shipped
but as one-off proof artifacts, not as VOCABULARY. This spec turns
both into substrate-status surfaces: every showcase becomes a named
preset that developers type unprompted, and the CLI is the binary
those developers actually have on disk.

---

## 2. Sub-project A: Showcase imports

### 2.1 The six showcases

| Namespace | Headline preset | Domain | Demo records |
| --- | --- | --- | --- |
| `pulse` | `pulse.uspto` | USPTO inventor records | 500 |
| `atlas` | `atlas.arxiv` | arXiv physics preprints | 500 |
| `receipt` | `receipt.edgar` | SEC EDGAR filings | 500 |
| `docsouth` | `docsouth.narratives` | Documenting the American South narratives | 200 |
| `titan` | `titan.<dataset>` | Titan benchmark suite (named in implementation plan) | 300 |
| `universal` | `universal.<dataset>` | Cross-domain universal substrate (named in implementation plan) | 400 |

Each namespace gets a free-tier preset (named `pulse.uspto`, etc.)
and a premium variant suffixed `_pro` (`pulse.uspto_pro`). The
canonical preset is free-tier so it works zero-key.

The exact dataset names for `titan` and `universal` are deferred to
the implementation plan because they depend on which validation
corpora the team wants to canonize. The plan must pick names from
the existing `data/validation/` artifacts and not invent new ones.

### 2.2 Stdlib file shape

Per showcase, one `.ocean` file with two `define` blocks:

```ocean
# packages/ocean-cli/src/ocean_cli/stdlib/pulse.ocean

## pulse.uspto — USPTO inventor records, free-tier
define uspto(
    corpus = "stdlib/data/pulse/uspto_demo.ndjson",
    target = 500,
    embed_dim = 128,
    iters = 16,
    output = "data/showcases/pulse/uspto_artifact.json"
) do
    seed 42
    load corpus take target records balanced by directorate
                                  label field is directorate
    embed text into embed_dim dimensions using tf-idf
    cluster for iters rounds max 24 modules
            using kmeans energy = corpus mean
    align modules using 50 nearest records
            fine label field is primary_class
    find dispersion of each label
    save to output
end

## pulse.uspto_pro — same shape, premium operators, requires OCEAN_API_KEY
define uspto_pro(
    corpus = "stdlib/data/pulse/uspto_demo.ndjson",
    target = 500,
    output = "data/showcases/pulse/uspto_artifact_pro.json"
) do
    seed 42
    load corpus take target records balanced by directorate
                                  label field is directorate
    reduce records using btut target 300 survivors budget $5
    embed text into 48 dimensions using content fingerprint
    cluster for 16 rounds max 24 modules
            using tcd recursive loop
            crystallize every 4
            energy = corpus mean
    align modules using 50 nearest records
            fine label field is primary_class
    find dispersion of each label
    save to output
end
```

Same shape for the other five namespaces. The `_pro` variant changes
only the variants attached to `embed`, `reduce`, and `cluster`; the
verb skeleton is identical.

### 2.3 Bundled demo corpora

```
packages/ocean-cli/src/ocean_cli/stdlib/data/
  pulse/uspto_demo.ndjson           500 rows, ~150 KB
  atlas/arxiv_demo.ndjson           500 rows, ~140 KB
  receipt/edgar_demo.ndjson         500 rows, ~180 KB
  docsouth/narratives_demo.ndjson   200 rows, ~80 KB
  titan/<dataset>_demo.ndjson       300 rows, ~120 KB
  universal/<dataset>_demo.ndjson   400 rows, ~150 KB
```

Total bundled corpora: roughly 800 KB across six files. Bundled
inside the pip package so `ocean run pulse.uspto` works zero-args
zero-network.

Generation: each demo corpus is produced by a one-time deterministic
sample from the production corpus. The sampling script
(`scripts/showcase_corpora/sample_demos.py`) is committed; the demos
themselves are byte-identical across regenerations at the same seed.

The sampled rows must be public-domain or otherwise unencumbered.
USPTO, arXiv, EDGAR, and DocSouth corpora are all explicitly public.
Titan and Universal demo corpora must use only public-domain rows;
the implementation plan calls out a license check.

### 2.4 Pre-baked artifacts

```
data/showcases/
  pulse/uspto_artifact.json          produced by pulse.uspto(), free-tier
  pulse/uspto_artifact.json.sha256
  pulse/uspto_artifact_pro.json      produced by pulse.uspto_pro(), premium
  pulse/uspto_artifact_pro.json.sha256
  atlas/...
  receipt/...
  docsouth/...
  titan/...
  universal/...
```

The free-tier artifact is reproducible by anyone with the pip
package: `ocean run pulse.uspto` produces a byte-identical file.

The premium artifact is reproducible only by holders of
`OCEAN_API_KEY`. It is committed because the website renders it;
the SHA-256 sidecar lets an auditor verify the published artifact
matches what the proprietary runner produces.

### 2.5 Page-to-import wiring

Each existing showcase page is rewritten as a JSON-renderer of the
two artifact files. The page imports both JSONs at build time
(Next.js static import), renders them side-by-side, and embeds the
preset's `.ocean` source inline with Copy and Run buttons. The
"Run" button calls `/api/handbook/run` for the free-tier preset;
the premium button surfaces the API-key prompt.

Roughly: each showcase page collapses to ~200 lines from its current
sprawl. The pipeline lives in the .ocean file. The page is a
renderer.

### 2.6 CI drift gate

`scripts/handbook/build.py --check` extends with a new validator
`validate_showcase_artifacts` that runs each free-tier preset against
its bundled demo corpus and asserts the resulting SHA-256 matches the
committed `_artifact.json.sha256`. If a preset is edited without
regenerating the artifact, CI fails. Premium artifacts are NOT
checked in CI (no API key in CI); their freshness is the responsibility
of a release author with the key.

---

## 3. Sub-project B: unified `ocean` CLI

### 3.1 Package and binary

New pip package at `packages/ocean-cli/`, published as
`latentocean-ocean`. Installs a single `ocean` console script. Same
distribution pattern as `packages/ocean-mcp/`: vendored compiler
inside the wheel, no external dependencies beyond pyyaml and httpx.

### 3.2 Subcommand surface

```
ocean run <file.ocean>                  compile + run a file
ocean run <namespace>.<preset>          run a bundled stdlib preset
ocean run <NS>.<P> --corpus=X           ... with corpus override
ocean run <NS>.<P> --target=N           ... with any named-arg override
ocean repl                              interactive REPL
ocean fmt <file> [--write]              canonical formatter
ocean lint <file> [--strict]            style + dead-code
ocean lsp                               LSP server over stdio
ocean mcp                               MCP server over stdio
ocean list ops [--free | --premium]     enumerate operators
ocean list stdlib [--namespace=NS]      enumerate stdlib presets and signatures
ocean new <name> [--template=basic]     scaffold a new .ocean file
ocean version                           print toolchain version
ocean help [<subcommand>]               help (also --help)
```

Eleven primary subcommands plus `help`. No `inspect`, no `diff`, no
`sweep` in v1; documented as REPL one-liners in the handbook.

### 3.3 Preset name resolution

`ocean run <namespace>.<preset>` follows this resolution order:

1. Split on `.` → `(namespace, preset)`.
2. Search `OCEAN_PATH` directories (if set) for `<namespace>.ocean`.
3. Fall back to the bundled stdlib at `<package_root>/stdlib/`.
4. If the namespace file does not exist, fail with `unknown namespace
   '<namespace>'; available: pulse, atlas, receipt, docsouth, titan,
   universal, substrate`.
5. Parse the namespace file. If `<preset>` is not a defined function,
   fail with `unknown preset '<namespace>.<preset>'; available: ...`.
6. Generate a temporary program in `tempfile.NamedTemporaryFile`:
   ```ocean
   import "<resolved-path>" as ns
   ns.<preset>(<key=value, key=value, ...>)
   ```
7. Compile + run the temp file. Step timings stream to stdout.

Override syntax: `--corpus=X --target=100` becomes named arguments
`corpus = "X", target = 100` in the generated call. Type coercion
is by the preset's declared parameter type.

### 3.4 Stdlib data path resolution

The bundled stdlib presets reference their demo corpora by relative
path: `"stdlib/data/pulse/uspto_demo.ndjson"`. When the CLI runs a
bundled preset, it sets the working directory to `<package_root>/`
so the relative paths resolve against bundled data.

A user override (`--corpus=...`) takes precedence; if the override is
an absolute path it is used directly, otherwise it is resolved
against the user's current working directory.

### 3.5 Installation

```
pip install latentocean-ocean
ocean version
```

For development from a checkout:

```
pip install -e packages/ocean-cli
```

Runtime dependencies: `pyyaml >= 6.0`, `httpx >= 0.27`. No heavy
deps. The MCP server entry (`ocean mcp`) is the same code path as the
standalone `ocean-mcp` package; users with both installed get two
binaries doing the same thing, which is harmless.

### 3.6 CI matrix

| Workflow file | What runs |
|---|---|
| `.github/workflows/ocean-cli.yml` (new) | pytest on push to `packages/ocean-cli/`, with `ocean run pulse.uspto` and the other five free-tier presets as integration tests |
| `.github/workflows/handbook.yml` (existing, extend) | run `validate_showcase_artifacts` to catch drift between presets and committed free-tier artifacts |
| `.github/workflows/publish-ocean-mcp.yml` | unchanged |
| `.github/workflows/publish-ocean-cli.yml` (new) | runs on git tag matching `ocean-cli-v*`, builds the wheel via the trim script (§6), publishes to PyPI |

---

## 4. Combined developer experience (the canonical demo)

A new developer's first 30 seconds:

```
$ pip install latentocean-ocean
...
$ ocean version
OCEAN 1.0.0
$ ocean list stdlib
substrate:  basic_run, seed_sweep, anomaly_focused, content_vs_structural
pulse:      uspto, uspto_pro
atlas:      arxiv, arxiv_pro
receipt:    edgar, edgar_pro
docsouth:   narratives, narratives_pro
titan:      <dataset>, <dataset>_pro
universal:  <dataset>, <dataset>_pro
$ ocean run pulse.uspto
[step 1/6] load … 42ms · 500 records
[step 2/6] embed … 183ms · Z shape (500, 128)
[step 3/6] cluster … 421ms · 16 modules
[step 4/6] align … 78ms · 50 records per module
[step 5/6] find … 14ms · dispersion: directorate=0.65
[step 6/6] save … 18ms · data/showcases/pulse/uspto_artifact.json
$ ocean run pulse.uspto_pro
[step 1/7] load … 42ms · 500 records
[step 2/7] reduce … this operator (reduce.btut) requires a paid API key;
                    execution is blocked
                    hint: see https://latentocean.com/protocols for an
                    API key, or copy this snippet and run locally with
                    OCEAN_API_KEY set
```

Twelve seconds of typing produces the substrate-status moment: the
developer has run a real OCEAN pipeline, seen its output, and learned
the open-core boundary by direct experience.

---

## 5. Out of scope (explicit)

- A Node.js wrapper for the CLI. The `ocean-mcp` npm wrapper exists
  separately; the new `ocean` CLI is Python-only for v1.
- A Homebrew formula. Pip install is the v1 distribution channel.
- `ocean inspect`, `ocean diff`, `ocean sweep` subcommands. Out of v1.
- Premium operator execution from the CLI without `OCEAN_API_KEY`.
  Same gate as the handbook runner.
- Per-tenant or per-customer stdlib namespaces. v1 stdlib is global.
- Plugin / extension API for third-party stdlib namespaces. v1
  namespaces are vendor-curated.
- Auto-update of the CLI. `pip install -U latentocean-ocean` is the
  only upgrade path.

---

## 6. IP protection (binding)

This section is the load-bearing constraint that determines what does
and does not ship in the public pip package. The LatentOcean IP
strategy is trade-secret-based (per `memory/project_ip_strategy.md`),
not patent-based. The premium operators are the trade secret. Shipping
their implementations in a public wheel destroys the moat. Shipping
their source code in this repo for review is fine; shipping the wheel
that contains them is not.

The existing precedent is `packages/ocean-mcp/scripts/vendor_strip.py`
introduced in commit `4801f1c` ("ocean-mcp: trim publish package").
That script trims the wheel at build time to remove proprietary class
definitions. The new `ocean-cli` package follows the identical
pattern, with one additional concern (the stdlib `_pro` presets).

### 6.1 What does NOT ship in the public wheel

The following files and class definitions are stripped before
`python -m build` produces the publishable wheel:

| Item | Why it is stripped |
|---|---|
| `scripts/operators/embed.py` ContentFP48Embedder class | proprietary 48-bit fingerprint algorithm |
| `scripts/operators/reduce.py` BTUTReducer class | proprietary structural pre-reduction |
| `scripts/operators/cluster.py` TCDRecursiveLoop class | proprietary clustering algorithm |
| `scripts/operators/align.py` DispersionAlignment class | proprietary alignment |
| `scripts/operators/embed.py` content_fp48 registration | wires the name to no implementation |
| `scripts/operators/reduce.py` btut registration | same |
| `scripts/operators/cluster.py` tcd_recursive_loop registration | same |
| `scripts/operators/align.py` dispersion registration | same |
| any internal helper modules referenced only by the four above | transitively proprietary |

After stripping:
- `embed.py` contains only `TfIdfJLEmbedder`, `MinilmL6Embedder`,
  `OneHotNumericEmbedder`.
- `cluster.py` contains only `KMeansBaseline`.
- `reduce.py` contains only the type-check signature for `reduce`;
  no executable reducer.
- `align.py` contains only `ModuleAlignment`.

### 6.2 What DOES ship in the public wheel

The following ARE in the public wheel and that is intentional:

| Item | Why it is safe to publish |
|---|---|
| The lexer, parser, typechecker, compiler-to-DAG, formatter, linter, LSP | language tooling; no proprietary value |
| `OPERATOR_REGISTRY` from `premium_gate.py` | metadata only (operator names, signatures, English summaries); no algorithms |
| Free-tier operator implementations | open-core baseline; documented in the handbook |
| Stdlib `.ocean` SOURCE for `pulse`, `atlas`, etc. INCLUDING the `_pro` variants | the source is just text using variant names; without the proprietary backend, it parses but does not execute |
| Bundled demo corpora `*_demo.ndjson` | public-domain sample data; explicit license review in the implementation plan |
| Pre-baked artifact JSONs `*_artifact.json` and `*_artifact_pro.json` | outputs, public-by-design (the website renders them); no algorithm can be reconstructed from a dispersion score |
| Pre-baked artifact SHA-256 sidecars | hashes of outputs; same reasoning |

The premium `.ocean` source IS in the wheel because:

1. It is the canonical example of the open-core boundary made
   visible. A developer reading `pulse.uspto_pro` learns by direct
   inspection that the verb is the same and only the variant name
   changes.
2. Source text without the implementing classes cannot reproduce
   the algorithm. The variant names (`btut`, `content fingerprint`,
   `tcd recursive loop`) are documented in the handbook and the
   spec; they are not secrets.
3. The runtime gate in `backend/handbook_runner/premium_gate.py`
   and the stripped-wheel operator registry both cause execution
   to fail with the standard "requires API key" diagnostic when a
   premium operator is invoked locally.

### 6.3 The trim mechanism

A new script `packages/ocean-cli/scripts/vendor_strip.py` (modeled
on `packages/ocean-mcp/scripts/vendor_strip.py`) runs before
`python -m build` as part of the wheel build. It:

1. Copies the vendored compiler and operator source into
   `packages/ocean-cli/src/ocean_cli/_vendored/`.
2. Deletes the proprietary class definitions named in §6.1 by AST
   surgery (so trim is robust to import-order changes).
3. Deletes any module that becomes empty after deletion.
4. Writes a `_premium_stubs.py` that registers the premium operator
   names with the runtime registry but maps each to a function that
   raises `PremiumOperatorError("...")` returning the standard
   diagnostic.
5. Emits a `TRIMMED.txt` manifest listing every removed file and
   class for audit.

### 6.4 Pre-publish CI gate

`.github/workflows/publish-ocean-cli.yml` runs `vendor_strip.py`, then
runs a verification step that:

1. Greps the resulting wheel for proprietary identifiers
   (`ContentFP48`, `BTUTReducer`, `TCDRecursiveLoop`, `DispersionAlignment`).
   Any hit fails the publish.
2. Verifies that the wheel's `_premium_stubs.py` is present and that
   it registers all four premium operator names.
3. Verifies that the wheel includes the six stdlib `.ocean` files,
   the bundled demo corpora, and the pre-baked artifact JSONs.
4. Runs `pip install dist/*.whl` in a fresh venv, then runs
   `ocean run pulse.uspto` (free-tier, should succeed) and
   `ocean run pulse.uspto_pro` (premium, should fail with the
   diagnostic).

A publish only proceeds when all four checks pass.

### 6.5 OpenTimeStamps anchoring

Per the IP strategy memory, every release commit of the proprietary
operators is timestamped via OpenTimeStamps. This spec does not
change that workflow; the existing release process anchors the
private full-implementation commits (in the non-public repository if
applicable, or in the private branches of this repository) as a
matter of trade-secret-priority evidence.

The public wheel itself does not need OpenTimeStamps anchoring; it
contains no trade secrets.

### 6.6 What a leak looks like and how this design contains it

If a developer with no API key downloads the public wheel and tries
to extract the algorithms:

- Reading the source `.ocean` files for `_pro` presets shows the
  verb-and-variant syntax. This is documented in the handbook
  publicly. Not a leak.
- Running `pip show -f latentocean-ocean | grep -i fp48` returns
  nothing. The class is not in the wheel.
- Running `ocean run pulse.uspto_pro` returns the premium-gate
  diagnostic. The algorithm cannot be observed at runtime.
- Reading the pre-baked `_artifact_pro.json` shows the OUTPUT of
  running the proprietary pipeline on the demo corpus. The output
  is a dispersion score and a module structure; the algorithm
  cannot be reconstructed from this output (this is the same
  property that makes the primitive spec's commercial commitment
  workable).

If a developer with an API key but no source-code access wants the
algorithm: they call `https://api.latentocean.com/run` with their
key, the server runs the operator, returns the output. The
algorithm is observable only through outputs, which by construction
do not leak it.

---

## 7. Done criteria

The system is shippable when every one of these is true:

1. `pip install -e packages/ocean-cli` succeeds on a fresh Python
   3.11 environment.
2. `ocean version` prints `OCEAN 1.0.0`.
3. `ocean run pulse.uspto`, `atlas.arxiv`, `receipt.edgar`,
   `docsouth.narratives`, `titan.<dataset>`, `universal.<dataset>`
   each complete in under 10 seconds against the bundled demo
   corpus and write a JSON artifact whose SHA-256 matches the
   committed sidecar.
4. `ocean run pulse.uspto_pro` returns the premium-gate diagnostic
   when invoked without `OCEAN_API_KEY`, and runs successfully when
   the key is set and the proprietary backend is reachable.
5. `ocean list ops` lists all 11 operators with tier labels matching
   the registry.
6. `ocean list stdlib` lists 7 namespaces (substrate + 6 new) with
   every preset's full signature including defaults.
7. `ocean new my_pipeline` creates a working `my_pipeline.ocean` that
   `ocean run my_pipeline.ocean` executes cleanly.
8. The six showcase pages on the website render the free-tier and
   premium artifacts side-by-side with the `.ocean` source inline,
   and the Run button on the free-tier source calls
   `/api/handbook/run` successfully.
9. CI fails if a free-tier showcase preset's artifact SHA-256 drifts
   from the committed sidecar.
10. `packages/ocean-cli/scripts/vendor_strip.py` produces a wheel
    that passes all four IP checks in §6.4.
11. The handbook chapter 14 "Interfacing OCEAN" gets a paragraph
    appended showing `ocean run pulse.uspto` as the canonical
    example.

---

## 8. Open questions deferred to implementation

These are not blocking for the design but should be revisited during
the implementation plan.

- **Titan and Universal dataset names.** §2.1 leaves them as
  `<dataset>`. The plan must pick names from the existing
  `data/validation/` artifacts (e.g., `titan.physics_5000` or similar)
  rather than inventing new ones.
- **CLI installation path conflicts.** If a user has both `ocean-mcp`
  (existing) and `latentocean-ocean` (new) installed, both packages
  may try to provide an `ocean-mcp` binary. Recommendation: the new
  package does NOT re-expose `ocean-mcp` as a separate binary; it
  provides `ocean mcp` as a subcommand only. The plan must verify
  no binary-name conflict.
- **Demo corpus license review.** USPTO, arXiv, EDGAR, DocSouth are
  public domain. Titan and Universal demo corpora must be confirmed
  public-domain or otherwise unencumbered before bundling. The plan
  includes a license-check task.
- **Preset name length.** Some natural names (e.g.,
  `docsouth.narratives_pro`) push toward verbosity. The plan
  considers whether to shorten (`docsouth.lit_pro`?) or accept the
  length for clarity.
- **The handbook PDF regeneration.** Adding new chapters or the
  CLI section to the handbook should retrigger the PDF builder. The
  plan adds a CI step.
