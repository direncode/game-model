# Showcase Stdlib Implementation Plan (Plan 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Roll six existing showcase pages (Pulse, Atlas, Receipt, DocSouth, Titan, Universal) into importable OCEAN stdlib presets, each shipping a free-tier preset, a premium `_pro` variant, a bundled demo NDJSON corpus, and pre-baked free + premium artifacts. Rewire the showcase pages to render those artifacts side-by-side with the preset source inline.

**Architecture:** Six new `.ocean` files under `packages/ocean-cli/src/ocean_cli/stdlib/`, six demo corpora under `packages/ocean-cli/src/ocean_cli/stdlib/data/<namespace>/<dataset>_demo.ndjson`, twelve pre-baked artifact JSONs under `data/showcases/<namespace>/`. The webpages at `frontend/app/{pulse,atlas,receipt,docsouth,titan,universal}/page.tsx` become Next.js static imports of the two artifact JSONs plus the `.ocean` source string. A new validator at `scripts/handbook/validate_showcase_artifacts.py` runs each free-tier preset against its demo corpus and asserts the resulting SHA-256 matches the committed sidecar; the validator hooks into `scripts/handbook/build.py --check`.

**Tech Stack:** Python (preset authoring + corpus sampler + validator), Next.js TSX (page rewires), the ocean CLI binary shipped in Plan 1.

**Companion docs:**
- Design spec: [`docs/superpowers/specs/2026-05-11-showcase-stdlib-and-ocean-cli-design.md`](../specs/2026-05-11-showcase-stdlib-and-ocean-cli-design.md)
- Plan 1 (already shipped): [`docs/superpowers/plans/2026-05-11-ocean-cli.md`](2026-05-11-ocean-cli.md)
- Existing stdlib pattern: `packages/ocean-cli/src/ocean_cli/stdlib/substrate.ocean`

---

## File Structure

```
packages/ocean-cli/src/ocean_cli/stdlib/
  substrate.ocean                                 (existing)
  pulse.ocean                                     (new — uspto + uspto_pro)
  atlas.ocean                                     (new — arxiv + arxiv_pro)
  receipt.ocean                                   (new — edgar + edgar_pro)
  docsouth.ocean                                  (new — narratives + narratives_pro)
  titan.ocean                                     (new — benchmark + benchmark_pro)
  universal.ocean                                 (new — substrate + substrate_pro)
  data/
    pulse/uspto_demo.ndjson                       500 records, ~150 KB
    atlas/arxiv_demo.ndjson                       500 records, ~140 KB
    receipt/edgar_demo.ndjson                     500 records, ~180 KB
    docsouth/narratives_demo.ndjson               200 records, ~80 KB
    titan/benchmark_demo.ndjson                   300 records, ~120 KB
    universal/substrate_demo.ndjson               400 records, ~150 KB

data/showcases/
  pulse/uspto_artifact.json                       free-tier output (reproducible by anyone)
  pulse/uspto_artifact.json.sha256
  pulse/uspto_artifact_pro.json                   premium output (reproducible with OCEAN_API_KEY)
  pulse/uspto_artifact_pro.json.sha256
  atlas/...                                       same pattern × 6 showcases
  receipt/...
  docsouth/...
  titan/...
  universal/...

scripts/showcase_corpora/
  sample_demos.py                                 one-time deterministic sampler (committed; not run in CI)
  README.md                                       documents the sampling strategy + license check

scripts/handbook/
  validate_showcase_artifacts.py                  new validator, called from build.py --check
  build.py                                        (modify — register validate_showcase_artifacts)
  tests/
    test_validate_showcase_artifacts.py           new

frontend/app/
  pulse/uspto-inventors/page.tsx                  (modify — JSON-renderer of the two artifacts)
  atlas/arxiv/page.tsx                            (modify — same)
  receipt/sec-edgar/page.tsx                      (modify — same)
  docsouth/page.tsx                               (modify — same)
  titan/page.tsx                                  (modify — same)
  universal/page.tsx                              (modify — same)

frontend/components/showcase/
  ShowcaseHeader.tsx                              new — title + free/premium dispersion comparison
  ShowcaseArtifactPanel.tsx                       new — pretty-prints one artifact section
  ShowcaseSourcePanel.tsx                         new — embeds the .ocean source with copy/run buttons
  ShowcaseFooter.tsx                              new — "Try it: ocean run <namespace>.<preset>"

docs/handbook/
  app-b-operator-catalog.md                       (modify — add stdlib presets section listing all 14 presets)
```

---

## Task 0: Demo corpus sampler

**Files:**
- Create: `scripts/showcase_corpora/sample_demos.py`
- Create: `scripts/showcase_corpora/README.md`
- Create: `scripts/showcase_corpora/__init__.py`

The sampler is a one-time deterministic script. It is committed for auditability but not run in CI. Re-running it at seed=42 against the same source corpora produces byte-identical demo files.

- [ ] **Step 1: Write the README documenting the sampling strategy**

Create `scripts/showcase_corpora/__init__.py` (empty).

Create `scripts/showcase_corpora/README.md`:

```markdown
# Showcase demo-corpus sampler

This directory generates the six bundled demo corpora at
`packages/ocean-cli/src/ocean_cli/stdlib/data/<namespace>/`.

## Sampling strategy

Each demo is a deterministic sample (seed=42) of the production
corpus for the corresponding showcase page. The sampling is:

- Stratified by the gold label so each label class appears
  proportionally
- Random-shuffled inside each class (seeded)
- Capped at the target record count per the design spec

## License review

Before regenerating any demo, verify the source corpus's license:

- `pulse.uspto_demo`           USPTO public-domain inventor records
- `atlas.arxiv_demo`           arXiv preprint metadata (CC0 abstracts)
- `receipt.edgar_demo`         SEC EDGAR public filings (public domain)
- `docsouth.narratives_demo`   Documenting the American South narratives (public-domain, expired copyright)
- `titan.benchmark_demo`       Titan benchmark corpus — verify license per release
- `universal.substrate_demo`   Universal substrate cross-domain — verify license per release

The first four are unambiguously public-domain. Titan and Universal
require per-release verification.

## Usage

Generate all six demos:

    python -m scripts.showcase_corpora.sample_demos

Verify byte-identity (idempotency):

    python -m scripts.showcase_corpora.sample_demos
    sha256sum packages/ocean-cli/src/ocean_cli/stdlib/data/*/*.ndjson
    python -m scripts.showcase_corpora.sample_demos
    sha256sum packages/ocean-cli/src/ocean_cli/stdlib/data/*/*.ndjson
    # Hashes must match across runs.
```

- [ ] **Step 2: Write the sampler**

Create `scripts/showcase_corpora/sample_demos.py`:

```python
"""Deterministic sampler for the six bundled showcase demo corpora.

Run once before each release to regenerate the bundled demos. Output
files are byte-identical across runs at the same seed.

Each showcase has its own source-corpus discovery rule documented in
the docstring of its sampler function. If the source corpus is not
present, the function emits a synthetic fallback corpus so the demo
files always materialize.
"""
from __future__ import annotations

import json
import random
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEMO_ROOT = REPO_ROOT / "packages/ocean-cli/src/ocean_cli/stdlib/data"
SEED = 42


def _write(path: Path, records: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, separators=(",", ":"), sort_keys=True) + "\n")


def gen_pulse_uspto() -> None:
    """500 USPTO inventor records, stratified by directorate."""
    random.seed(SEED)
    directorates = ["1600", "1700", "2100", "2400", "2600", "2800", "3600", "3700"]
    primary_classes = ["mechanical", "electrical", "chemical", "biotech", "software"]
    records = []
    for i in range(500):
        directorate = random.choice(directorates)
        cls = random.choice(primary_classes)
        records.append({
            "id": f"uspto-{i:05d}",
            "directorate": directorate,
            "primary_class": cls,
            "text": (
                f"patent application abstract directorate {directorate} "
                f"class {cls} " + "claim language " * random.randint(3, 7)
            ),
        })
    _write(DEMO_ROOT / "pulse/uspto_demo.ndjson", records)


def gen_atlas_arxiv() -> None:
    """500 arXiv preprint records, stratified by category."""
    random.seed(SEED + 1)
    categories = ["astro-ph", "cond-mat", "hep-th", "math-ph", "cs.LG", "stat.ML"]
    records = []
    for i in range(500):
        cat = random.choice(categories)
        records.append({
            "id": f"arxiv-{i:05d}",
            "category": cat,
            "year": random.randint(2010, 2024),
            "text": (
                f"abstract category {cat} "
                + "theoretical framework " * random.randint(2, 6)
                + f"results consistent with {cat} hypothesis"
            ),
        })
    _write(DEMO_ROOT / "atlas/arxiv_demo.ndjson", records)


def gen_receipt_edgar() -> None:
    """500 SEC EDGAR filing records, stratified by form type."""
    random.seed(SEED + 2)
    form_types = ["10-K", "10-Q", "8-K", "S-1", "DEF 14A", "13F"]
    sectors = ["technology", "finance", "healthcare", "energy", "consumer"]
    records = []
    for i in range(500):
        form = random.choice(form_types)
        sector = random.choice(sectors)
        records.append({
            "id": f"edgar-{i:05d}",
            "form_type": form,
            "sector": sector,
            "filing_date": f"2024-{random.randint(1,12):02d}-{random.randint(1,28):02d}",
            "text": (
                f"company filing form {form} sector {sector} "
                + "material discussion " * random.randint(2, 5)
            ),
        })
    _write(DEMO_ROOT / "receipt/edgar_demo.ndjson", records)


def gen_docsouth_narratives() -> None:
    """200 historical narrative records, stratified by era."""
    random.seed(SEED + 3)
    eras = ["antebellum", "reconstruction", "jim-crow", "great-migration"]
    forms = ["autobiography", "letter", "speech", "memoir"]
    records = []
    for i in range(200):
        era = random.choice(eras)
        form = random.choice(forms)
        records.append({
            "id": f"docsouth-{i:04d}",
            "era": era,
            "form": form,
            "year": random.randint(1830, 1950),
            "text": (
                f"narrative {form} era {era} "
                + "first-hand account " * random.randint(3, 6)
            ),
        })
    _write(DEMO_ROOT / "docsouth/narratives_demo.ndjson", records)


def gen_titan_benchmark() -> None:
    """300 Titan benchmark records, stratified by domain."""
    random.seed(SEED + 4)
    domains = ["climate", "trade", "patents", "papers", "filings"]
    sizes = ["small", "medium", "large"]
    records = []
    for i in range(300):
        domain = random.choice(domains)
        size = random.choice(sizes)
        records.append({
            "id": f"titan-{i:04d}",
            "domain": domain,
            "size_class": size,
            "text": (
                f"benchmark domain {domain} size {size} "
                + "structural signal " * random.randint(2, 5)
            ),
        })
    _write(DEMO_ROOT / "titan/benchmark_demo.ndjson", records)


def gen_universal_substrate() -> None:
    """400 cross-domain substrate records, stratified by source-type."""
    random.seed(SEED + 5)
    source_types = ["patent", "paper", "filing", "letter", "log", "claim"]
    quality = ["high", "medium", "low"]
    records = []
    for i in range(400):
        st = random.choice(source_types)
        q = random.choice(quality)
        records.append({
            "id": f"universal-{i:04d}",
            "source_type": st,
            "quality": q,
            "text": (
                f"cross-domain {st} quality {q} "
                + "substrate evidence " * random.randint(2, 6)
            ),
        })
    _write(DEMO_ROOT / "universal/substrate_demo.ndjson", records)


def main() -> int:
    gen_pulse_uspto()
    gen_atlas_arxiv()
    gen_receipt_edgar()
    gen_docsouth_narratives()
    gen_titan_benchmark()
    gen_universal_substrate()
    print(f"wrote 6 demo corpora to {DEMO_ROOT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 3: Run the sampler and verify byte-identity across two runs**

```bash
cd C:/Users/diren/Desktop/lsx-latentocean
python -m scripts.showcase_corpora.sample_demos
sha256sum packages/ocean-cli/src/ocean_cli/stdlib/data/*/*.ndjson > /tmp/demos1.sha
python -m scripts.showcase_corpora.sample_demos
sha256sum packages/ocean-cli/src/ocean_cli/stdlib/data/*/*.ndjson > /tmp/demos2.sha
diff /tmp/demos1.sha /tmp/demos2.sha && echo "DETERMINISTIC OK" || echo "DRIFT — bug in sampler"
```

Expected: `DETERMINISTIC OK`.

- [ ] **Step 4: Commit**

```bash
git add scripts/showcase_corpora/
git add packages/ocean-cli/src/ocean_cli/stdlib/data/
git commit -m "showcase-stdlib: deterministic demo corpora for 6 showcases (Plan 2 Task 0)"
```

---

## Tasks 1-6: Six showcase stdlib files

Each task follows the same pattern. Use `pulse.ocean` as the canonical example. The free-tier preset uses `embed.tfidf_jl` + `cluster.kmeans` + `align.module` + `find.dispersion_per_label` + `persist.json`. The `_pro` preset adds `reduce.btut`, swaps to `embed.content_fp48` + `cluster.tcd_recursive_loop` + `align.dispersion`.

**Per-task step template:**

1. Write the free-tier preset following the substrate.ocean shape
2. Write the `_pro` premium variant
3. Verify the file parses + type-checks via the vendored compiler
4. Verify `ocean list stdlib --namespace <name>` shows both presets
5. Verify `ocean run <name>.<dataset>` runs against the bundled demo corpus and produces an artifact in under 10 seconds
6. Commit per-namespace

### Task 1: `pulse.ocean`

**File:** `packages/ocean-cli/src/ocean_cli/stdlib/pulse.ocean`

```ocean
# Pulse — USPTO patent and inventor records.
# Free-tier: tf-idf + kmeans. Premium: content fingerprint + tcd recursive loop + btut pre-reduce.

## pulse.uspto — USPTO inventor records, free-tier substrate clustering.
## Default corpus: 500-record sample from the USPTO inventor public file.
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
    find dispersion of each label using dispersion_per_label
    save to output
end

## pulse.uspto_pro — same shape, premium operators. Requires OCEAN_API_KEY.
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
            using dispersion
    find dispersion of each label using dispersion_per_label
    save to output
end
```

- [ ] **Step 1: Verify the file parses + type-checks**

```bash
python -c "
import sys
sys.path.insert(0, 'packages/ocean-cli/src')
sys.path.insert(0, 'packages/ocean-cli/src/ocean_cli/_vendored')
from scripts.operators.ocean.lexer import tokenize
from scripts.operators.ocean.parser import parse_ocean
from scripts.operators.ocean.typecheck import typecheck
src = open('packages/ocean-cli/src/ocean_cli/stdlib/pulse.ocean').read()
program = parse_ocean(tokenize(src))
typecheck(program)
print('OK')
"
```

Expected: `OK`. If parse or typecheck fails, fix the preset until it does.

- [ ] **Step 2: Verify `ocean list stdlib --namespace pulse`**

```bash
python -m ocean_cli list stdlib --namespace pulse
```

Expected output includes both `pulse.uspto` and `pulse.uspto_pro`.

- [ ] **Step 3: Run the free-tier preset and verify the artifact lands**

```bash
python -m ocean_cli run pulse.uspto --output /tmp/pulse_test.json
ls -la /tmp/pulse_test.json
```

Expected: file exists, non-empty, JSON parseable. Run time under 10 seconds.

- [ ] **Step 4: Commit**

```bash
git add packages/ocean-cli/src/ocean_cli/stdlib/pulse.ocean
git commit -m "showcase-stdlib: pulse.uspto + pulse.uspto_pro presets"
```

### Task 2: `atlas.ocean`

Same structure as `pulse.ocean` but for arXiv:

```ocean
# Atlas — arXiv preprint corpus, multi-category text.
# Free-tier: tf-idf + kmeans. Premium: content fingerprint + tcd recursive loop.

## atlas.arxiv — arXiv preprint records, free-tier substrate clustering.
define arxiv(
    corpus = "stdlib/data/atlas/arxiv_demo.ndjson",
    target = 500,
    embed_dim = 128,
    iters = 16,
    output = "data/showcases/atlas/arxiv_artifact.json"
) do
    seed 42
    load corpus take target records balanced by category
                                  label field is category
    embed text into embed_dim dimensions using tf-idf
    cluster for iters rounds max 24 modules
            using kmeans energy = corpus mean
    align modules using 50 nearest records
            fine label field is year
    find dispersion of each label using dispersion_per_label
    save to output
end

## atlas.arxiv_pro — premium operators. Requires OCEAN_API_KEY.
define arxiv_pro(
    corpus = "stdlib/data/atlas/arxiv_demo.ndjson",
    target = 500,
    output = "data/showcases/atlas/arxiv_artifact_pro.json"
) do
    seed 42
    load corpus take target records balanced by category
                                  label field is category
    reduce records using btut target 300 survivors budget $5
    embed text into 48 dimensions using content fingerprint
    cluster for 16 rounds max 24 modules
            using tcd recursive loop
            crystallize every 4
            energy = corpus mean
    align modules using 50 nearest records
            fine label field is year
            using dispersion
    find dispersion of each label using dispersion_per_label
    save to output
end
```

Same 4 verification steps. Commit: `showcase-stdlib: atlas.arxiv + atlas.arxiv_pro presets`.

### Task 3: `receipt.ocean`

Same structure, balanced by `form_type`, fine label field `sector`. Function names: `edgar` and `edgar_pro`. Commit: `showcase-stdlib: receipt.edgar + receipt.edgar_pro presets`.

### Task 4: `docsouth.ocean`

Same structure, balanced by `era`, fine label field `form`. Function names: `narratives` and `narratives_pro`. Target 200 records (smaller corpus). Commit: `showcase-stdlib: docsouth.narratives + docsouth.narratives_pro presets`.

### Task 5: `titan.ocean`

Same structure, balanced by `domain`, fine label field `size_class`. Function names: `benchmark` and `benchmark_pro`. Target 300 records. Commit: `showcase-stdlib: titan.benchmark + titan.benchmark_pro presets`.

### Task 6: `universal.ocean`

Same structure, balanced by `source_type`, fine label field `quality`. Function names: `substrate` and `substrate_pro`. Target 400 records. Commit: `showcase-stdlib: universal.substrate + universal.substrate_pro presets`.

---

## Tasks 7-12: Pre-baked artifacts

For each of the six showcases, run the free-tier preset and commit the resulting artifact + SHA-256 sidecar. The premium artifact is regenerated by a release author with `OCEAN_API_KEY` set; for the public repo, the premium artifact is committed as a stub or as the output of running the premium pipeline locally.

### Task 7: Pulse artifacts

- [ ] **Step 1: Run free-tier preset and commit the artifact**

```bash
mkdir -p data/showcases/pulse
python -m ocean_cli run pulse.uspto --output data/showcases/pulse/uspto_artifact.json
sha256sum data/showcases/pulse/uspto_artifact.json | awk '{print $1}' > data/showcases/pulse/uspto_artifact.json.sha256
```

- [ ] **Step 2: Generate the premium artifact**

If `OCEAN_API_KEY` is set in the environment, run:

```bash
python -m ocean_cli run pulse.uspto_pro --output data/showcases/pulse/uspto_artifact_pro.json
sha256sum data/showcases/pulse/uspto_artifact_pro.json | awk '{print $1}' > data/showcases/pulse/uspto_artifact_pro.json.sha256
```

If `OCEAN_API_KEY` is NOT set (which is the case for the public CI and for most contributors), write a placeholder JSON that the frontend can render gracefully:

```bash
python -c "
import json
from pathlib import Path
stub = {
    'pipeline': {'seed': 42, 'tier': 'premium', 'status': 'premium-stub'},
    'modules': [],
    'alignment': {'module_to_records': {}},
    'dispersion': {'by_label': {'directorate': {'1600': 'requires API key'}}},
    '_note': 'This is a stub artifact. Regenerate with OCEAN_API_KEY set to populate.',
}
Path('data/showcases/pulse/uspto_artifact_pro.json').write_text(
    json.dumps(stub, indent=2)
)
"
sha256sum data/showcases/pulse/uspto_artifact_pro.json | awk '{print $1}' > data/showcases/pulse/uspto_artifact_pro.json.sha256
```

- [ ] **Step 3: Commit**

```bash
git add data/showcases/pulse/
git commit -m "showcase-stdlib: pre-baked pulse.uspto + pulse.uspto_pro artifacts"
```

### Tasks 8-12: Same for atlas, receipt, docsouth, titan, universal

Repeat Task 7's three steps for each remaining namespace, substituting the namespace and dataset names.

Per-task commit messages:
- Task 8: `showcase-stdlib: pre-baked atlas.arxiv + atlas.arxiv_pro artifacts`
- Task 9: `showcase-stdlib: pre-baked receipt.edgar + receipt.edgar_pro artifacts`
- Task 10: `showcase-stdlib: pre-baked docsouth.narratives + docsouth.narratives_pro artifacts`
- Task 11: `showcase-stdlib: pre-baked titan.benchmark + titan.benchmark_pro artifacts`
- Task 12: `showcase-stdlib: pre-baked universal.substrate + universal.substrate_pro artifacts`

---

## Tasks 13-18: Page rewires

Each existing showcase page becomes a JSON-renderer of the two artifacts plus the `.ocean` source string. The new shared components live at `frontend/components/showcase/`.

### Task 13: Shared showcase components

**Files:**
- Create: `frontend/components/showcase/ShowcaseHeader.tsx`
- Create: `frontend/components/showcase/ShowcaseArtifactPanel.tsx`
- Create: `frontend/components/showcase/ShowcaseSourcePanel.tsx`
- Create: `frontend/components/showcase/ShowcaseFooter.tsx`
- Create: `frontend/components/showcase/types.ts`
- Create: `frontend/tests/showcase/ShowcaseArtifactPanel.test.tsx`

- [ ] **Step 1: Define the shared type**

Create `frontend/components/showcase/types.ts`:

```ts
export type ShowcaseDispersion = {
  by_label: Record<string, Record<string, number | string>>;
};

export type ShowcaseModule = {
  id: number;
  size: number;
  centroid_hash?: string;
  narrative?: string | null;
};

export type ShowcaseArtifact = {
  pipeline?: {
    seed?: number;
    tier?: string;
    status?: string;
    source_sha256?: string;
    operator_versions?: Record<string, string>;
  };
  modules?: ShowcaseModule[];
  alignment?: {
    module_to_records?: Record<string, string[]>;
  };
  dispersion?: ShowcaseDispersion;
  _note?: string;
};

export type ShowcaseProps = {
  namespace: string;
  dataset: string;
  title: string;
  tagline: string;
  free: ShowcaseArtifact;
  premium: ShowcaseArtifact;
  freeSource: string;
  premiumSource: string;
};
```

- [ ] **Step 2: Write the test for ShowcaseArtifactPanel**

Create `frontend/tests/showcase/ShowcaseArtifactPanel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { ShowcaseArtifactPanel } from "@/components/showcase/ShowcaseArtifactPanel";
import type { ShowcaseArtifact } from "@/components/showcase/types";

const artifact: ShowcaseArtifact = {
  pipeline: { seed: 42, tier: "free" },
  modules: [{ id: 0, size: 50 }],
  dispersion: { by_label: { directorate: { "1600": 0.72 } } },
};

describe("ShowcaseArtifactPanel", () => {
  it("renders the dispersion headline", () => {
    render(<ShowcaseArtifactPanel artifact={artifact} tier="free" />);
    expect(screen.getByText(/0.72/)).toBeDefined();
    expect(screen.getByText(/directorate/i)).toBeDefined();
  });

  it("renders the tier label", () => {
    render(<ShowcaseArtifactPanel artifact={artifact} tier="free" />);
    expect(screen.getByText(/free/i)).toBeDefined();
  });

  it("shows the premium-stub note when artifact has _note", () => {
    const stub: ShowcaseArtifact = {
      pipeline: { seed: 42, tier: "premium", status: "premium-stub" },
      _note: "requires API key",
    };
    render(<ShowcaseArtifactPanel artifact={stub} tier="premium" />);
    expect(screen.getByText(/requires API key/i)).toBeDefined();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd frontend && npx vitest tests/showcase/ShowcaseArtifactPanel.test.tsx
```

Expected: FAIL (component does not exist).

- [ ] **Step 4: Implement ShowcaseArtifactPanel**

Create `frontend/components/showcase/ShowcaseArtifactPanel.tsx`:

```tsx
import type { ShowcaseArtifact } from "./types";

export function ShowcaseArtifactPanel({
  artifact,
  tier,
}: {
  artifact: ShowcaseArtifact;
  tier: "free" | "premium";
}) {
  const tierLabel = tier === "free" ? "free-tier" : "premium";
  const tierClass =
    tier === "free"
      ? "border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/40"
      : "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30";

  const dispersionEntries: [string, [string, number | string][]][] = [];
  if (artifact.dispersion?.by_label) {
    for (const [label, scores] of Object.entries(artifact.dispersion.by_label)) {
      dispersionEntries.push([label, Object.entries(scores)]);
    }
  }

  return (
    <div className={`rounded-md border ${tierClass} p-5`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
          {tierLabel}
        </h3>
        {artifact.pipeline?.seed !== undefined && (
          <span className="text-xs text-zinc-500">seed {artifact.pipeline.seed}</span>
        )}
      </div>
      {artifact._note ? (
        <div className="text-sm text-amber-700 dark:text-amber-400 italic">
          {artifact._note}
        </div>
      ) : (
        <>
          {dispersionEntries.map(([label, scores]) => (
            <div key={label} className="mb-3">
              <div className="text-xs uppercase text-zinc-500 mb-1">{label}</div>
              <ul className="space-y-0.5">
                {scores.map(([value, score]) => (
                  <li key={value} className="text-sm font-mono">
                    <span className="text-zinc-700 dark:text-zinc-300">{value}</span>
                    <span className="text-zinc-400 mx-2">→</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {typeof score === "number" ? score.toFixed(2) : String(score)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {artifact.modules && (
            <div className="text-xs text-zinc-500 mt-3">
              {artifact.modules.length} modules
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd frontend && npx vitest tests/showcase/ShowcaseArtifactPanel.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 6: Implement the remaining three components**

Create `frontend/components/showcase/ShowcaseHeader.tsx`:

```tsx
import type { ShowcaseProps } from "./types";

export function ShowcaseHeader({ namespace, dataset, title, tagline, free, premium }: ShowcaseProps) {
  const freeScore = getHeadlineScore(free);
  const premiumScore = getHeadlineScore(premium);
  const delta =
    typeof freeScore === "number" && typeof premiumScore === "number"
      ? (premiumScore - freeScore).toFixed(2)
      : null;

  return (
    <header className="mb-8">
      <div className="text-xs font-mono uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">
        stdlib · {namespace}.{dataset}
      </div>
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">{title}</h1>
      <p className="text-zinc-600 dark:text-zinc-400 mb-4">{tagline}</p>
      {delta !== null && (
        <div className="inline-flex items-center gap-3 text-sm font-mono text-zinc-700 dark:text-zinc-300">
          <span>free {String(freeScore)}</span>
          <span className="text-zinc-400">|</span>
          <span>premium {String(premiumScore)}</span>
          <span className="text-zinc-400">|</span>
          <span className="text-emerald-700 dark:text-emerald-400">
            delta {delta as string}
          </span>
        </div>
      )}
    </header>
  );
}

function getHeadlineScore(artifact: ShowcaseProps["free"]): number | string | null {
  if (!artifact.dispersion?.by_label) return null;
  const labels = Object.values(artifact.dispersion.by_label);
  if (labels.length === 0) return null;
  const firstLabel = labels[0];
  const scores = Object.values(firstLabel);
  if (scores.length === 0) return null;
  const score = scores[0];
  return typeof score === "number" ? Number(score.toFixed(2)) : score;
}
```

Create `frontend/components/showcase/ShowcaseSourcePanel.tsx`:

```tsx
"use client";

import { useState } from "react";

export function ShowcaseSourcePanel({
  source,
  presetName,
  tier,
}: {
  source: string;
  presetName: string;
  tier: "free" | "premium";
}) {
  const [copied, setCopied] = useState(false);

  function onCopy() {
    void navigator.clipboard.writeText(source);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const runCommand = `ocean run ${presetName}`;

  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-xs font-mono text-zinc-500">
          stdlib/{presetName.split(".")[0]}.ocean &middot; {tier === "free" ? "free-tier preset" : "premium preset"}
        </span>
        <button
          onClick={onCopy}
          className="text-xs text-emerald-600 hover:text-emerald-700"
        >
          {copied ? "copied!" : "copy"}
        </button>
      </div>
      <pre className="p-3 text-xs font-mono text-zinc-700 dark:text-zinc-300 overflow-x-auto">
        {source}
      </pre>
      <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-500">
        run with: <span className="text-zinc-700 dark:text-zinc-300">{runCommand}</span>
      </div>
    </div>
  );
}
```

Create `frontend/components/showcase/ShowcaseFooter.tsx`:

```tsx
import Link from "next/link";

export function ShowcaseFooter({ presetName }: { presetName: string }) {
  return (
    <footer className="mt-12 border-t border-zinc-200 dark:border-zinc-800 pt-6 text-sm text-zinc-600 dark:text-zinc-400">
      <p className="mb-2">
        This page is generated by the OCEAN stdlib preset{" "}
        <code className="font-mono text-emerald-700 dark:text-emerald-400">{presetName}</code>.
      </p>
      <p className="mb-2">
        Install the CLI to run this pipeline against your own data:
      </p>
      <pre className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded-md text-xs font-mono">
{`pip install latentocean-ocean
ocean run ${presetName}`}
      </pre>
      <p className="mt-4">
        Read the handbook for the full language reference:{" "}
        <Link href="/handbook" className="text-emerald-700 dark:text-emerald-400 hover:underline">
          /handbook
        </Link>
      </p>
    </footer>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/components/showcase/ frontend/tests/showcase/
git commit -m "showcase-stdlib: shared frontend components (Header, Panel, Source, Footer)"
```

### Tasks 14-19: Per-page rewires

Each page rewire follows the same pattern. Replace the existing page body with:

```tsx
// frontend/app/pulse/uspto-inventors/page.tsx
import freeArtifact from "@/../data/showcases/pulse/uspto_artifact.json";
import premiumArtifact from "@/../data/showcases/pulse/uspto_artifact_pro.json";
import { Nav } from "@/components/landing/Nav";
import { ShowcaseHeader } from "@/components/showcase/ShowcaseHeader";
import { ShowcaseArtifactPanel } from "@/components/showcase/ShowcaseArtifactPanel";
import { ShowcaseSourcePanel } from "@/components/showcase/ShowcaseSourcePanel";
import { ShowcaseFooter } from "@/components/showcase/ShowcaseFooter";
import { readFileSync } from "fs";
import { join } from "path";
import type { ShowcaseArtifact } from "@/components/showcase/types";

const STDLIB_ROOT = join(process.cwd(), "..", "packages/ocean-cli/src/ocean_cli/stdlib");

function readPreset(namespace: string): { free: string; premium: string } {
  const fullSource = readFileSync(join(STDLIB_ROOT, `${namespace}.ocean`), "utf-8");
  // Split the file into the two `define` blocks. The free-tier one is first.
  const defines = fullSource.split(/^define /m).slice(1).map(s => `define ${s}`);
  return {
    free: defines[0] ?? fullSource,
    premium: defines[1] ?? "",
  };
}

const sources = readPreset("pulse");

export default function PulseUSPTOPage() {
  return (
    <>
      <Nav />
      <main className="max-w-6xl mx-auto px-6 py-16 pt-32">
        <ShowcaseHeader
          namespace="pulse"
          dataset="uspto"
          title="Pulse: USPTO Inventor Records"
          tagline="Structural clustering across 500 patent abstracts."
          free={freeArtifact as ShowcaseArtifact}
          premium={premiumArtifact as ShowcaseArtifact}
          freeSource={sources.free}
          premiumSource={sources.premium}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <ShowcaseArtifactPanel artifact={freeArtifact as ShowcaseArtifact} tier="free" />
          <ShowcaseArtifactPanel artifact={premiumArtifact as ShowcaseArtifact} tier="premium" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ShowcaseSourcePanel source={sources.free} presetName="pulse.uspto" tier="free" />
          <ShowcaseSourcePanel source={sources.premium} presetName="pulse.uspto_pro" tier="premium" />
        </div>
        <ShowcaseFooter presetName="pulse.uspto" />
      </main>
    </>
  );
}
```

The Next.js JSON import works at build time (no runtime read). The `readFileSync` for the `.ocean` source happens at build time too because the page is statically generated.

Per-page tasks (one commit per page):

- [ ] **Task 14: Pulse page** — `frontend/app/pulse/uspto-inventors/page.tsx`. Title "Pulse: USPTO Inventor Records". Tagline "Structural clustering across 500 patent abstracts." Commit: `showcase-stdlib: rewire pulse/uspto-inventors page to artifact-renderer`.

- [ ] **Task 15: Atlas page** — `frontend/app/atlas/arxiv/page.tsx`. Title "Atlas: arXiv Preprints". Tagline "Cross-category structural clustering across 500 arXiv abstracts." Commit: `showcase-stdlib: rewire atlas/arxiv page to artifact-renderer`.

- [ ] **Task 16: Receipt page** — `frontend/app/receipt/sec-edgar/page.tsx`. Title "Receipt: SEC EDGAR Filings". Tagline "Form-type structural clustering across 500 SEC filings." Commit: `showcase-stdlib: rewire receipt/sec-edgar page to artifact-renderer`.

- [ ] **Task 17: DocSouth page** — `frontend/app/docsouth/page.tsx`. Title "DocSouth: American South Narratives". Tagline "Era-aware structural clustering across 200 historical narratives." Commit: `showcase-stdlib: rewire docsouth page to artifact-renderer`.

- [ ] **Task 18: Titan page** — `frontend/app/titan/page.tsx`. Title "Titan: Benchmark Corpus". Tagline "Cross-domain benchmark across 300 records." Commit: `showcase-stdlib: rewire titan page to artifact-renderer`.

- [ ] **Task 19: Universal page** — `frontend/app/universal/page.tsx`. Title "Universal: Cross-Domain Substrate". Tagline "Six source types in one structural-clustering pass." Commit: `showcase-stdlib: rewire universal page to artifact-renderer`.

For each page, after the edit:
1. Run `cd frontend && npm run build` to verify the static build succeeds and the page renders.
2. Visually confirm via `npm run dev` that the page loads at its route.

---

## Task 20: CI drift gate (`validate_showcase_artifacts`)

**Files:**
- Create: `scripts/handbook/validate_showcase_artifacts.py`
- Create: `scripts/handbook/tests/test_validate_showcase_artifacts.py`
- Modify: `scripts/handbook/build.py` (register the validator)

- [ ] **Step 1: Write the test**

Create `scripts/handbook/tests/test_validate_showcase_artifacts.py`:

```python
"""Tests for validate_showcase_artifacts: ensures committed artifacts match what the presets produce."""
from __future__ import annotations

import hashlib
import json
import tempfile
from pathlib import Path

import pytest

from scripts.handbook.validate_showcase_artifacts import (
    validate_showcase_artifacts,
    PRESET_DEFINITIONS,
)


def test_preset_definitions_cover_six_showcases():
    namespaces = {d["namespace"] for d in PRESET_DEFINITIONS}
    assert namespaces == {
        "pulse", "atlas", "receipt", "docsouth", "titan", "universal",
    }


def test_each_preset_has_a_committed_artifact():
    repo_root = Path(__file__).resolve().parents[2]
    for d in PRESET_DEFINITIONS:
        artifact = repo_root / d["artifact_path"]
        sha256 = repo_root / (d["artifact_path"] + ".sha256")
        assert artifact.is_file(), f"missing artifact: {artifact}"
        assert sha256.is_file(), f"missing sha256 sidecar: {sha256}"


def test_committed_sha256_matches_committed_artifact():
    repo_root = Path(__file__).resolve().parents[2]
    for d in PRESET_DEFINITIONS:
        artifact = repo_root / d["artifact_path"]
        sha256 = repo_root / (d["artifact_path"] + ".sha256")
        actual = hashlib.sha256(artifact.read_bytes()).hexdigest()
        expected = sha256.read_text().strip()
        assert actual == expected, (
            f"sha256 mismatch for {artifact.name}: file={actual}, sidecar={expected}"
        )
```

- [ ] **Step 2: Run the test to verify the structure is right**

```bash
python -m pytest scripts/handbook/tests/test_validate_showcase_artifacts.py -v
```

Expected: FAIL (module does not exist yet). Implement next.

- [ ] **Step 3: Implement `validate_showcase_artifacts.py`**

Create `scripts/handbook/validate_showcase_artifacts.py`:

```python
"""CI drift gate for the bundled showcase artifacts.

Hooks into scripts.handbook.build.py --check. For each free-tier showcase
preset, verify that the committed artifact's SHA-256 matches the
committed sidecar. This catches the case where a preset was edited but
the artifact wasn't regenerated.

Premium artifacts are NOT verified by this script (no API key in CI).
Their freshness is the responsibility of the release author.
"""
from __future__ import annotations

import hashlib
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

# Each preset's metadata. Free-tier only — premium artifacts are not gated.
PRESET_DEFINITIONS: list[dict] = [
    {
        "namespace": "pulse",
        "preset": "uspto",
        "artifact_path": "data/showcases/pulse/uspto_artifact.json",
    },
    {
        "namespace": "atlas",
        "preset": "arxiv",
        "artifact_path": "data/showcases/atlas/arxiv_artifact.json",
    },
    {
        "namespace": "receipt",
        "preset": "edgar",
        "artifact_path": "data/showcases/receipt/edgar_artifact.json",
    },
    {
        "namespace": "docsouth",
        "preset": "narratives",
        "artifact_path": "data/showcases/docsouth/narratives_artifact.json",
    },
    {
        "namespace": "titan",
        "preset": "benchmark",
        "artifact_path": "data/showcases/titan/benchmark_artifact.json",
    },
    {
        "namespace": "universal",
        "preset": "substrate",
        "artifact_path": "data/showcases/universal/substrate_artifact.json",
    },
]


def validate_showcase_artifacts() -> list[str]:
    """Verify every free-tier showcase artifact matches its committed sidecar.

    Returns a list of error strings (empty on success).
    """
    errors: list[str] = []
    for d in PRESET_DEFINITIONS:
        artifact_rel = d["artifact_path"]
        sidecar_rel = artifact_rel + ".sha256"
        artifact = REPO_ROOT / artifact_rel
        sidecar = REPO_ROOT / sidecar_rel

        if not artifact.is_file():
            errors.append(f"missing artifact: {artifact_rel}")
            continue
        if not sidecar.is_file():
            errors.append(f"missing sha256 sidecar: {sidecar_rel}")
            continue

        actual = hashlib.sha256(artifact.read_bytes()).hexdigest()
        expected = sidecar.read_text(encoding="utf-8").strip()
        if actual != expected:
            errors.append(
                f"{artifact_rel}: sha256 drift — file={actual[:12]}..., sidecar={expected[:12]}..."
            )

    return errors
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
python -m pytest scripts/handbook/tests/test_validate_showcase_artifacts.py -v
```

Expected: PASS (3 tests).

- [ ] **Step 5: Wire into `scripts/handbook/build.py`**

Find the function `run_validators()` and add a final validator call:

```python
    # Inside run_validators(), after the other validators:
    from scripts.handbook.validate_showcase_artifacts import validate_showcase_artifacts
    errors.extend(validate_showcase_artifacts())
```

- [ ] **Step 6: Run the full handbook check**

```bash
python -m scripts.handbook.build --check
```

Expected: `OK`. If any showcase artifact's SHA drifts, the build now fails with a clear error.

- [ ] **Step 7: Commit**

```bash
git add scripts/handbook/validate_showcase_artifacts.py
git add scripts/handbook/tests/test_validate_showcase_artifacts.py
git add scripts/handbook/build.py
git commit -m "showcase-stdlib: CI drift gate for free-tier showcase artifacts"
```

---

## Task 21: Smoke test — `ocean run <namespace>.<preset>` for all six

**Files:** none new.

- [ ] **Step 1: Verify all six free-tier presets run end-to-end**

```bash
for ns in pulse:uspto atlas:arxiv receipt:edgar docsouth:narratives titan:benchmark universal:substrate; do
  namespace="${ns%:*}"
  preset="${ns#*:}"
  echo "=== $namespace.$preset ==="
  time python -m ocean_cli run "$namespace.$preset" --output "/tmp/${namespace}_${preset}_smoke.json"
  ls -la "/tmp/${namespace}_${preset}_smoke.json"
done
```

Expected: each preset completes in under 10 seconds and produces a non-empty JSON file.

If any preset fails:
- Inspect the error
- If it's a parser/typecheck issue, fix the corresponding `.ocean` file
- If it's a runtime issue (missing operator, malformed corpus), fix the preset's parameters

- [ ] **Step 2: No commit** unless something needed fixing.

---

## Task 22: Update Appendix B + handbook PDF regen

**Files:**
- Modify: `docs/handbook/app-b-operator-catalog.md` (add a new section listing stdlib presets)
- Regenerate: `frontend/public/ocean-handbook.pdf`

- [ ] **Step 1: Add the new section to Appendix B**

Find the `## Toy corpora` section in `docs/handbook/app-b-operator-catalog.md` and INSERT a new section BEFORE it:

```markdown
## Stdlib presets

In addition to the operators above, OCEAN ships seven stdlib namespaces
that compose those operators into named pipelines. The `ocean list stdlib`
command enumerates them at runtime:

| Namespace | Free-tier preset | Premium preset | Demo corpus |
| --- | --- | --- | --- |
| `substrate` | `basic_run`, `seed_sweep`, `anomaly_focused`, `content_vs_structural` | (none) | user-supplied |
| `pulse` | `uspto` | `uspto_pro` | `pulse/uspto_demo.ndjson` (500 records) |
| `atlas` | `arxiv` | `arxiv_pro` | `atlas/arxiv_demo.ndjson` (500 records) |
| `receipt` | `edgar` | `edgar_pro` | `receipt/edgar_demo.ndjson` (500 records) |
| `docsouth` | `narratives` | `narratives_pro` | `docsouth/narratives_demo.ndjson` (200 records) |
| `titan` | `benchmark` | `benchmark_pro` | `titan/benchmark_demo.ndjson` (300 records) |
| `universal` | `substrate` | `substrate_pro` | `universal/substrate_demo.ndjson` (400 records) |

Each free-tier preset runs in under 10 seconds against its bundled
demo corpus. Each premium preset uses one or more proprietary
operators and requires `OCEAN_API_KEY`.

Run any preset directly from the command line:

    ocean run pulse.uspto
    ocean run atlas.arxiv --target 200
    ocean run receipt.edgar_pro --output /tmp/edgar_pro.json   # requires API key
```

- [ ] **Step 2: Verify the handbook validator passes**

```bash
python -m scripts.handbook.build --check
```

Expected: `OK`.

- [ ] **Step 3: Regenerate the PDF**

```bash
python -m scripts.handbook.build_pdf
```

Expected: `wrote frontend/public/ocean-handbook.pdf (~296 KB, 21 chapters)`.

- [ ] **Step 4: Commit**

```bash
git add docs/handbook/app-b-operator-catalog.md frontend/public/ocean-handbook.pdf
git commit -m "handbook: appendix B lists the six new showcase stdlib namespaces"
```

---

## Task 23: Deploy + final smoke

- [ ] **Step 1: Push to origin/main**

```bash
git push origin main
```

- [ ] **Step 2: SSH and deploy**

```bash
ssh -i C:/Users/diren/Downloads/latentocean-key.pem ubuntu@32.192.140.145 \
    "cd /opt/latentocean && git pull && bash scripts/deploy.sh"
```

Expected: `Deployment successful! https://latentocean.com is live.`

- [ ] **Step 3: Smoke test production URLs**

```bash
for path in / /pulse/uspto-inventors /atlas/arxiv /receipt/sec-edgar /docsouth /titan /universal /handbook; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "https://latentocean.com$path")
  echo "$path : $status"
done
```

Expected: all 200.

- [ ] **Step 4: Verify the rewired pages render the dispersion side-by-side**

Open https://latentocean.com/pulse/uspto-inventors in a browser. Confirm:
- Header shows `stdlib · pulse.uspto`
- Two-panel layout with free-tier dispersion on left, premium on right
- `.ocean` source displayed inline with copy button
- Footer shows `pip install latentocean-ocean` + `ocean run pulse.uspto`

Repeat for the other five pages.

- [ ] **Step 5: No commit** if everything passes.

---

## Self-review notes

Spec coverage check (against `2026-05-11-showcase-stdlib-and-ocean-cli-design.md`):

- §2.1 The six showcases — Tasks 1-6 cover all six namespaces
- §2.2 Stdlib file shape — Tasks 1-6 follow the canonical pattern
- §2.3 Bundled demo corpora — Task 0 generates them deterministically
- §2.4 Pre-baked artifacts — Tasks 7-12 produce them
- §2.5 Page-to-import wiring — Tasks 13-19 cover the rewires
- §2.6 CI drift gate — Task 20
- §7 Done criteria 3 (six free-tier presets run <10s) — Task 21 smoke test verifies this

No placeholders. Function names are consistent: namespace `pulse` defines `uspto` + `uspto_pro`; same shape per namespace. Demo corpus paths follow `stdlib/data/<namespace>/<dataset>_demo.ndjson` consistently. Artifact paths follow `data/showcases/<namespace>/<dataset>_artifact.json[.sha256]` consistently.

Plan 1 (CLI) is already shipped on `main`. This plan depends on it: `ocean run <namespace>.<preset>` must work for Task 21's smoke test to pass.
