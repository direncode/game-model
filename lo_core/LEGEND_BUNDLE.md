# Legend Bundle

`lo_core` is shipped without the legend library. Legends are a separately-distributable set of pre-cached BTUT corpora used for sales demos, benchmarks, and integration tests.

## Bundle contents

Each legend is a BTUT pipeline output JSON with the shape:

```
{
  "summary": { "clusters": N, "wall_seconds": X, "total_entities": M, ... },
  "survivors": [
    {
      "entity": { "name": "...", "type": "..." },
      "cluster": 0,
      "fingerprint_48bit": "...",
      "flips": N,
      "scores": { "anomaly": X, "composite": Y, "diversity": Z, "reconstruction": W }
    },
    ...
  ]
}
```

## Reference bundle (11 legends, ~12 MB)

Stored in the main repo at `scripts/cross_era_analysis/output/` and `scripts/results/`. Published in a consumer-ready ConnectResult shape at `frontend/data/legends/`.

| Legend ID | Description | Survivors |
|---|---|---|
| `edgar` | SEC EDGAR 10-K filings | 499 |
| `heterogeneous` | 1,851-entity cross-era corpus (25/25 markers) | 595 |
| `polymath` | Newton / VN / Leonardo archives | 1,195 |
| `latk_physics` | Physics arXiv papers | ... |
| `latk_mini` | Mini cross-era corpus | ... |
| `linguistics` | Linguistics corpus | ... |
| `patents` | Patent corpus | 937 |
| `tesla` | Tesla patents (includes Wardenclyffe anomaly) | ... |
| `pubmed` | Biomedical abstracts | ... |
| `climate` | Climate science corpus | ... |
| `comtrade` | UN Comtrade trade data | ... |

## Packaging for distribution

```bash
# Build a distributable tarball
cd <repo>
tar -czvf lo-legends-v1.tar.gz \
    scripts/cross_era_analysis/output/*_btut_result_v2.json \
    scripts/results/*_superpower_result.json
```

## Consuming the bundle

```bash
# Extract
tar -xzvf lo-legends-v1.tar.gz -C ./legends/

# Analyze any single legend
lo analyze ./legends/polymath_btut_result_v2.json --corpus-id polymath -o polymath_findings.json

# Validate the whole bundle against null
lo validate ./legends/ --focus polymath --iterations 30
```

## License / redistribution

The analysis engine (`lo_core`) and the legend bundle are separately licensed. The legend bundle contains derived data from original source corpora — downstream redistribution requires verifying the underlying source licenses (SEC public domain, arXiv preprint licenses, patents public domain, etc.).
