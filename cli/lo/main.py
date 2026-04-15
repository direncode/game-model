"""Latent Ocean CLI — structural intelligence infrastructure."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table

app = typer.Typer(
    name="lo",
    help="Latent Ocean CLI — structural intelligence infrastructure",
    add_completion=True,
)
console = Console()


def _get_client():
    """Create a Latent Ocean client from environment or config."""
    try:
        from latentocean import Client
    except ImportError:
        console.print("[red]latentocean SDK not installed. Run: pip install latentocean[/red]")
        raise typer.Exit(1)

    api_key = os.environ.get("LO_API_KEY", "")
    base_url = os.environ.get("LO_BASE_URL", "https://api.latentocean.io")

    if not api_key:
        # Try config file
        config_path = Path.home() / ".latentocean" / "config.json"
        if config_path.exists():
            cfg = json.loads(config_path.read_text())
            api_key = cfg.get("api_key", "")
            base_url = cfg.get("base_url", base_url)

    if not api_key:
        console.print(
            "[red]No API key found. Set LO_API_KEY or run 'lo configure'.[/red]"
        )
        raise typer.Exit(1)

    return Client(api_key=api_key, base_url=base_url)


@app.command()
def configure():
    """Configure CLI credentials and base URL."""
    api_key = typer.prompt("API Key (lo_sk_...)")
    base_url = typer.prompt("Base URL", default="https://api.latentocean.io")

    config_dir = Path.home() / ".latentocean"
    config_dir.mkdir(parents=True, exist_ok=True)
    config_path = config_dir / "config.json"
    config_path.write_text(json.dumps({
        "api_key": api_key,
        "base_url": base_url,
    }, indent=2))

    console.print(f"[green]Configuration saved to {config_path}[/green]")


@app.command()
def deploy(
    config: str = typer.Option(..., help="Path to fork config YAML"),
):
    """Deploy a fork from a YAML configuration file."""
    import yaml

    config_path = Path(config)
    if not config_path.exists():
        console.print(f"[red]Config file not found: {config}[/red]")
        raise typer.Exit(1)

    with open(config_path) as f:
        fork_config = yaml.safe_load(f)

    console.print(f"[blue]Deploying fork from {config}...[/blue]")

    client = _get_client()
    with client:
        # Enable specified modules
        modules = fork_config.get("modules", [])
        for mod_id in modules:
            try:
                result = client.enable_module(mod_id)
                console.print(f"  [green]Enabled module:[/green] {mod_id}")
            except Exception as e:
                console.print(f"  [yellow]Warning:[/yellow] Could not enable {mod_id}: {e}")

        console.print("[green]Deployment complete.[/green]")


@app.command()
def status():
    """Show current fork status and health."""
    client = _get_client()
    with client:
        result = client.status()

    table = Table(title="Fork Status")
    table.add_column("Property", style="cyan")
    table.add_column("Value", style="white")

    table.add_row("Fork ID", result.fork_id)
    table.add_row("Status", result.status)
    table.add_row("Entity Count", f"{result.entity_count:,}")
    table.add_row("Last Reduction", result.last_reduction_at or "Never")
    table.add_row("Enabled Modules", ", ".join(result.enabled_modules) or "None")

    if result.health:
        for key, val in result.health.items():
            table.add_row(f"Health: {key}", str(val))

    console.print(table)


@app.command()
def query(
    question: str = typer.Argument(..., help="Natural language question"),
    limit: int = typer.Option(20, help="Max results"),
):
    """Query survivors using natural language."""
    client = _get_client()
    with client:
        result = client.query(question, limit=limit)

    console.print(f"\n[bold]Results:[/bold] {result.total_matches} matches\n")

    if result.narratives:
        for narrative in result.narratives:
            console.print(f"  [dim]{narrative}[/dim]")
        console.print()

    if result.survivors:
        table = Table(title="Survivors")
        if result.survivors:
            for key in result.survivors[0].keys():
                table.add_column(str(key))
            for s in result.survivors[:limit]:
                table.add_row(*[str(v) for v in s.values()])
        console.print(table)


@app.command()
def reduce(
    limit: int = typer.Option(10_000, help="Max entities to ingest"),
    budget: float = typer.Option(50.0, help="Dollar budget"),
    profile: str = typer.Option("standard", help="Reduction profile"),
):
    """Run a reduction job."""
    console.print(f"[blue]Starting reduction (limit={limit:,}, budget=${budget}, profile={profile})...[/blue]")

    client = _get_client()
    with client:
        result = client.reduce(limit=limit, budget=budget, profile=profile)

    table = Table(title="Reduction Result")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="white")

    table.add_row("Job ID", result.job_id)
    table.add_row("Status", result.status)
    table.add_row("Entities", f"{result.entity_count:,}")
    table.add_row("Survivors", f"{result.survivor_count:,}")
    table.add_row("Ratio", f"{result.reduction_ratio}:1")
    table.add_row("Wall Time", f"{result.wall_seconds:.1f}s")
    table.add_row("Cost", f"${result.cost_usd:.2f}")

    console.print(table)


@app.command()
def modules(
    action: str = typer.Argument("list", help="Action: list, enable, disable"),
    module_id: str = typer.Argument(None, help="Module ID (for enable/disable)"),
):
    """Manage modules (list, enable, disable)."""
    client = _get_client()

    with client:
        if action == "list":
            mods = client.modules()
            table = Table(title="Available Modules")
            table.add_column("ID", style="cyan")
            table.add_column("Name", style="white")
            table.add_column("Tier")
            table.add_column("Core")
            table.add_column("Enabled")

            for m in mods:
                core_mark = "[green]yes[/green]" if m.get("is_core") else "no"
                enabled_mark = "[green]yes[/green]" if m.get("enabled") else "[dim]no[/dim]"
                table.add_row(
                    m.get("id", ""),
                    m.get("display_name", ""),
                    m.get("tier", ""),
                    core_mark,
                    enabled_mark,
                )
            console.print(table)

        elif action == "enable":
            if not module_id:
                console.print("[red]Module ID required for enable action.[/red]")
                raise typer.Exit(1)
            result = client.enable_module(module_id)
            console.print(f"[green]Module '{module_id}' enabled.[/green]")

        elif action == "disable":
            if not module_id:
                console.print("[red]Module ID required for disable action.[/red]")
                raise typer.Exit(1)
            result = client.disable_module(module_id)
            console.print(f"[yellow]Module '{module_id}' disabled.[/yellow]")

        else:
            console.print(f"[red]Unknown action: {action}. Use list, enable, or disable.[/red]")
            raise typer.Exit(1)


@app.command()
def export(
    format: str = typer.Option("csv", help="Export format: csv, json, parquet"),
    output: str = typer.Option("export.csv", help="Output file path"),
):
    """Export survivors to a file."""
    console.print(f"[blue]Exporting survivors as {format} to {output}...[/blue]")

    client = _get_client()
    with client:
        result = client.export(format=format, path=output)

    console.print(f"[green]Export complete:[/green]")
    console.print(f"  Format:  {result.format}")
    console.print(f"  Path:    {result.path or output}")
    console.print(f"  Size:    {result.size_bytes:,} bytes")
    console.print(f"  Rows:    {result.row_count:,}")


if __name__ == "__main__":
    app()
