#!/usr/bin/env python3
"""Latent Ocean CLI -- command interface for BTUT query engine.

Usage:
    python backend/cli.py status
    python backend/cli.py survivors --top 10 --type company
    python backend/cli.py analyze RIG
    python backend/cli.py clusters --min-size 2
    python backend/cli.py magnitude AMPG
    python backend/cli.py search "nuclear"
    python backend/cli.py summary
"""

from __future__ import annotations

import json
import os
import sys

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.btut.query_engine import get_query_engine

console = Console()


def _engine():
    return get_query_engine()


@click.group()
@click.option("--json-output", is_flag=True, help="Output as JSON instead of formatted tables")
@click.pass_context
def cli(ctx, json_output):
    """Latent Ocean -- BTUT Intelligence Platform"""
    ctx.ensure_object(dict)
    ctx.obj["json"] = json_output


# ------------------------------------------------------------------
# status
# ------------------------------------------------------------------

@cli.command()
@click.pass_context
def status(ctx):
    """Pipeline status, last run metrics, total entities processed."""
    data = _engine().status()

    if ctx.obj["json"]:
        click.echo(json.dumps(data, indent=2))
        return

    status_text = "[bold green]READY[/]" if data["pipeline_status"] == "ready" else "[bold red]NO DATA[/]"

    console.print(Panel(
        f"  Status:        {status_text}\n"
        f"  Entities:      [bold]{data['total_entities']:,}[/]\n"
        f"  Clusters:      [bold]{data['total_clusters']:,}[/]\n"
        f"  Fingerprints:  [bold]{data['unique_fingerprints']:,}[/]\n"
        f"  Survivors:     [bold]{data['survivor_count']:,}[/]\n"
        f"  Reduction:     [bold]{data['reduction_ratio']:,}x[/]\n"
        f"  Types:         {data['survivor_types']}\n"
        f"  Wall time:     {data['wall_seconds']:.1f}s\n"
        f"  Variance kept: {data['reconstruction'].get('variance_preservation', 0)*100:.1f}%",
        title="[bold]BTUT Pipeline Status[/]",
        border_style="cyan",
    ))


# ------------------------------------------------------------------
# summary
# ------------------------------------------------------------------

@cli.command()
@click.pass_context
def summary(ctx):
    """Full dataset overview with type statistics and extrapolation."""
    data = _engine().summary()

    if ctx.obj["json"]:
        click.echo(json.dumps(data, indent=2))
        return

    console.print(Panel(
        f"  Entities:      [bold]{data['total_entities']:,}[/]\n"
        f"  Clusters:      [bold]{data['total_clusters']:,}[/]\n"
        f"  Fingerprints:  [bold]{data['unique_fingerprints']:,}[/]\n"
        f"  Survivors:     [bold]{data['survivor_count']:,}[/] ({data['reduction_ratio']}x reduction)\n"
        f"  Variance:      {data['reconstruction'].get('variance_preservation', 0)*100:.1f}%\n"
        f"  Coverage d<1:  {data['reconstruction'].get('coverages', {}).get('1.0', 0)*100:.1f}%",
        title="[bold]Dataset Summary[/]",
        border_style="cyan",
    ))

    # Type stats table
    table = Table(title="Entity Type Statistics")
    table.add_column("Type", style="bold")
    table.add_column("Survivors", justify="right")
    table.add_column("Avg Score", justify="right")
    table.add_column("Max Score", justify="right")
    table.add_column("Avg Anomaly", justify="right")

    for t, stats in data.get("type_statistics", {}).items():
        table.add_row(
            t,
            str(stats["count"]),
            f"{stats['avg_composite']:.4f}",
            f"{stats['max_composite']:.4f}",
            f"{stats['avg_anomaly']:.4f}",
        )
    console.print(table)

    # Top 5
    console.print("\n[bold]Top 5 Overall:[/]")
    for i, entry in enumerate(data.get("top_5_overall", []), 1):
        ticker_str = f"[{entry['ticker']}] " if entry["ticker"] else ""
        console.print(f"  {i}. {ticker_str}{entry['name']} ({entry['type']}) -- {entry['composite']:.4f}")

    # Extrapolation
    ext = data.get("extrapolation_3000tb", {})
    if ext:
        console.print(Panel(
            f"  3B entities -> ~{ext.get('estimated_survivors', 0):,} survivors\n"
            f"  Estimated time: ~{ext.get('estimated_hours', 0):.0f} hours",
            title="[bold]3,000 TB Extrapolation[/]",
            border_style="yellow",
        ))


# ------------------------------------------------------------------
# survivors
# ------------------------------------------------------------------

@cli.command()
@click.option("--top", default=20, help="Number of survivors to show")
@click.option("--type", "entity_type", default=None, help="Filter: company, filing, financial_fact")
@click.option("--sort", "sort_by", default="composite", help="Sort by: composite, anomaly, diversity, reconstruction")
@click.pass_context
def survivors(ctx, top, entity_type, sort_by):
    """List top survivors ranked by signal score."""
    data = _engine().survivors(top_n=top, entity_type=entity_type, sort_by=sort_by)

    if ctx.obj["json"]:
        click.echo(json.dumps(data, indent=2))
        return

    table = Table(title=f"Top {top} Survivors" + (f" ({entity_type})" if entity_type else ""))
    table.add_column("#", justify="right", style="dim")
    table.add_column("Ticker", style="bold cyan")
    table.add_column("Name", max_width=35)
    table.add_column("Type", style="dim")
    table.add_column("Score", justify="right", style="bold green")
    table.add_column("Anomaly", justify="right")
    table.add_column("Flips", justify="right")
    table.add_column("Cluster", justify="right")

    for sv in data:
        score = sv["scores"]["composite"]
        anomaly = sv["scores"]["anomaly"]
        score_style = "bold green" if score > 0.8 else "green" if score > 0.7 else ""
        table.add_row(
            str(sv["rank"]),
            sv["ticker"] or "-",
            (sv["name"] or "")[:35],
            sv["type"],
            f"{score:.4f}",
            f"{anomaly:.3f}",
            f"{sv['flips']}/48",
            str(sv["cluster"]),
            style=score_style if score > 0.8 else None,
        )

    console.print(table)

    # Show anomaly stories for top 5
    console.print("\n[bold]Signal Analysis:[/]")
    for sv in data[:5]:
        ticker_str = f"[bold cyan][{sv['ticker']}][/] " if sv["ticker"] else ""
        console.print(f"\n  {ticker_str}{sv['name']}")
        console.print(f"  [dim]{sv['anomaly_story']}[/]")


# ------------------------------------------------------------------
# analyze
# ------------------------------------------------------------------

@cli.command()
@click.argument("ticker")
@click.pass_context
def analyze(ctx, ticker):
    """Full structural analysis for a company by ticker."""
    data = _engine().analyze(ticker)

    if data is None:
        console.print(f"[red]Ticker '{ticker.upper()}' not found in survivors[/]")
        return

    if ctx.obj["json"]:
        click.echo(json.dumps(data, indent=2))
        return

    scores = data["scores"]
    lattice = data["lattice_profile"]

    console.print(Panel(
        f"  Company:    [bold]{data['company_name']}[/]\n"
        f"  Ticker:     [bold cyan]{data['ticker']}[/]\n"
        f"  CIK:        {data['cik']}\n"
        f"  Type:       {data['entity_type']}",
        title=f"[bold]Analysis: {data['ticker']}[/]",
        border_style="cyan",
    ))

    # Scores
    table = Table(title="Signal Scores")
    table.add_column("Axis", style="bold")
    table.add_column("Score", justify="right")
    table.add_column("Weight", justify="right", style="dim")
    table.add_column("Weighted", justify="right")

    weights = {"diversity": 0.35, "reconstruction": 0.40, "anomaly": 0.25}
    for axis in ["diversity", "reconstruction", "anomaly"]:
        s = scores[axis]
        w = weights[axis]
        table.add_row(axis.title(), f"{s:.4f}", f"{w:.0%}", f"{s*w:.4f}")
    table.add_row("[bold]COMPOSITE[/]", f"[bold green]{scores['composite']:.4f}[/]", "", "")
    console.print(table)

    # Lattice
    console.print(Panel(
        f"  Total flips:  {lattice['total_flips']}/{lattice['total_rotations']} ({lattice['flip_rate']*100:.0f}%)\n"
        f"  Fingerprint:  {lattice['fingerprint_48bit']}\n"
        f"  Coarse (4):   {lattice['coarse_resolution']}\n"
        f"  Medium (8):   {lattice['medium_resolution']}\n"
        f"  Fine (16):    {lattice['fine_resolution']}",
        title="[bold]Lattice Profile[/]",
        border_style="yellow",
    ))

    # Cluster
    cl = data["cluster"]
    console.print(f"\n[bold]Cluster {cl['id']}[/] ({cl['total_members']} members)")
    if cl["peers"]:
        console.print("  Peers:")
        for p in cl["peers"][:5]:
            ticker_str = f"[{p['ticker']}] " if p["ticker"] else ""
            console.print(f"    {ticker_str}{p['name']} ({p['type']}) -- {p['composite']:.4f}")

    # Anomaly story
    console.print(Panel(
        data["anomaly_story"],
        title="[bold]Anomaly Narrative[/]",
        border_style="red",
    ))


# ------------------------------------------------------------------
# clusters
# ------------------------------------------------------------------

@cli.command()
@click.option("--min-size", default=1, help="Minimum cluster member count")
@click.option("--top", default=30, help="Max clusters to show")
@click.pass_context
def clusters(ctx, min_size, top):
    """List micro-clusters with type distributions."""
    data = _engine().clusters(min_size=min_size, top_n=top)

    if ctx.obj["json"]:
        click.echo(json.dumps(data, indent=2))
        return

    table = Table(title=f"Clusters (min_size={min_size})")
    table.add_column("ID", justify="right", style="dim")
    table.add_column("Members", justify="right", style="bold")
    table.add_column("Avg Score", justify="right")
    table.add_column("Max Score", justify="right")
    table.add_column("Types")
    table.add_column("Top Member")

    for cl in data:
        types_str = ", ".join(f"{t}:{c}" for t, c in cl["type_distribution"].items())
        top_member = cl["sample_members"][0] if cl["sample_members"] else {}
        top_str = top_member.get("name", "")[:25]
        if top_member.get("ticker"):
            top_str = f"[{top_member['ticker']}] {top_str}"

        table.add_row(
            str(cl["cluster_id"]),
            str(cl["member_count"]),
            f"{cl['avg_composite']:.4f}",
            f"{cl['max_composite']:.4f}",
            types_str,
            top_str[:30],
        )

    console.print(table)


# ------------------------------------------------------------------
# magnitude
# ------------------------------------------------------------------

@cli.command()
@click.argument("ticker")
@click.pass_context
def magnitude(ctx, ticker):
    """Multi-resolution magnitude profile for a ticker."""
    data = _engine().magnitude(ticker)

    if data is None:
        console.print(f"[red]Ticker '{ticker.upper()}' not found[/]")
        return

    if ctx.obj["json"]:
        click.echo(json.dumps(data, indent=2))
        return

    console.print(Panel(
        f"  Company:    [bold]{data['company_name']}[/]\n"
        f"  Ticker:     [bold cyan]{data['ticker']}[/]\n"
        f"  Total flips: {data['total_flips']}/48",
        title=f"[bold]Magnitude: {data['ticker']}[/]",
        border_style="magenta",
    ))

    # Multi-resolution breakdown
    table = Table(title="Multi-Resolution Analysis")
    table.add_column("Resolution", style="bold")
    table.add_column("Fingerprint")
    table.add_column("Flips", justify="right")
    table.add_column("Flip Rate", justify="right")
    table.add_column("Structure Level")

    for name, profile in data.get("multi_resolution_analysis", {}).items():
        table.add_row(
            name.replace("_", " ").title(),
            profile["fingerprint"],
            str(profile["flips"]),
            f"{profile['flip_rate']*100:.0f}%",
            profile["interpretation"],
        )

    console.print(table)

    # Scores
    mp = data["magnitude_profile"]
    console.print(f"\n  Composite:       [bold green]{mp['composite_score']:.4f}[/]")
    console.print(f"  Anomaly:         {mp['anomaly_score']:.4f}")
    console.print(f"  Diversity:       {mp['diversity_score']:.4f}")
    console.print(f"  Reconstruction:  {mp['reconstruction_score']:.4f}")

    console.print(f"\n[dim]{data['anomaly_story']}[/]")


# ------------------------------------------------------------------
# search
# ------------------------------------------------------------------

@cli.command()
@click.argument("keyword")
@click.option("--field", default=None, help="Limit search to field: ticker, company_name, name, concept")
@click.pass_context
def search(ctx, keyword, field):
    """Search across entities by keyword."""
    results = _engine().search(keyword, field=field)

    if ctx.obj["json"]:
        click.echo(json.dumps(results, indent=2))
        return

    if not results:
        console.print(f"[yellow]No results for '{keyword}'[/]")
        return

    table = Table(title=f"Search: '{keyword}'" + (f" (field={field})" if field else ""))
    table.add_column("Ticker", style="cyan")
    table.add_column("Name", max_width=40)
    table.add_column("Type", style="dim")
    table.add_column("Score", justify="right")
    table.add_column("Survivor", justify="center")
    table.add_column("Matched", style="dim")

    for r in results[:30]:
        table.add_row(
            r["ticker"] or "-",
            (r["name"] or "")[:40],
            r["type"],
            f"{r['composite']:.4f}" if r["composite"] else "-",
            "[green]Yes[/]" if r["is_survivor"] else "[dim]No[/]",
            r["matched_field"],
        )

    console.print(table)
    console.print(f"\n  [dim]{len(results)} results found[/]")


# ------------------------------------------------------------------
# help (override default)
# ------------------------------------------------------------------

@cli.command(name="help")
def show_help():
    """Show all available commands with examples."""
    console.print(Panel(
        "[bold cyan]lo status[/]                          Pipeline status\n"
        "[bold cyan]lo summary[/]                         Full dataset overview\n"
        "[bold cyan]lo survivors --top 10 --type company[/]  Top company survivors\n"
        "[bold cyan]lo analyze RIG[/]                     Full Transocean analysis\n"
        "[bold cyan]lo clusters --min-size 2[/]           List clusters\n"
        "[bold cyan]lo magnitude AMPG[/]                  Magnitude profile\n"
        "[bold cyan]lo search \"nuclear\"[/]                Keyword search\n"
        "\n[dim]Add --json-output before any command for JSON output[/]",
        title="[bold]Latent Ocean Commands[/]",
        border_style="cyan",
    ))


if __name__ == "__main__":
    cli()
