"""
OCEAN Substrate · MCM Console · on-premise tactical operator surface.

Native terminal application — runs without a browser, without a web
server, without cloud connectivity. Designed for MCM operations
consoles (CIC, AUV ground station, ATR workstation) where the operator
needs a multi-pane real-time display of substrate output as contacts
stream through the detector chain.

Usage on a tactical workstation:
    python scripts/operators/mine_sweep_console.py
    python scripts/operators/mine_sweep_console.py --rate 20   # contacts/sec simulated
    python scripts/operators/mine_sweep_console.py --features other.parquet

What it shows in real time:
    - LIVE CAMPAIGN MAP   — emerged threat-class modules, counts, depth ranges, alerts
    - PER-CONTACT AUDIT   — the 11 structured fields for the most-recent flagged contact
    - DOCTRINAL ALERT LOG — scrolling log of off-manifold novel-class detections
    - STATUS BAR          — contacts/sec, queue depth, module count, time of day

Operator controls (Ctrl-C to exit):
    Console runs autonomously, mirrors what a Watchstander would see on
    a CIC display while AUV-fed sonar contacts process through substrate.

This is the OPERATIONAL surface. The web showcase at /mine-sweep is
for catalog visibility only. EDGE Group / ADASI integration deploys
this binary (or an equivalent native console) on tactical hardware.
"""
from __future__ import annotations

import argparse
import math
import random
import sys
import time
from collections import Counter, deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np

from rich.align import Align
from rich.console import Console, Group
from rich.layout import Layout
from rich.live import Live
from rich.panel import Panel
from rich.table import Table
from rich.text import Text


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_FEATURES_PARQ = ROOT / "data" / "validation" / "mine_sweep" / "features_uatd_gabor.parquet"

FEATURE_PREFIX = "feat_"
SUBSTRATE_SEED = 42

# ---------------------------------------------------------------------
# Live console state
# ---------------------------------------------------------------------
class ConsoleState:
    def __init__(self):
        self.start_time = time.time()
        self.contacts_processed = 0
        self.last_contact: Optional[dict] = None
        self.module_counts: Counter = Counter()
        self.module_centroids: dict[int, np.ndarray] = {}
        self.module_names: dict[int, str] = {}
        self.event_log: deque = deque(maxlen=12)
        self.doctrinal_alerts: int = 0
        self.alert_log: deque = deque(maxlen=8)
        self.contacts_per_sec = 0.0
        self._tick_history: deque = deque(maxlen=30)

    def push_event(self, text: str, kind: str = "info"):
        ts = datetime.now().strftime("%H:%M:%S")
        self.event_log.appendleft((ts, kind, text))

    def push_alert(self, text: str):
        ts = datetime.now().strftime("%H:%M:%S")
        self.alert_log.appendleft((ts, text))
        self.doctrinal_alerts += 1

    def tick(self):
        now = time.time()
        self._tick_history.append((now, self.contacts_processed))
        if len(self._tick_history) >= 2:
            t0, n0 = self._tick_history[0]
            t1, n1 = self._tick_history[-1]
            dt = max(t1 - t0, 0.001)
            self.contacts_per_sec = (n1 - n0) / dt


# ---------------------------------------------------------------------
# Substrate setup (one-time training on background records)
# ---------------------------------------------------------------------
def setup_substrate(records: list[dict], feature_fields: list[str], state: ConsoleState):
    state.push_event("loading substrate operators", kind="boot")
    sys.path.insert(0, str(ROOT))
    sys.path.insert(0, str(ROOT / "backend"))
    from scripts.operators.embed import NumericDirectEmbedder  # noqa: E402
    from scripts.operators.cluster import TCDRecursiveLoop  # noqa: E402

    bg = [r for r in records if not r["is_positive_strict"]]
    state.push_event(f"training substrate on {len(bg)} bg records", kind="boot")

    import random as _random
    import torch as _torch
    _random.seed(SUBSTRATE_SEED)
    np.random.seed(SUBSTRATE_SEED)
    _torch.manual_seed(SUBSTRATE_SEED)

    embed_op = NumericDirectEmbedder()
    embed_out = embed_op.run(
        {"records": bg},
        seed=SUBSTRATE_SEED,
        config={"fields": feature_fields, "l2_normalize": False},
    )
    Z = embed_out["Z"]
    feat_mean = np.array(embed_out["feature_mean"], dtype=np.float32)
    feat_std = np.array(embed_out["feature_std"], dtype=np.float32)

    cluster_op = TCDRecursiveLoop()
    out = cluster_op.run(
        {"Z": Z, "records": bg},
        seed=SUBSTRATE_SEED,
        config={
            "iters":             16,
            "max_modules":       32,
            "crystallize_every": 2,
            "langevin_steps":    30,
            "energy":            "corpus_mean",
        },
    )
    raw_mods = [m for m in out.get("modules", []) if "centroid_vec" in m]
    if not raw_mods:
        centroids = Z.mean(axis=0, keepdims=True).astype(np.float32)
    else:
        centroids = np.array([m["centroid_vec"] for m in raw_mods], dtype=np.float32)

    state.push_event(f"substrate emerged {centroids.shape[0]} modules", kind="boot")

    # Pre-name modules by inspecting which class dominates each module on bg
    # (background-only training; module names are best-effort heuristics)
    dist = np.linalg.norm(Z[:, None, :] - centroids[None, :, :], axis=2)
    assigns = dist.argmin(axis=1)
    for k in range(centroids.shape[0]):
        members = [bg[i].get("label_class", "?") for i in np.where(assigns == k)[0]]
        if members:
            dominant = Counter(members).most_common(1)[0][0]
            state.module_names[k] = dominant
        else:
            state.module_names[k] = "unassigned"

    state.module_centroids = {k: centroids[k] for k in range(centroids.shape[0])}
    return centroids, feat_mean, feat_std


# ---------------------------------------------------------------------
# Per-contact scoring
# ---------------------------------------------------------------------
def score_contact(record: dict, feature_fields: list[str],
                  centroids: np.ndarray, feat_mean: np.ndarray, feat_std: np.ndarray,
                  state: ConsoleState,
                  alert_threshold: float = 18.0):
    """Score one contact through substrate. Update state. Return audit dict."""
    x = np.array([record[f] for f in feature_fields], dtype=np.float32)
    z = (x - feat_mean) / (feat_std + 1e-8)
    dists = np.linalg.norm(centroids - z, axis=1)
    assigned = int(dists.argmin())
    distance = float(dists[assigned])
    sorted_idx = np.argsort(dists)
    nearest3 = [int(j) for j in sorted_idx[:3]]
    nearest3_dist = [float(dists[j]) for j in sorted_idx[:3]]
    deviation = z - centroids[assigned]
    dev_l2 = float(np.linalg.norm(deviation))
    dev_max_dim = int(np.abs(deviation).argmax())
    dev_max_val = float(deviation[dev_max_dim])

    state.contacts_processed += 1
    state.module_counts[assigned] += 1
    audit = {
        "contact_id":        record.get("tile_id", f"contact_{state.contacts_processed}"),
        "module":            assigned,
        "module_class":      state.module_names.get(assigned, "?"),
        "distance":          round(distance, 3),
        "nearest_3":         nearest3,
        "nearest_3_dist":    [round(d, 3) for d in nearest3_dist],
        "feature_deviation_l2":   round(dev_l2, 3),
        "feature_deviation_dim":  dev_max_dim,
        "feature_deviation_val":  round(dev_max_val, 3),
        "is_positive_strict": bool(record.get("is_positive_strict", False)),
        "is_doctrinal_shift": distance > alert_threshold,
    }
    state.last_contact = audit
    if audit["is_doctrinal_shift"]:
        state.push_alert(
            f"DOCTRINAL SHIFT · contact {audit['contact_id']} · "
            f"dist={distance:.2f} > {alert_threshold}σ · "
            f"nearest=mod-{nearest3[0]} ({state.module_names.get(nearest3[0], '?')})"
        )
    return audit


# ---------------------------------------------------------------------
# Panels
# ---------------------------------------------------------------------
def header_panel() -> Panel:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    title = Text()
    title.append("OCEAN SUBSTRATE", style="bold cyan")
    title.append(" · ", style="dim white")
    title.append("MCM CONSOLE", style="bold white")
    title.append(" · ", style="dim white")
    title.append("STRAIT OF HORMUZ AOR", style="bold white")
    title.append(" · ", style="dim white")
    title.append("DEMO / PUBLIC SONAR ", style="dim yellow")
    title.append("· ", style="dim white")
    title.append(now, style="dim white")
    return Panel(Align.center(title), style="cyan", padding=(0, 1))


def campaign_map_panel(state: ConsoleState) -> Panel:
    table = Table(
        title="Live Campaign Map · emerged threat-class modules",
        title_style="bold white",
        title_justify="left",
        show_header=True,
        header_style="bold cyan",
        border_style="cyan",
        expand=True,
    )
    table.add_column("MOD", style="white", width=5)
    table.add_column("CLASS (dominant in module)", style="white")
    table.add_column("CONTACTS", justify="right", style="white")
    table.add_column("STATUS", justify="left")

    sorted_mods = sorted(state.module_counts.items(), key=lambda kv: -kv[1])
    if not sorted_mods:
        table.add_row("--", "(awaiting first contact)", "--", "[dim]idle[/dim]")
    else:
        max_count = sorted_mods[0][1]
        for k, count in sorted_mods[:12]:
            cls = state.module_names.get(k, "?")
            bar_width = int(20 * count / max_count) if max_count else 0
            bar = "█" * bar_width + "░" * (20 - bar_width)
            status = Text()
            status.append(bar, style="cyan")
            status.append(f"  {count}", style="white")
            # Mark high-count modules
            cls_text = Text(cls, style="bold white")
            if cls == "background":
                cls_text = Text(cls, style="dim white")
            table.add_row(f"mod {k}", cls_text, str(count), status)
    return Panel(table, border_style="cyan", padding=(0, 1))


def audit_panel(state: ConsoleState) -> Panel:
    if state.last_contact is None:
        body = Text("(awaiting first contact)", style="dim white")
        return Panel(body, title="[bold]Per-Contact Audit[/bold] · 11 structured fields", border_style="cyan")

    c = state.last_contact
    grid = Table.grid(padding=(0, 1))
    grid.add_column(style="dim cyan", width=22)
    grid.add_column(style="white")
    grid.add_row("contact_id", c["contact_id"])
    is_pos_marker = "[bold red]POSITIVE[/]" if c["is_positive_strict"] else "[dim]background[/]"
    grid.add_row("ground truth", is_pos_marker)
    grid.add_row("assigned module", f"mod-{c['module']}  ({c['module_class']})")
    distance_color = "yellow" if c["distance"] > 10 else "white"
    grid.add_row("distance to centroid", f"[{distance_color}]{c['distance']:.3f}σ[/{distance_color}]")
    n3 = " / ".join(
        f"mod-{m}({c['nearest_3_dist'][i]:.2f}σ)"
        for i, m in enumerate(c["nearest_3"])
    )
    grid.add_row("nearest 3 alternatives", n3)
    grid.add_row("feature deviation L2", f"{c['feature_deviation_l2']:.3f}")
    grid.add_row("driver feature dim", f"feat_{c['feature_deviation_dim']}  ({c['feature_deviation_val']:+.2f}σ)")
    if c["is_doctrinal_shift"]:
        grid.add_row("classification", "[bold red]NOVEL · DOCTRINAL SHIFT ALERT[/bold red]")
    else:
        grid.add_row("classification", "[green]within known threat manifold[/green]")
    grid.add_row("reproducibility", "[dim]byte-identical from seed=42[/dim]")

    body = Group(
        grid,
        Text(""),
        Text("ROE-compliant audit paragraph (writeable):", style="dim cyan"),
        Text(
            f"  Contact {c['contact_id']} assigned to module {c['module']} "
            f"({c['module_class']}) at {c['distance']:.2f}σ. "
            f"Alternative hypotheses: " + ", ".join(
                f"mod-{m} ({c['nearest_3_dist'][i]:.2f}σ)" for i, m in enumerate(c["nearest_3"])
            )
            + f". Driver: feat_{c['feature_deviation_dim']} deviating {c['feature_deviation_val']:+.2f}σ.",
            style="italic white",
        ),
    )
    border = "red" if c["is_doctrinal_shift"] else "cyan"
    title = "[bold]Per-Contact Audit[/bold] · 11 structured fields"
    return Panel(body, title=title, border_style=border, padding=(0, 1))


def alerts_panel(state: ConsoleState) -> Panel:
    if not state.alert_log:
        body = Text("(no doctrinal-shift alerts yet)", style="dim white")
    else:
        lines = []
        for ts, text in state.alert_log:
            line = Text()
            line.append(f"[{ts}] ", style="dim yellow")
            line.append(text, style="bold red")
            lines.append(line)
        body = Group(*lines)
    return Panel(
        body,
        title=f"[bold]Doctrinal-Shift Alerts[/bold] · {state.doctrinal_alerts} total · novel-class on first occurrence",
        border_style="red",
        padding=(0, 1),
    )


def event_log_panel(state: ConsoleState) -> Panel:
    if not state.event_log:
        body = Text("(no events)", style="dim white")
    else:
        lines = []
        for ts, kind, text in state.event_log:
            line = Text()
            line.append(f"[{ts}] ", style="dim white")
            kind_styles = {
                "boot": "cyan",
                "info": "white",
                "alert": "yellow",
            }
            line.append(f"{kind.upper():<6}", style=kind_styles.get(kind, "white"))
            line.append(" ", style="white")
            line.append(text, style="white")
            lines.append(line)
        body = Group(*lines)
    return Panel(body, title="[bold]Event Log[/bold]", border_style="white", padding=(0, 1))


def status_bar_panel(state: ConsoleState) -> Panel:
    elapsed = time.time() - state.start_time
    bar = Table.grid(padding=(0, 2), expand=True)
    bar.add_column(justify="left")
    bar.add_column(justify="center")
    bar.add_column(justify="center")
    bar.add_column(justify="center")
    bar.add_column(justify="right")
    bar.add_row(
        f"[cyan]contacts[/cyan]: [bold white]{state.contacts_processed}[/]",
        f"[cyan]rate[/cyan]: [bold white]{state.contacts_per_sec:.1f}[/]/s",
        f"[cyan]modules[/cyan]: [bold white]{len(state.module_centroids)}[/]",
        f"[red]alerts[/red]: [bold red]{state.doctrinal_alerts}[/]",
        f"[cyan]uptime[/cyan]: [bold white]{elapsed:.0f}s[/]",
    )
    return Panel(bar, border_style="dim white", padding=(0, 0))


def build_layout(state: ConsoleState) -> Layout:
    layout = Layout()
    layout.split(
        Layout(header_panel(),       name="header", size=3),
        Layout(name="body", ratio=1),
        Layout(alerts_panel(state),  name="alerts", size=10),
        Layout(event_log_panel(state), name="events", size=10),
        Layout(status_bar_panel(state), name="status", size=3),
    )
    body = layout["body"]
    body.split_row(
        Layout(campaign_map_panel(state), name="map", ratio=3),
        Layout(audit_panel(state), name="audit", ratio=4),
    )
    return layout


# ---------------------------------------------------------------------
# Main streaming loop
# ---------------------------------------------------------------------
def discover_feature_fields(record: dict) -> list[str]:
    return sorted(
        (k for k in record if k.startswith(FEATURE_PREFIX)),
        key=lambda s: int(s.split("_")[1]),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--features", type=Path, default=DEFAULT_FEATURES_PARQ,
                        help="parquet file with feat_* columns + label_class")
    parser.add_argument("--rate", type=float, default=12.0,
                        help="simulated contacts per second")
    parser.add_argument("--max-contacts", type=int, default=2000,
                        help="stop after this many contacts")
    parser.add_argument("--shuffle-seed", type=int, default=99,
                        help="seed for contact ordering")
    parser.add_argument("--alert-threshold", type=float, default=18.0,
                        help="off-manifold distance for doctrinal-shift alert")
    args = parser.parse_args()

    if not args.features.exists():
        sys.exit(f"missing {args.features}")

    console = Console()
    state = ConsoleState()

    state.push_event("ocean substrate · mcm console booting", kind="boot")
    state.push_event(f"corpus: {args.features.name}", kind="boot")

    import pyarrow.parquet as pq
    records = pq.read_table(args.features).to_pylist()
    feature_fields = discover_feature_fields(records[0])
    state.push_event(f"loaded {len(records)} records · feat_dim={len(feature_fields)}", kind="boot")

    centroids, feat_mean, feat_std = setup_substrate(records, feature_fields, state)
    state.push_event("entering streaming mode · Ctrl-C to exit", kind="boot")

    # Shuffle records to simulate sensor-stream ordering
    rng = random.Random(args.shuffle_seed)
    stream_records = list(records)
    rng.shuffle(stream_records)
    stream_records = stream_records[: args.max_contacts]

    interval = 1.0 / max(args.rate, 0.5)
    use_screen = sys.stdout.isatty()  # full-screen TUI when interactive; inline rendering otherwise

    try:
        with Live(build_layout(state), console=console, refresh_per_second=8, screen=use_screen) as live:
            for rec in stream_records:
                score_contact(
                    rec, feature_fields, centroids, feat_mean, feat_std,
                    state, alert_threshold=args.alert_threshold,
                )
                state.tick()
                live.update(build_layout(state))
                time.sleep(interval)
        console.print()
        console.print(f"[bold cyan]Console halted.[/bold cyan]  Processed {state.contacts_processed} contacts. "
                      f"{state.doctrinal_alerts} doctrinal-shift alerts.")
    except KeyboardInterrupt:
        console.print()
        console.print(f"[bold yellow]Operator halt (Ctrl-C).[/bold yellow]  Processed {state.contacts_processed} contacts.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
