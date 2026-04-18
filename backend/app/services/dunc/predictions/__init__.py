"""D-U-N-C match prediction engine.

Triple-layer probability fusion: bookmaker odds + Polymarket crowd
intelligence + ML ensemble, with Claude API interpretation.

This is a football analytics research tool. Not for betting.
"""

from app.services.dunc.predictions.pipeline import PredictionPipeline, get_pipeline

__all__ = ["PredictionPipeline", "get_pipeline"]
