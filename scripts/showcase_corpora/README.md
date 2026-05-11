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
- `titan.benchmark_demo`       Titan benchmark corpus - verify license per release
- `universal.substrate_demo`   Universal substrate cross-domain - verify license per release

The first four are unambiguously public-domain. Titan and Universal
require per-release verification.

## Usage

Generate all six demos:

    python -m scripts.showcase_corpora.sample_demos
