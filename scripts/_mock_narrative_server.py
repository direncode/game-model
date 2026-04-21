"""Tiny mock narrative server for self-testing narrative_roundtrip.py.

Responds to POST /api/narrative with a deterministic template that
matches the shape of the real Next.js endpoint, so the round-trip
grader can be exercised end-to-end without a live frontend.

Usage:
    python scripts/_mock_narrative_server.py            # port 4321 default
    python scripts/_mock_narrative_server.py --port 4321
"""
from __future__ import annotations

import argparse
import json
from http.server import BaseHTTPRequestHandler, HTTPServer


def render_template(bundle: dict) -> str:
    """Mirrors lo_nlp/.../template output shape. Always grounded, no
    causation, no hype. This is the safety floor that we expect the
    real narrativeClient to return when LO_NARRATIVE_MODE=off."""
    resolved = bundle.get("entity_resolved") or bundle.get("entity_raw") or ""
    org = resolved.split("\u00b7")[0].strip() if "\u00b7" in resolved else resolved
    concept_side = resolved.split("\u00b7")[1].strip() if "\u00b7" in resolved else ""
    composite = float(bundle.get("composite", 0))
    anomaly = float(bundle.get("anomaly", 0))
    recon = float(bundle.get("reconstruction", 0))
    peer_rank = bundle.get("peer_rank")
    universe = bundle.get("universe_size")
    rank_frag = (
        f", ranking {peer_rank} of {universe}"
        if peer_rank and universe else ""
    )
    text = (
        f"{org}'s {concept_side} fact scores {composite:.3f} composite "
        f"in the SEC EDGAR corpus{rank_frag}. The anomaly dimension "
        f"({anomaly:.2f}) and reconstruction ({recon:.3f}) together "
        f"indicate a filing pattern that meaningfully differs from peers."
    )
    return text


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):  # noqa: N802
        if self.path != "/api/narrative":
            self.send_response(404); self.end_headers(); return
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            bundle = json.loads(raw)
        except Exception:
            self.send_response(400); self.end_headers(); return
        narrative = render_template(bundle)
        body = json.dumps({
            "narrative": narrative,
            "provider": "mock",
            "model": "mock-template-v1",
            "cited_claims": [], "uncited_claims": [],
            "citations_ok": True,
            "generated_at": "2026-04-20T00:00:00Z",
            "fallback_used": False,
            "template_output": narrative,
        }).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):  # quiet
        return


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=4321)
    args = ap.parse_args()
    srv = HTTPServer(("127.0.0.1", args.port), Handler)
    print(f"mock narrative server on http://127.0.0.1:{args.port}/api/narrative")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
