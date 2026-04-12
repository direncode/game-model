"""Parity gate tests — verify formula stability against FRED reference snapshot.

These tests load a frozen snapshot of NIV scores computed on real FRED data
and verify the Python formula still produces the same numbers. If these fail,
either the formula changed (check formula.py) or FRED data was revised
(re-run snapshot generation with latest vintage).

This is a MERGE GATE — it blocks any PR touching formula.py.
"""
import json
from pathlib import Path

import pytest

# Load reference snapshot
_REF_PATH = Path(__file__).parent / "parity_reference.json"
with open(_REF_PATH) as f:
    _REF = json.load(f)
_MONTHS = _REF["months"]


class TestFormulaParity:
    """Verify formula output matches the frozen reference for 6 NBER months."""

    @pytest.mark.parametrize("month", list(_MONTHS.keys()))
    def test_niv_score_stable(self, month):
        ref = _MONTHS[month]
        from app.services.niv.formula import niv_score
        # We can't recompute from raw FRED data in this test (no live API),
        # but we CAN verify the formula functions are deterministic on the
        # same component inputs.
        u = ref["thrust"]
        P_sq = ref["efficiency_squared"]
        X = ref["slack"]
        F = ref["drag_total"]
        score = niv_score(u, P_sq, X, F)
        assert score == pytest.approx(ref["niv_score"], abs=0.1), (
            f"Formula parity broken for {month}: "
            f"expected NIV={ref['niv_score']}, got {score}"
        )

    @pytest.mark.parametrize("month", list(_MONTHS.keys()))
    def test_recession_probability_stable(self, month):
        ref = _MONTHS[month]
        from app.services.niv.formula import recession_probability
        prob = recession_probability(ref["niv_score"])
        assert prob == pytest.approx(ref["recession_probability"], abs=1e-3), (
            f"Recession probability parity broken for {month}: "
            f"expected P(rec)={ref['recession_probability']}, got {prob}"
        )

    @pytest.mark.parametrize("month", list(_MONTHS.keys()))
    def test_alert_level_stable(self, month):
        ref = _MONTHS[month]
        from app.services.niv.formula import alert_level_from_probability
        alert = alert_level_from_probability(ref["recession_probability"])
        assert alert.level == ref["alert_level"], (
            f"Alert level parity broken for {month}: "
            f"expected {ref['alert_level']}, got {alert.level}"
        )


class TestEconomicSanity:
    """Verify the reference values make economic sense."""

    def test_lehman_month_is_critical(self):
        assert _MONTHS["2008-09"]["alert_level"] == "critical"
        assert _MONTHS["2008-09"]["recession_probability"] > 0.95

    def test_recovery_is_normal(self):
        assert _MONTHS["2009-06"]["alert_level"] == "normal"
        assert _MONTHS["2009-06"]["thrust"] > 0.5  # strong stimulus

    def test_pre_covid_is_normal(self):
        assert _MONTHS["2019-12"]["alert_level"] == "normal"

    def test_covid_stimulus_detected(self):
        assert _MONTHS["2020-04"]["thrust"] > 0.9  # massive stimulus

    def test_rate_hiking_creates_drag(self):
        assert _MONTHS["2023-06"]["drag_total"] > 0.015  # highest drag
        assert _MONTHS["2023-06"]["thrust"] < 0  # contractionary
