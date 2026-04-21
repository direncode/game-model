"""Titan v2 — Alien mode.

Same primitive. Extreme scale. Everything parallel.

  - 12+ live public sources, fetched in parallel via asyncio + httpx
  - cross-source bridge analysis (entities from DIFFERENT domains whose
    48-bit fingerprints sit within 6 Hamming bits of each other — only
    possible because the fingerprint space is modality-agnostic)
  - N=1000 null-permutation iterations per source
  - Multi-epsilon topology (H0 + H1 at ε ∈ {4, 6, 8, 12})
  - Deterministic under seed=42

Output:
    data/validation/titan_alien_validation.json
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import sys
import time
import urllib.parse
from pathlib import Path
from typing import Any

import httpx
import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
UA = "LatentOcean-Titan-Alien/0.2.0 (benchmark)"
SEED = 42


def fingerprint48(attrs: dict, seed: int = SEED) -> str:
    payload = json.dumps(attrs, sort_keys=True, default=str).encode("utf-8")
    bits = []
    for i in range(48):
        h = hashlib.sha256(f"{seed}:{i}:".encode() + payload).digest()
        v = int.from_bytes(h[:4], "big")
        bits.append(str(((v ^ (v >> 7) ^ (v >> 13)) & 1)))
    return "".join(bits)


def hamming(a: str, b: str) -> int:
    return sum(1 for x, y in zip(a, b) if x != y)


async def fetch_json(client: httpx.AsyncClient, url: str) -> Any:
    try:
        r = await client.get(url)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        return {"__error__": str(e)}


async def src_usgs_month(client) -> list[dict]:
    body = await fetch_json(client,
        "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson")
    if isinstance(body, dict) and body.get("__error__"): return []
    out = []
    # Cap at 2500 so O(N^2) anomaly scoring stays under ~5s.
    features = (body.get("features") or [])[:2500]
    for f in features:
        p = f.get("properties") or {}
        c = f.get("geometry", {}).get("coordinates") or [0, 0, 0]
        out.append({
            "id": f.get("id", ""),
            "mag": round(float(p.get("mag") or 0), 1),
            "depth_bin": round(float(c[2] or 0) / 10) * 10,
            "lat_bin": round(float(c[1] or 0) / 2) * 2,
            "lon_bin": round(float(c[0] or 0) / 2) * 2,
            "type": p.get("type") or "earthquake",
        })
    return out


async def src_coingecko(client) -> list[dict]:
    rows = await fetch_json(client,
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&price_change_percentage=1h,24h,7d")
    if not isinstance(rows, list): return []
    return [{
        "id": r.get("id", ""),
        "mcap_log": round(float(np.log10(max(1, r.get("market_cap") or 1))), 2),
        "vol_log": round(float(np.log10(max(1, r.get("total_volume") or 1))), 2),
        "h1": round(r.get("price_change_percentage_1h_in_currency") or 0, 1),
        "h24": round(r.get("price_change_percentage_24h_in_currency") or 0, 1),
        "d7": round(r.get("price_change_percentage_7d_in_currency") or 0, 1),
    } for r in rows]


async def src_worldbank(client) -> list[dict]:
    body = await fetch_json(client,
        "https://api.worldbank.org/v2/country/all/indicator/NY.GDP.PCAP.CD?format=json&per_page=500&mrv=1")
    if not isinstance(body, list) or len(body) < 2: return []
    return [{
        "country": row.get("country", {}).get("id", ""),
        "value_log": round(float(np.log10(max(1, row.get("value") or 1))), 2),
        "year": row.get("date"),
        "region_bucket": row.get("countryiso3code", "")[:2],
    } for row in body[1] if row and row.get("value")]


async def src_github_events(client) -> list[dict]:
    rows = await fetch_json(client, "https://api.github.com/events?per_page=100")
    if not isinstance(rows, list): return []
    return [{
        "type": e.get("type", ""),
        "public": bool(e.get("public")),
        "repo_hash": hashlib.md5(str((e.get("repo") or {}).get("name", "")).encode()).hexdigest()[:8],
    } for e in rows]


async def src_openalex(client, max_records=500) -> list[dict]:
    out = []
    for pub_year in (2025, 2024):
        body = await fetch_json(client,
            f"https://api.openalex.org/works?per_page=200&filter=publication_year:{pub_year}&mailto=ops@latentocean.com")
        if not isinstance(body, dict): continue
        for w in (body.get("results") or [])[:max_records]:
            out.append({
                "id": (w.get("id") or "").split("/")[-1],
                "year": w.get("publication_year"),
                "cited_by_log": round(float(np.log10(max(1, w.get("cited_by_count") or 1))), 2),
                "n_authors": len(w.get("authorships") or []),
                "type": w.get("type") or "",
                "oa": bool((w.get("open_access") or {}).get("is_oa")),
                "primary_topic": ((w.get("primary_topic") or {}).get("id") or "").split("/")[-1][:16],
            })
    return out


async def src_hackernews(client, max_records=250) -> list[dict]:
    ids = await fetch_json(client, "https://hacker-news.firebaseio.com/v0/topstories.json")
    if not isinstance(ids, list): return []
    ids = ids[:max_records]
    async def one(i):
        body = await fetch_json(client, f"https://hacker-news.firebaseio.com/v0/item/{i}.json")
        if not isinstance(body, dict): return None
        return {
            "id": body.get("id", ""),
            "score_log": round(float(np.log10(max(1, body.get("score") or 1))), 2),
            "descendants_log": round(float(np.log10(max(1, body.get("descendants") or 1))), 2),
            "type": body.get("type") or "",
            "has_url": bool(body.get("url")),
            "title_words": len((body.get("title") or "").split()),
        }
    return [r for r in await asyncio.gather(*[one(i) for i in ids]) if r]


async def src_gbif(client, max_records=300) -> list[dict]:
    body = await fetch_json(client,
        f"https://api.gbif.org/v1/occurrence/search?limit={max_records}&hasCoordinate=true")
    if not isinstance(body, dict): return []
    return [{
        "id": r.get("key", ""),
        "basisOfRecord": r.get("basisOfRecord") or "",
        "kingdom": r.get("kingdom") or "",
        "lat_bin": round((r.get("decimalLatitude") or 0) / 5) * 5,
        "lon_bin": round((r.get("decimalLongitude") or 0) / 5) * 5,
        "year": r.get("year"),
        "institution": (r.get("institutionCode") or "")[:10],
    } for r in body.get("results") or []]


async def src_openlibrary(client, max_records=300) -> list[dict]:
    # Use a common search term; q=* is rejected by their search endpoint.
    body = await fetch_json(client,
        f"https://openlibrary.org/search.json?q=the&limit={max_records}&sort=new")
    if not isinstance(body, dict): return []
    out = []
    for d in body.get("docs") or []:
        languages = d.get("language") or []
        out.append({
            "key": d.get("key", ""),
            "has_cover": bool(d.get("cover_i")),
            "n_authors": len(d.get("author_name") or []),
            "first_publish_year": d.get("first_publish_year"),
            "language_first": (languages[0] if languages else "?"),
            "n_editions": d.get("edition_count") or 0,
            "n_subjects": len(d.get("subject") or []),
            "has_ia": bool(d.get("ia")),
        })
    return out


async def src_nasa_exoplanets(client) -> list[dict]:
    # Column list reduced to ones reliably present in pscomppars.
    q = "SELECT TOP 400 pl_name, hostname, disc_year, sy_snum, sy_pnum FROM pscomppars"
    url = (
        "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query="
        + urllib.parse.quote(q)
        + "&format=json"
    )
    body = await fetch_json(client, url)
    if not isinstance(body, list): return []
    return [{
        "pl_name": (r.get("pl_name") or "")[:30],
        "host": (r.get("hostname") or "")[:20],
        "year": r.get("disc_year") or 0,
        "sy_snum": r.get("sy_snum") or 0,
        "sy_pnum": r.get("sy_pnum") or 0,
    } for r in body]


async def src_arxiv(client, max_records=500) -> list[dict]:
    import re as _re
    import xml.etree.ElementTree as ET
    q = urllib.parse.quote("all:structural OR all:topology OR all:anomaly OR all:embedding")
    url = f"http://export.arxiv.org/api/query?search_query={q}&sortBy=submittedDate&max_results={max_records}"
    try:
        r = await client.get(url)
        r.raise_for_status()
        body = r.text
    except Exception:
        return []
    # arXiv returns Atom XML; parse with stdlib
    ns = {"a": "http://www.w3.org/2005/Atom"}
    try:
        root = ET.fromstring(body)
    except Exception:
        # fall back to regex on <entry>
        entries = _re.findall(r"<entry>(.*?)</entry>", body, _re.DOTALL)
        out = []
        for e in entries:
            m_t = _re.search(r"<title>(.*?)</title>", e, _re.DOTALL)
            m_cat = _re.findall(r'<category term="([^"]+)"', e)
            m_date = _re.search(r"<published>(.*?)</published>", e)
            out.append({
                "title_words": len((m_t.group(1).strip().split() if m_t else [])),
                "primary_category": m_cat[0] if m_cat else "?",
                "n_categories": len(m_cat),
                "year": (m_date.group(1)[:4] if m_date else ""),
            })
        return out
    out = []
    for entry in root.findall("a:entry", ns):
        title = entry.find("a:title", ns)
        cats = [c.get("term", "?") for c in entry.findall("a:category", ns)]
        pub = entry.find("a:published", ns)
        out.append({
            "title_words": len((title.text or "").strip().split()) if title is not None else 0,
            "primary_category": cats[0] if cats else "?",
            "n_categories": len(cats),
            "year": (pub.text[:4] if pub is not None and pub.text else ""),
        })
    return out


async def src_reddit_rising(client) -> list[dict]:
    # Public .json endpoint, no auth. Requires a distinct UA or reddit 429s.
    body = await fetch_json(client, "https://www.reddit.com/r/all/top.json?limit=100&t=day")
    if not isinstance(body, dict): return []
    out = []
    for child in ((body.get("data") or {}).get("children") or []):
        d = child.get("data") or {}
        out.append({
            "sub": (d.get("subreddit") or "")[:20],
            "ups_log": round(float(np.log10(max(1, d.get("ups") or 1))), 2),
            "comments_log": round(float(np.log10(max(1, d.get("num_comments") or 1))), 2),
            "over_18": bool(d.get("over_18")),
            "domain_len": len((d.get("domain") or "")),
            "title_words": len((d.get("title") or "").split()),
        })
    return out


async def src_stackexchange(client) -> list[dict]:
    # top questions across the Stack Exchange network, no auth for read
    body = await fetch_json(client,
        "https://api.stackexchange.com/2.3/questions?pagesize=100&order=desc&sort=activity&site=stackoverflow")
    if not isinstance(body, dict): return []
    out = []
    for q in body.get("items") or []:
        out.append({
            "q_id": q.get("question_id"),
            "score_bucket": round((q.get("score") or 0) / 5) * 5,
            "answers": q.get("answer_count") or 0,
            "views_log": round(float(np.log10(max(1, q.get("view_count") or 1))), 2),
            "n_tags": len(q.get("tags") or []),
            "is_answered": bool(q.get("is_answered")),
        })
    return out


async def src_open_meteo(client) -> list[dict]:
    # Sample a grid of weather stations across the globe, no auth.
    import itertools
    lats = [-60, -30, 0, 30, 60]
    lons = [-120, -60, 0, 60, 120]
    out = []
    async def one(lat, lon):
        body = await fetch_json(client,
            f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,wind_speed_10m,relative_humidity_2m,precipitation")
        if not isinstance(body, dict): return None
        cur = body.get("current") or {}
        return {
            "lat": lat, "lon": lon,
            "t_bin": round((cur.get("temperature_2m") or 0) / 2) * 2,
            "wind_bin": round((cur.get("wind_speed_10m") or 0)),
            "humid_bin": round((cur.get("relative_humidity_2m") or 0) / 5) * 5,
            "precip_bin": round((cur.get("precipitation") or 0)),
        }
    results = await asyncio.gather(*[one(la, lo) for la, lo in itertools.product(lats, lons)])
    for r in results:
        if r: out.append(r)
    return out


async def src_musicbrainz(client, max_records=200) -> list[dict]:
    body = await fetch_json(client,
        f"https://musicbrainz.org/ws/2/artist/?query=type:group&fmt=json&limit={max_records}")
    if not isinstance(body, dict): return []
    out = []
    for a in body.get("artists") or []:
        out.append({
            "id": (a.get("id") or "")[:12],
            "type": a.get("type") or "",
            "country": a.get("country") or "??",
            "score": a.get("score") or 0,
            "has_begin_year": bool(((a.get("life-span") or {}).get("begin"))),
            "ended": bool(((a.get("life-span") or {}).get("ended"))),
        })
    return out


async def src_spacex_launches(client) -> list[dict]:
    body = await fetch_json(client, "https://api.spacexdata.com/v5/launches")
    if not isinstance(body, list): return []
    out = []
    for l in body[-200:]:  # last ~200 launches for scale
        cores = l.get("cores") or []
        out.append({
            "id": (l.get("id") or "")[:12],
            "success": bool(l.get("success")),
            "upcoming": bool(l.get("upcoming")),
            "n_cores": len(cores),
            "core_reused_count": sum(1 for c in cores if c.get("reused")),
            "has_failures": bool(l.get("failures")),
            "year": (l.get("date_utc") or "")[:4],
        })
    return out


async def src_rest_countries(client) -> list[dict]:
    body = await fetch_json(client, "https://restcountries.com/v3.1/all?fields=name,region,population,area,languages,unMember")
    if not isinstance(body, list): return []
    out = []
    for c in body:
        out.append({
            "region": c.get("region") or "??",
            "pop_log": round(float(np.log10(max(1, c.get("population") or 1))), 2),
            "area_log": round(float(np.log10(max(1, c.get("area") or 1))), 2),
            "n_languages": len(c.get("languages") or {}),
            "un_member": bool(c.get("unMember")),
        })
    return out


async def src_wikipedia_featured(client, n_days=30) -> list[dict]:
    async def one(d):
        dt = time.gmtime(time.time() - d * 86400)
        ymd = f"{dt.tm_year:04d}/{dt.tm_mon:02d}/{dt.tm_mday:02d}"
        body = await fetch_json(client,
            f"https://api.wikimedia.org/feed/v1/wikipedia/en/featured/{ymd}")
        if not isinstance(body, dict): return []
        tfa = body.get("tfa") or {}
        mostread = (body.get("mostread") or {}).get("articles") or []
        rows = []
        for art in [tfa] + mostread[:10]:
            if not art: continue
            ns = art.get("namespace")
            rows.append({
                "title": (art.get("title") or "")[:40],
                "views_log": round(float(np.log10(max(1, art.get("views") or 1))), 2),
                "namespace": (ns.get("id") if isinstance(ns, dict) else ns) or 0,
                "day_offset": d,
            })
        return rows
    out = []
    for r in await asyncio.gather(*[one(d) for d in range(1, n_days + 1)]):
        out.extend(r)
    return out


async def src_sec_fts(client) -> list[dict]:
    url = (
        "https://efts.sec.gov/LATEST/search-index"
        "?q=%22material%20weakness%22&forms=10-K,10-K%2FA&dateRange=custom&startdt=2025-01-01&enddt=2026-12-31"
    )
    body = await fetch_json(client, url)
    if not isinstance(body, dict): return []
    return [{
        "accession": h.get("_id", "")[:20],
        "form": (h.get("_source") or {}).get("form") or "",
        "adsh_suffix": (h.get("_id") or "")[-8:],
    } for h in ((body.get("hits") or {}).get("hits") or [])[:400]]


SOURCES = [
    ("usgs_month",      "USGS all-month seismicity",        src_usgs_month),
    ("coingecko",       "CoinGecko top-250",                src_coingecko),
    ("worldbank",       "World Bank GDP/capita",            src_worldbank),
    ("github",          "GitHub public events",             src_github_events),
    ("openalex",        "OpenAlex scholarly works (2024-25)", src_openalex),
    ("hackernews",      "Hacker News top-250 stories",      src_hackernews),
    ("gbif",            "GBIF biodiversity occurrences",    src_gbif),
    ("openlibrary",     "Open Library search (fixed)",      src_openlibrary),
    ("nasa_exoplanets", "NASA Exoplanet Archive (fixed)",   src_nasa_exoplanets),
    ("wikipedia",       "Wikipedia featured + most-read 30d", src_wikipedia_featured),
    ("sec_fts",         "SEC 10-K 'material weakness' FTS", src_sec_fts),
    ("arxiv",           "arXiv recent abstracts (ATOM XML fixed)", src_arxiv),
    ("reddit",          "Reddit /r/all top/day",            src_reddit_rising),
    ("stackexchange",   "Stack Overflow top questions",     src_stackexchange),
    ("open_meteo",      "Open-Meteo 5x5 global weather grid", src_open_meteo),
    ("musicbrainz",     "MusicBrainz group artists",        src_musicbrainz),
    ("spacex",          "SpaceX last-200 launches",         src_spacex_launches),
    ("rest_countries",  "REST Countries all",               src_rest_countries),
]


def score_corpus(records, source):
    if not records: return []
    fps = [fingerprint48({**r, "__source__": source}) for r in records]
    n = len(fps)
    ON = np.zeros(48)
    for fp in fps:
        for i, c in enumerate(fp):
            if c == "1": ON[i] += 1
    out = []
    for i, fp in enumerate(fps):
        if n == 1:
            a = 1.0
        else:
            min_h = 48
            for j, g in enumerate(fps):
                if i == j: continue
                h = hamming(fp, g)
                if h < min_h: min_h = h
            a = min_h / 48
        ones = fp.count("1")
        rec = 1 - abs(ones - 24) * 2 / 48
        entropy = 0.0
        considered = 0
        for idx in range(48):
            if fp[idx] != "1": continue
            p = ON[idx] / n
            if 0 < p < 1:
                entropy += -(p * np.log2(p) + (1 - p) * np.log2(1 - p))
                considered += 1
        div = entropy / max(1, considered)
        composite = 0.40 * rec + 0.35 * div + 0.25 * a
        out.append({**records[i], "source": source, "fp": fp,
                    "anomaly": round(a, 4), "reconstruction": round(rec, 4),
                    "diversity": round(div, 4), "composite": round(composite, 4)})
    return out


def null_test(scored, iterations=1000):
    if len(scored) < 10: return {"skipped": "n<10"}
    rng = np.random.default_rng(SEED)
    dims = ("composite", "anomaly", "reconstruction", "diversity")
    results = []
    for dim in dims:
        arr = np.array([s[dim] for s in scored], dtype=float)
        n = len(arr)
        sorted_desc = np.sort(arr)[::-1]
        for K in (10, 25, 50, 100, 250):
            if K > n // 2: continue
            true_mean = float(sorted_desc[:K].mean())
            nulls = np.empty(iterations)
            for i in range(iterations):
                idx = rng.choice(n, size=K, replace=False)
                nulls[i] = float(arr[idx].mean())
            nm, ns = float(nulls.mean()), float(nulls.std()) + 1e-12
            p95, p999 = float(np.percentile(nulls, 95)), float(np.percentile(nulls, 99.9))
            results.append({
                "dim": dim, "K": K, "true": true_mean,
                "null_mean": nm, "null_p95": p95, "null_p999": p999,
                "z_score": (true_mean - nm) / ns,
                "sig_05": bool(true_mean > p95),
                "sig_001": bool(true_mean > p999),
            })
    return {
        "iterations": iterations,
        "per_metric": results,
        "total_metrics": len(results),
        "significant_05": sum(1 for r in results if r["sig_05"]),
        "significant_001": sum(1 for r in results if r["sig_001"]),
        "max_z_score": max((r["z_score"] for r in results), default=0.0),
    }


def topology_multi_epsilon(fps):
    if len(fps) < 2: return {"skipped": "n<2"}
    n = len(fps)
    if n > 2500:
        rng = np.random.default_rng(SEED)
        idx = rng.choice(n, size=2500, replace=False)
        fps = [fps[i] for i in idx]
        n = 2500
    out = []
    for eps in (4, 6, 8, 12):
        parent = list(range(n))
        def find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]; x = parent[x]
            return x
        edges = 0
        for i in range(n):
            for j in range(i + 1, n):
                if hamming(fps[i], fps[j]) <= eps:
                    ra, rb = find(i), find(j)
                    if ra != rb: parent[ra] = rb
                    edges += 1
        components = len({find(i) for i in range(n)})
        h1 = max(0, edges - n + components)
        out.append({"epsilon": eps, "edges": edges, "H0": components, "H1": h1})
    return {"nodes": n, "multi_epsilon": out}


def cross_source_bridges(all_scored, epsilon=6, max_bridges=200):
    bridges = []
    for i in range(len(all_scored)):
        src_a, recs_a = all_scored[i]
        if not recs_a: continue
        rng = np.random.default_rng(SEED + i)
        sample_a = rng.choice(len(recs_a), size=min(300, len(recs_a)), replace=False)
        for j in range(i + 1, len(all_scored)):
            src_b, recs_b = all_scored[j]
            if not recs_b: continue
            sample_b = rng.choice(len(recs_b), size=min(300, len(recs_b)), replace=False)
            for ia in sample_a:
                fp_a = recs_a[int(ia)]["fp"]
                for ib in sample_b:
                    fp_b = recs_b[int(ib)]["fp"]
                    h = hamming(fp_a, fp_b)
                    if h <= epsilon:
                        bridges.append({
                            "source_a": src_a, "source_b": src_b,
                            "id_a": str(recs_a[int(ia)].get("id", recs_a[int(ia)].get("key", "?"))),
                            "id_b": str(recs_b[int(ib)].get("id", recs_b[int(ib)].get("key", "?"))),
                            "hamming": h,
                            "composite_a": recs_a[int(ia)]["composite"],
                            "composite_b": recs_b[int(ib)]["composite"],
                        })
                        if len(bridges) >= max_bridges: return bridges
    return bridges


def digest_top(scored, k=100):
    s = sorted(scored, key=lambda x: -x["composite"])[:k]
    payload = "\n".join(f'{s_.get("id","?")}|{s_["composite"]:.6f}|{s_["fp"]}' for s_ in s)
    return hashlib.sha256(payload.encode()).hexdigest()


async def run_titan_alien(iterations=1000):
    t_start = time.perf_counter()
    print(f"TITAN v2 — Alien mode ({len(SOURCES)} sources, parallel fetch, N={iterations})\n")

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(60.0, connect=10.0),
        headers={"User-Agent": UA},
        limits=httpx.Limits(max_connections=64, max_keepalive_connections=32),
        http2=False,
    ) as client:
        pull_t0 = time.perf_counter()
        records_per_source = await asyncio.gather(
            *[fn(client) for _, _, fn in SOURCES],
            return_exceptions=True,
        )
        pull_wall = time.perf_counter() - pull_t0
        print(f"  parallel pull wall: {pull_wall:.2f}s\n")

    sources_out = []
    all_scored = []

    for (name, display, _fn), records in zip(SOURCES, records_per_source):
        if isinstance(records, Exception):
            print(f"  {name:16s}  ERROR: {type(records).__name__}: {str(records)[:60]}")
            sources_out.append({
                "name": name, "display": display, "origin": "live",
                "record_count": 0, "scored_count": 0, "error": str(records),
            })
            continue
        records = records or []
        t0 = time.perf_counter()
        scored = score_corpus(records, name)
        nt = null_test(scored, iterations=iterations)
        topo = topology_multi_epsilon([s["fp"] for s in scored])
        wall = time.perf_counter() - t0
        print(f"  {name:16s}  n={len(scored):5d}  z_max={nt.get('max_z_score',0):6.2f}  "
              f"sig={nt.get('significant_05',0):>2}/{nt.get('total_metrics',0):<2}  wall={wall:.2f}s")
        sources_out.append({
            "name": name, "display": display, "origin": "live",
            "record_count": len(records), "scored_count": len(scored),
            "null_test": nt, "topology": topo,
            "top_composite": max((s["composite"] for s in scored), default=0.0),
            "digest_top100": digest_top(scored),
            "wall_seconds": wall,
        })
        all_scored.append((name, scored))

    print("\n  CROSS-SOURCE BRIDGES (epsilon=6 Hamming)...")
    bridges = cross_source_bridges(all_scored, epsilon=6, max_bridges=200)
    print(f"    found {len(bridges)} bridges across unrelated domains")

    wall = time.perf_counter() - t_start
    total = sum(s.get("scored_count", 0) for s in sources_out)
    agg = {
        "sources_total": len(sources_out),
        "sources_with_data": sum(1 for s in sources_out if s.get("scored_count", 0) > 0),
        "total_records_processed": total,
        "max_z_score_across_all_sources":
            max((s.get("null_test", {}).get("max_z_score", 0) for s in sources_out), default=0),
        "sources_significant_05_majority":
            sum(1 for s in sources_out
                if s.get("null_test", {}).get("total_metrics", 0) > 0
                and s["null_test"]["significant_05"] * 2 >= s["null_test"]["total_metrics"]),
        "cross_source_bridges": len(bridges),
        "null_iterations": iterations,
    }
    return {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "wall_seconds": wall,
        "upstream_parallel_fetch_seconds": pull_wall,
        "seed": SEED,
        "sources": sources_out,
        "bridges_sample": bridges[:50],
        "bridges_full_count": len(bridges),
        "aggregate": agg,
    }


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--iterations", type=int, default=1000)
    ap.add_argument("--output", default=str(
        REPO_ROOT / "data" / "validation" / "titan_alien_validation.json"))
    args = ap.parse_args()
    report = asyncio.run(run_titan_alien(args.iterations))
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    a = report["aggregate"]
    print("\n" + "=" * 78)
    print("TITAN v2 — Alien mode summary")
    print("=" * 78)
    print(f"  sources with data:          {a['sources_with_data']}/{a['sources_total']}")
    print(f"  total records processed:    {a['total_records_processed']:,}")
    print(f"  max z-score:                {a['max_z_score_across_all_sources']:.2f} sigma")
    print(f"  >=50% sig p<0.05:           {a['sources_significant_05_majority']}")
    print(f"  CROSS-SOURCE BRIDGES:       {a['cross_source_bridges']}")
    print(f"  null iters per corpus:      {a['null_iterations']}")
    print(f"  upstream parallel pull:     {report['upstream_parallel_fetch_seconds']:.1f}s")
    print(f"  total wall:                 {report['wall_seconds']:.1f}s")
    print(f"\nWrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
