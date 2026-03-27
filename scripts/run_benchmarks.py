#!/usr/bin/env python3
"""Benchmark script for Latent Intelligence API response times.

Tests key API endpoints under load and reports latency percentiles.

Usage:
    python scripts/run_benchmarks.py [--base-url http://localhost:8000] [--iterations 100]
"""
import argparse
import asyncio
import statistics
import sys
import time
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

try:
    import httpx
except ImportError:
    print("httpx is required: pip install httpx")
    sys.exit(1)


DEFAULT_BASE_URL = "http://localhost:8000"
DEFAULT_ITERATIONS = 100

ENDPOINTS = [
    ("GET", "/api/v1/datasets", "List datasets"),
    ("GET", "/api/v1/modules", "List modules"),
    ("GET", "/health", "Health check"),
]


async def benchmark_endpoint(
    client: httpx.AsyncClient,
    method: str,
    path: str,
    label: str,
    iterations: int,
    token: str | None = None,
) -> dict:
    """Benchmark a single endpoint and return latency statistics."""
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    latencies: list[float] = []
    errors = 0

    for _ in range(iterations):
        start = time.perf_counter()
        try:
            resp = await client.request(method, path, headers=headers)
            elapsed = (time.perf_counter() - start) * 1000  # ms
            if resp.status_code >= 400:
                errors += 1
            latencies.append(elapsed)
        except Exception:
            errors += 1
            latencies.append((time.perf_counter() - start) * 1000)

    latencies.sort()
    return {
        "label": label,
        "method": method,
        "path": path,
        "iterations": iterations,
        "errors": errors,
        "min_ms": round(latencies[0], 2) if latencies else 0,
        "p50_ms": round(statistics.median(latencies), 2) if latencies else 0,
        "p95_ms": round(latencies[int(len(latencies) * 0.95)] if latencies else 0, 2),
        "p99_ms": round(latencies[int(len(latencies) * 0.99)] if latencies else 0, 2),
        "max_ms": round(latencies[-1], 2) if latencies else 0,
        "mean_ms": round(statistics.mean(latencies), 2) if latencies else 0,
    }


async def authenticate(client: httpx.AsyncClient) -> str | None:
    """Attempt to log in with demo credentials and return a token."""
    try:
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@latentintelligence.ai", "password": "demo2024!"},
        )
        if resp.status_code == 200:
            return resp.json().get("access_token")
    except Exception:
        pass
    return None


async def run_benchmarks(base_url: str, iterations: int) -> None:
    """Run all benchmarks and print a summary table."""
    print(f"Latent Intelligence API Benchmark")
    print(f"Base URL: {base_url}")
    print(f"Iterations per endpoint: {iterations}")
    print("-" * 80)

    async with httpx.AsyncClient(base_url=base_url, timeout=30.0) as client:
        token = await authenticate(client)
        if token:
            print("Authenticated as demo user.")
        else:
            print("Warning: Could not authenticate. Some endpoints may return 401.")

        print()
        print(f"{'Endpoint':<30} {'Min':>8} {'P50':>8} {'P95':>8} {'P99':>8} {'Max':>8} {'Err':>5}")
        print("-" * 80)

        for method, path, label in ENDPOINTS:
            result = await benchmark_endpoint(client, method, path, label, iterations, token)
            print(
                f"{result['label']:<30} "
                f"{result['min_ms']:>7.1f} "
                f"{result['p50_ms']:>7.1f} "
                f"{result['p95_ms']:>7.1f} "
                f"{result['p99_ms']:>7.1f} "
                f"{result['max_ms']:>7.1f} "
                f"{result['errors']:>5}"
            )

    print("-" * 80)
    print("All times in milliseconds.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark Latent Intelligence API")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="API base URL")
    parser.add_argument("--iterations", type=int, default=DEFAULT_ITERATIONS, help="Iterations per endpoint")
    args = parser.parse_args()

    asyncio.run(run_benchmarks(args.base_url, args.iterations))


if __name__ == "__main__":
    main()
