"""Ingest pipeline — unified entry point for all inbound content.

Every message that lands in the NATO Simulation — whether from the
Discord gateway bot, a webhook, a paste box, an RSS poll, or the one-shot
corpus prep — passes through ``pipeline.ingest_message``.
"""

from app.services.nato_sim.ingest.pipeline import ingest_message  # noqa: F401
