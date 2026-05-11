# latentocean-ocean

The OCEAN language CLI — compile, run, format, lint, and inspect OCEAN
substrate-clustering programs.

## Install

```
pip install latentocean-ocean
```

This installs the `ocean` console script.

## Quick start

```
ocean run my_pipeline.ocean
```

OCEAN is a small, statically-typed language for expressing substrate-
clustering pipelines as DAGs of operators (source → embed → reduce →
cluster → align → narrate → persist). The free-tier wheel ships
reference embedders (TF-IDF + JL, MiniLM-L6, one-hot numeric), the
KMeans baseline clusterer, and the module-alignment operator.

Premium operators (`embed.content_fp48`, `reduce.btut`,
`cluster.tcd_recursive_loop`, `align.dispersion`) are recognized by the
type checker but execute only on the hosted runtime at
`api.latentocean.com`. See https://latentocean.com/protocols for keys.

## License

MIT. Copyright (c) 2026 LatentOcean.
