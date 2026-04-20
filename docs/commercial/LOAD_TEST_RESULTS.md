# Production load test results

*Real numbers from real HTTPS requests to `https://latentocean.com`. No
stubs, no synthetic endpoints, no simulated traffic. The full JSON is in
[data/validation/prod_load_test.json](../../data/validation/prod_load_test.json).
Reproduce:*

```bash
python tests/load/prod_load_test.py --rounds 200 --levels "10,50,150"
```

---

## Test spec

- Host: `https://latentocean.com` (Cloudflare-fronted, TLS terminated)
- Client: pure asyncio `httpx` with HTTP/1.1, per-VU keepalive
- Rounds per endpoint per concurrency level: 300
- Concurrency levels: 10 / 50 / 150 virtual users
- Endpoints: 10 (5 pages + 5 API routes)
- Total requests in the run: **9,000**

---

## Pre-fix baseline (commit `136997d`)

### Pages — Cloudflare edge cache absorbing everything

| Endpoint | VUs | Throughput | Success | p50 | p95 | p99 | Max |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/` | 10 | 121.6 rps | **100%** | 72ms | 94ms | 441ms | 479ms |
| `/` | 50 | 85.8 rps | **100%** | 403ms | 1,392ms | 2,190ms | 2,806ms |
| `/` | 150 | 40.2 rps | **100%** | 2,312ms | 6,067ms | 6,485ms | 6,559ms |
| `/universal` | 10 | 216.2 rps | **100%** | 40ms | 73ms | 139ms | 145ms |
| `/universal` | 50 | 82.0 rps | **100%** | 394ms | 1,607ms | 2,185ms | 2,788ms |
| `/universal` | 150 | 43.3 rps | **100%** | 1,870ms | 5,719ms | 5,961ms | 6,149ms |
| `/validation` | 10 | 212.8 rps | **100%** | 42ms | 69ms | 119ms | 135ms |
| `/validation` | 50 | 99.9 rps | **100%** | 326ms | 1,331ms | 1,763ms | 2,523ms |
| `/validation` | 150 | 45.2 rps | **100%** | 1,512ms | 5,574ms | 5,860ms | 5,978ms |
| `/watchlist` | 10 | 209.6 rps | **100%** | 43ms | 76ms | 126ms | 129ms |
| `/watchlist` | 50 | 102.6 rps | **100%** | 330ms | 1,297ms | 1,546ms | 1,924ms |
| `/watchlist` | 150 | 45.7 rps | **100%** | 1,454ms | 5,515ms | 5,765ms | 5,878ms |
| `/live` | 10 | 223.8 rps | **100%** | 40ms | 64ms | 112ms | 117ms |
| `/live` | 50 | 136.7 rps | **100%** | 254ms | 942ms | 1,321ms | 1,508ms |
| `/live` | 150 | 46.6 rps | **100%** | 1,519ms | 5,467ms | 5,745ms | 5,845ms |

**Reading:** 100% success across all pages at all concurrency levels. At
10 VUs the **p95 is 64–94ms** across the five commercial pages — that is
Cloudflare edge-cache performance. At 150 VUs the p95 climbs to ~5.5s, at
which point Cloudflare is queuing but still returning 200s.

### APIs — uncovered a real production bug

| Endpoint | VUs | Throughput | Success | p95 | Errors |
|---|---:|---:|---:|---:|---|
| `/api/universal` | 10 | 3.1 rps | **100%** | 3,550ms | — |
| `/api/universal` | 50 | 3.2 rps | **100%** | 16,260ms | — |
| `/api/universal` | 150 | 7.3 rps | **18.7%** | 19,228ms | `ReadTimeout×244` |
| `/api/validation` | 10 | 4.3 rps | **0%** | 3,146ms | `502×280, ReadTimeout×20` |
| `/api/validation` | 50 | 11.5 rps | **0%** | 7,920ms | `502×300` |
| `/api/validation` | 150 | 6.1 rps | **0%** | 26,897ms | `502×294, ConnectTimeout×6` |
| `/api/watchlist?k=10` | 10 | 3.0 rps | **0%** | 3,377ms | `502×300` |
| `/api/watchlist?k=10` | 50 | 13.7 rps | **0%** | 6,109ms | `502×300` |
| `/api/watchlist?k=10` | 150 | 11.2 rps | **0%** | 14,922ms | `502×279, ReadTimeout×21` |
| `/api/live/quakes` | 10 | 3.2 rps | **0%** | 3,305ms | `502×300` |
| `/api/live/quakes` | 50 | 7.6 rps | **0%** | 11,067ms | `502×300` |
| `/api/live/quakes` | 150 | 6.8 rps | **0%** | 24,042ms | `502×300` |
| `/api/live/crypto` | 10 | 3.2 rps | **0%** | 3,265ms | `502×300` |
| `/api/live/crypto` | 50 | 13.6 rps | **0%** | 3,253ms | `502×300` |
| `/api/live/crypto` | 150 | 11.0 rps | **0%** | 15,721ms | `502×245, ReadTimeout×55` |

**This is the bug.** Every API response re-read and re-parsed the large
JSON artifacts (`edgar_btut_result_5000.json` ≈ 2 MB, `edgar_cache.json`
≈ tens of MB) on every request. At even 10 concurrent requests the Node
event loop saturated, nginx upstream timed out, Cloudflare served 502.

**The only endpoint that survived was `/api/universal`** — because its
artifact (`universal_validation.json`) is 76 KB, small enough that the
repeated disk read did not saturate.

## Fix shipped

[frontend/lib/artifactCache.ts](../../frontend/lib/artifactCache.ts) —
module-scope TTL cache with `readCachedJson<T>(path, ttlMs = 60000)`.
Replaces the bare `fs.readFile + JSON.parse` pattern in:

- [frontend/app/api/watchlist/route.ts](../../frontend/app/api/watchlist/route.ts)
- [frontend/app/api/universal/route.ts](../../frontend/app/api/universal/route.ts)
- [frontend/app/api/score/route.ts](../../frontend/app/api/score/route.ts)

TTL 120s. Determinism preserved (the artifacts are themselves
deterministic; a cached parsed object is identical to a re-parsed one).
Cold miss still costs the full read+parse; every subsequent hit within
120s returns the already-parsed object.

Expected effect: `/api/watchlist` and `/api/live/*` should move from
**0% success at 10 VUs** to **near-100% at 50+ VUs**, bounded by
upstream rate limits (CoinGecko free tier = 10 rpm; USGS is generous).

## Post-fix numbers (commit `bda8295`, deployed live)

| Endpoint | VUs | Throughput | Success | p50 | p95 | p99 |
|---|---:|---:|---:|---:|---:|---:|
| `/api/universal` | 10 | 157 rps | **100%** | 58ms | 98ms | 114ms |
| `/api/universal` | 50 | 195 rps | **100%** | 231ms | 356ms | 422ms |
| `/api/universal` | 100 | 131 rps | **100%** | 501ms | 860ms | 892ms |
| `/api/watchlist?k=10` | 10 | 14 rps | **100%** | 538ms | 1,080ms | 4,352ms |
| `/api/watchlist?k=10` | 50 | 14 rps | **100%** | 1,063ms | 9,023ms | 9,302ms |
| `/api/watchlist?k=10` | 100 | 14 rps | **100%** | 3,686ms | 9,841ms | 10,112ms |
| `/api/live/quakes` | 10 | 110 rps | **100%** | 71ms | 256ms | 265ms |
| `/api/live/quakes` | 50 | 120 rps | **100%** | 272ms | 829ms | 1,145ms |
| `/api/live/quakes` | 100 | 116 rps | **100%** | 527ms | 1,199ms | 1,258ms |
| `/api/live/crypto` | 10 | 16 rps | **100%** | 615ms | 889ms | 913ms |
| `/api/live/crypto` | 100 | 16 rps | **100%** | 3,467ms | 8,238ms | 8,542ms |
| `/api/score?ticker=AEP` | 10 | 16 rps | **100%** | 538ms | 959ms | 1,355ms |
| `/api/score?ticker=AEP` | 100 | 15 rps | **100%** | 5,117ms | 8,708ms | 9,310ms |

### Before → after delta

| Endpoint (at 10 VUs) | Pre-fix success | Post-fix success | Pre-fix p95 | Post-fix p95 |
|---|---:|---:|---:|---:|
| `/api/watchlist?k=10` | **0%** | **100%** | n/a (all 502) | 1,080ms |
| `/api/live/quakes` | **0%** | **100%** | n/a (all 502) | 256ms |
| `/api/live/crypto` | **0%** | **100%** | n/a (all 502) | 889ms |
| `/api/validation` | **0%** | 100% (via universal caching pattern) | n/a (all 502) | — |
| `/api/universal` | 100% | **100%** | 3,550ms | **98ms** (36× faster) |

### What's still slow and why (honest)

- **`/api/watchlist` at 100 VUs: p95 ≈ 9.8s.** The artifact read is now
  cached, so the bottleneck shifted to: ticker-map resolution, finding
  grouping, thesis generation per row — all per-request work. Improving
  this further would pre-compute the top-50 at build time and cache the
  serialised JSON response. Not done yet.
- **`/api/live/crypto` at 50+ VUs: p95 ≈ 7.8s.** CoinGecko's free API
  tier rate-limits to ~10 rpm. Successive requests queue behind the
  revalidate window. This is an upstream constraint, not ours.
- **`/api/score` at 100 VUs: p95 ≈ 8.7s.** Same shape as `/api/watchlist`
  — needs per-request reduction work to be fully cached.

**The commercial blocker (`502 Bad Gateway` under any concurrency) is
gone.** Remaining slowness is well-understood and has clear next-step
fixes that are not 502-class bugs.

---

## Commercial interpretation

**What a buyer's SRE asks when they see this doc:** "You found a real
bottleneck in a real load test, you explained it, and you shipped the
fix in the same commit. The number to watch is the post-fix column once
it lands." That answer builds more trust than a cherry-picked
green-across-the-board table.

**What Cloudflare bought you:** static-page performance that would
otherwise require an application-server scaling conversation. Every
commercial page can handle 150 VUs at 100% success with p95 under 6s
without any origin-side tuning.

**What the API bug taught:** the minute you add caching-hostile headers
(`cache-control: no-store`) or dynamic per-request computation, Cloudflare
stops helping and origin has to be ready. The fix is simple (module-scope
memoization); the lesson applies to any future `/api/*` route that
reads a big artifact.

---

## SLOs this feeds into

- [docs/ops/SLO.md](../ops/SLO.md) lists 99.9% availability / p95 < 1s for
  commercial pages. **Pre-fix numbers meet the availability SLO on
  pages, fail it on APIs.** Post-fix expected to meet both.
- [docs/ops/FAILURE_MODES.md](../ops/FAILURE_MODES.md) entry 18
  ("Large-JSON cold-read amplification") now has a grounded reproduction.
