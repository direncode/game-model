"""Ticker → CIK resolver.

Ships with a small embedded mapping for the commercial watchlist companies.
Customer deployments can override via `LocalClient(ticker_map=...)` or by
dropping a `ticker_map.json` alongside the BTUT cache.
"""
from __future__ import annotations

from typing import Iterable

EMBEDDED_TICKER_MAP: dict[str, str] = {
    "AAPL": "320193", "MSFT": "789019", "NVDA": "1045810",
    "GOOG": "1652044", "GOOGL": "1652044", "AMZN": "1018724",
    "META": "1326801", "TSLA": "1318605",
    "AEP": "4904", "GS": "886982", "JPM": "19617", "BAC": "70858",
    "ERIE": "922621", "CRCL": "1876042",
    "NVR": "906163", "OTIS": "1781335", "HPQ": "47217",
    "CAT": "18230", "DOW": "1751788", "IBM": "51143",
    "LYB": "1489393", "EXC": "1109357", "MUELLER": "876437",
    "SPGI": "64040", "BXP": "1037540", "CMCSA": "1166691",
    "RBC": "1324948", "JD": "1549802", "PAA": "1070423",
    "FMCC": "1026214", "BXSL": "1736035", "BOH": "46195",
    "EXE": "895126", "ZS": "1713683", "AMD": "2488",
    "RPRX": "1802768", "TTD": "1671933", "TW": "1758730",
    "JBHT": "728535", "CCL": "815097", "SSB": "1477932",
    "CBRE": "1364742", "ACM": "868857", "FTI": "1681459",
    "OKTA": "1660134", "APO": "1858681", "WELL": "766704",
    "MLI": "876437", "WYNN": "1174922", "ADP": "8670",
    "SHW": "89800", "EXEL": "939767", "MDB": "1441816",
    "TFCO": "1790982", "IESC": "1048268", "SN": "1642896",
    "SHARK": "1959348", "SAMS": "1642896",
}

_CIK_PREFIX = EMBEDDED_TICKER_MAP.copy()


def resolve(query: str, cik_to_name: dict[str, str] | None = None) -> str | None:
    """Resolve a user query (ticker/CIK/company name) to a CIK.

    Matching precedence:
        1. Exact ticker in embedded map.
        2. Query looks like a CIK (all-digits) already.
        3. Substring match against cik_to_name values if provided.
    """
    q = query.strip().upper()
    if q in _CIK_PREFIX:
        return _CIK_PREFIX[q]
    if q.isdigit():
        return str(int(q))
    if cik_to_name:
        q_norm = q.replace(",", "").replace(".", "").replace("  ", " ")
        for cik, name in cik_to_name.items():
            nm = name.upper().replace(",", "").replace(".", "").replace("  ", " ")
            if q_norm in nm or nm.startswith(q_norm):
                return cik
    return None


def update(mapping: dict[str, str]) -> None:
    """Merge customer-provided ticker→CIK pairs into the resolver."""
    for k, v in mapping.items():
        _CIK_PREFIX[k.strip().upper()] = str(v).strip()


def known_tickers() -> Iterable[str]:
    return list(_CIK_PREFIX.keys())
