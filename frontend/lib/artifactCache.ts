/**
 * Module-scope TTL cache for large JSON artifacts.
 *
 * The load test against https://latentocean.com revealed that the API
 * routes reading `edgar_btut_result_5000.json` (several MB) and
 * `edgar_cache.json` (tens of MB) re-read and re-parsed the files on
 * every request. At even modest concurrency the Node event loop
 * saturated, upstream responses hit nginx timeouts, and Cloudflare
 * served 502s.
 *
 * This cache memoizes parsed JSON in module scope (process-global, one
 * per Node worker) with a default 60-second TTL. Subsequent calls within
 * the TTL return the parsed object without touching the disk.
 *
 * Determinism is preserved: the JSON artifacts are deterministic, the
 * parsed object is deterministic, so reusing a cached copy is identical
 * to re-parsing.
 */
import { promises as fs } from "fs";

type Entry = { data: unknown; expiresAt: number };
const cache = new Map<string, Entry>();

export async function readCachedJson<T = unknown>(
  absPath: string,
  ttlMs = 60_000,
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(absPath);
  if (hit && hit.expiresAt > now) return hit.data as T;
  const raw = await fs.readFile(absPath, "utf-8");
  const data = JSON.parse(raw) as T;
  cache.set(absPath, { data, expiresAt: now + ttlMs });
  return data;
}

/** Clear one or all cached entries — useful for smoke tests. */
export function invalidate(absPath?: string): void {
  if (absPath) cache.delete(absPath);
  else cache.clear();
}

export function cacheStats(): { size: number; keys: string[] } {
  return { size: cache.size, keys: Array.from(cache.keys()) };
}
