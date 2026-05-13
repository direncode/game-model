# lo-cli

The Latent Ocean command-line surface.

## Install

```bash
pip install -e .
```

That registers a `lo` entry-script on PATH.

## Commands

```
lo cmd                  # Interactive menu (claude-cmd style, monochrome)
lo demo                 # Five-corpus gauntlet TUI
lo demo rehearse        # Headless gauntlet against the golden file
lo configure            # Set LO_API_KEY + LO_BASE_URL
lo deploy --config X    # Deploy a fork from a YAML config
```

## Without install

```bash
cd cli
python -m lo cmd
```

## Determinism

`lo._bootstrap` pins `OMP_NUM_THREADS=1` and `MKL_NUM_THREADS=1` before any
numerical operator imports, so artifact SHAs reproduce across machines.
The pin is documented in `cli/lo/demo/golden.json:blas_threads`.

## Tests

```bash
cd cli
python -m pytest tests/
```

Currently 88 tests across operator behaviour, IP-boundary audit,
ingest fuzz, cloud-mock round-trip, and the structured-logging contract.
