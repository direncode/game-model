# lo_core

Latent Ocean core — deterministic structural discovery engine.

## Principles

- **Pure stdlib on the critical path.** No external GenAI. Every finding is reproducible bit-for-bit.
- **Falsification first.** Every shipped claim passes a null-permutation test at α=0.05.
- **Fine-tuning is additive.** A `Generator` ABC defines the seam. Customers drop in their own fine-tuned model; core output shape is unchanged.

## Install

```bash
pip install -e .
```

## CLI

```bash
lo version

lo analyze path/to/btut_output.json --corpus-id my_corpus
lo analyze path/to/btut_output.json -o findings.json

lo narrate findings.json

lo validate path/to/btut_outputs_dir/ --focus my_corpus --iterations 30
```

`lo validate` runs the decisive falsification suite:
- **Null permutation** (N iterations): cross-corpus fingerprint shuffle + role-label shuffle + within-corpus entity shuffle. Any finding that replicates under null at the same level as the true run is rejected.
- **Hold-out split**: density threshold derived from train subset, applied across full set. Tests generalization.

## Python API

```python
from lo_core import analyze_corpus, validate_corpora

findings = analyze_corpus(survivors, corpus_id="corpus_a")

report = validate_corpora(
    {"corpus_a": survivors_a, "corpus_b": survivors_b, ...},
    focus_corpus="corpus_a",
    n_iterations=30,
)

for test in report.null_tests:
    if test.significant_at_0_05:
        print(f"SIGNIFICANT: {test.metric} true={test.true_value} null_p95={test.null_p95}")
```

## Inputs

`lo_core` consumes BTUT pipeline outputs. Each input JSON has the shape:

```json
{
  "summary": { "clusters": N, "wall_seconds": X, ... },
  "survivors": [
    {
      "entity": { "name": "...", "type": "..." },
      "cluster": 0,
      "fingerprint_48bit": "111011...",
      "flips": 7,
      "scores": { "anomaly": 0.9, "composite": 0.95, "diversity": 1.0, "reconstruction": 0.98 }
    }
  ]
}
```

The BTUT pipeline itself (reduction, fingerprinting) is in the main repo. `lo_core` is the analysis + validation layer on top.

## Outputs

### Findings JSON (from `lo analyze`)

```
{
  "corpus_id": "...",
  "survivor_count": ...,
  "cluster_count": ...,
  "paradigm_distribution": { ... hypothesis per corpus ... },
  "convergent_clusters": [ ... ],
  "cross_era_anchors": [ ... ],
  "convergence_index": [ ... ],
  "within_cluster_rank": { ... }
}
```

### Validation report (from `lo validate`)

```
{
  "n_iterations": 30,
  "null_tests": [
    {"metric": "top_bridge_weighted", "true_value": 7.213,
     "null_mean": 4.81, "null_p95": 5.77, "significant_at_0_05": true}
  ],
  "holdout": { ... }
}
```

## Fine-tuning

`lo_core.generators.Generator` is the extension seam:

```python
from lo_core import Generator, TemplateGenerator
from lo_core.schemas import Findings

class MyFineTunedGenerator(Generator):
    def __init__(self, model_path: str):
        # Load your fine-tuned local model
        ...
    def narrate_corpus(self, findings: Findings) -> str:
        return my_model.generate(findings)
    def narrate_entity(self, findings: Findings, entity_name: str) -> str:
        ...
```

`TemplateGenerator` is always available as the deterministic fallback.

## Docker

```bash
docker build -t lo-core .
docker run --rm -v $PWD/data:/data lo-core analyze /data/corpus.json
```

## License

Proprietary.
