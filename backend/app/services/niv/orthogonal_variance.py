"""Orthogonal variance decomposition vs. a benchmark series.

NEW — fills the documented gap in the regenerationism methodology.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass
class OrthogonalVarianceResult:
    fraction: float
    ci_95: tuple[float, float]
    betas: dict[int, float]
    benchmark_series: str
    n_obs: int


def _ols_residual_variance(niv: np.ndarray, X: np.ndarray) -> float:
    ones = np.ones((len(X), 1))
    X_aug = np.hstack([ones, X])
    try:
        betas, _, _, _ = np.linalg.lstsq(X_aug, niv, rcond=None)
    except np.linalg.LinAlgError:
        return 1.0
    predicted = X_aug @ betas
    residuals = niv - predicted
    var_niv = np.var(niv)
    if var_niv < 1e-15:
        return 1.0
    return float(np.var(residuals) / var_niv)


def orthogonal_variance(
    niv: pd.Series,
    benchmark: pd.Series,
    lags: int = 6,
    bootstrap_iters: int = 500,
    benchmark_name: str = "T10Y3M",
) -> OrthogonalVarianceResult:
    """Compute orthogonal variance fraction with bootstrap CI."""
    both = pd.DataFrame({"niv": niv.values, "bench": benchmark.values}).dropna()
    n = len(both)
    if n <= lags + 2:
        return OrthogonalVarianceResult(
            fraction=1.0, ci_95=(0.0, 1.0), betas={}, benchmark_series=benchmark_name, n_obs=n,
        )

    niv_arr = both["niv"].values
    bench_arr = both["bench"].values

    X = np.column_stack([np.roll(bench_arr, k)[lags:] for k in range(lags + 1)])
    y = niv_arr[lags:]
    n_valid = len(y)

    fraction = _ols_residual_variance(y, X)

    ones = np.ones((len(X), 1))
    X_aug = np.hstack([ones, X])
    betas_raw, _, _, _ = np.linalg.lstsq(X_aug, y, rcond=None)
    betas = {k: float(betas_raw[k + 1]) for k in range(lags + 1)}

    rng = np.random.RandomState(42)
    boot_fractions = []
    for _ in range(bootstrap_iters):
        idx = rng.choice(n_valid, n_valid, replace=True)
        boot_frac = _ols_residual_variance(y[idx], X[idx])
        boot_fractions.append(boot_frac)
    ci_lo = float(np.percentile(boot_fractions, 2.5))
    ci_hi = float(np.percentile(boot_fractions, 97.5))

    return OrthogonalVarianceResult(
        fraction=fraction, ci_95=(ci_lo, ci_hi),
        betas=betas, benchmark_series=benchmark_name, n_obs=n_valid,
    )
