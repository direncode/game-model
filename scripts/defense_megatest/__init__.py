"""Defense megatest harness.

Runs all 8 defense/intelligence verticals plus 5 cross-cutting tests against
the BTUT pipeline on synthetic corpora with injected ground-truth anomalies.
Output: data/validation/defense_megatest.json + a markdown report.

Single command: `python -m scripts.defense_megatest.run [--quick|--full]`.
"""
__version__ = "1.0.0"
