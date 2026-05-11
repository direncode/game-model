"""Tests for ocean list ops."""
from __future__ import annotations

from ocean_cli.main import main


def test_list_ops_includes_free_and_premium(capsys):
    rc = main(["list", "ops"])
    out = capsys.readouterr().out
    assert rc == 0
    assert "embed.tfidf_jl" in out
    assert "cluster.kmeans" in out
    assert "embed.content_fp48" in out
    assert "cluster.tcd_recursive_loop" in out
    assert "free" in out.lower()
    assert "premium" in out.lower()


def test_list_ops_free_filter_excludes_premium(capsys):
    rc = main(["list", "ops", "--free"])
    out = capsys.readouterr().out
    assert rc == 0
    assert "embed.tfidf_jl" in out
    assert "embed.content_fp48" not in out


def test_list_ops_premium_filter_excludes_free(capsys):
    rc = main(["list", "ops", "--premium"])
    out = capsys.readouterr().out
    assert rc == 0
    assert "embed.content_fp48" in out
    assert "embed.tfidf_jl" not in out
