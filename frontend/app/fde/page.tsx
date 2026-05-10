"use client";

import { Nav } from "@/components/landing/Nav";
import { useEffect, useState } from "react";

/**
 * /fde — Layer 10 FDE workspace (admin-scoped).
 *
 * The page is publicly reachable but its data calls require an
 * admin-scoped API key. Without one, the page shows the workspace
 * shape but no live engagement data. With an admin key, the
 * engagement roster, status filters, and upsert form become active.
 */

type Engagement = {
  id: string;
  org_id: string;
  customer_name: string;
  status: string;
  primary_fde: string;
  started_at: number;
  last_update_at: number;
  workflows_built: number;
  custom_operators_deployed: number;
  notes: string;
  open_items: string[];
};

const STORAGE_KEY = "lo_lsc_admin_key";
const STATUSES = ["all", "scoping", "active", "handed_off", "paused", "closed"];

export default function FDEPage() {
  const [adminKey, setAdminKey] = useState<string>("");
  const [engagements, setEngagements] = useState<Engagement[] | null>(null);
  const [status, setStatus] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const k = window.localStorage.getItem(STORAGE_KEY) || "";
      if (k) setAdminKey(k);
    }
  }, []);

  const load = async (k: string, statusFilter: string) => {
    if (!k) return;
    setLoading(true);
    setError(null);
    try {
      const qs = statusFilter !== "all" ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const r = await fetch(`/api/v1/fde/engagements${qs}`, {
        headers: { "X-API-Key": k },
        cache: "no-store",
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.detail || `HTTP ${r.status}`);
      }
      setEngagements(await r.json());
    } catch (e) {
      setError(String(e));
      setEngagements([]);
    } finally {
      setLoading(false);
    }
  };

  const onConnect = () => {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, adminKey);
    load(adminKey, status);
  };

  useEffect(() => {
    if (adminKey) load(adminKey, status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />

      <header className="px-6 md:px-10 pt-32 md:pt-40 pb-12 max-w-[1280px] mx-auto">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.26em] text-white/50">
          Layer 10 · FDE Workspace
        </div>
        <h1 className="mt-3 font-display text-[56px] md:text-[88px] leading-[0.95] tracking-[-0.035em] text-white">
          Forward Deployed.
        </h1>
        <p className="mt-6 max-w-[820px] text-[17px] md:text-[19px] leading-relaxed text-white/70">
          Engagement roster for the FDE team. Each active engagement is a customer-specific
          substrate integration: data sources wired, custom operators deployed, workflows
          built. Operations and IP move through this surface.
        </p>
      </header>

      <section className="px-6 md:px-10 pb-8 max-w-[1280px] mx-auto">
        <div className="rounded-3xl border border-white/15 bg-black/40 p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-4 md:items-end">
            <div className="flex-1">
              <label className="block font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 mb-2">
                Admin API key
              </label>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="lo_sk_admin_..."
                spellCheck={false}
                className="w-full rounded-xl border border-white/15 bg-black/60 px-4 py-3 text-[14px] text-white font-mono placeholder:text-white/35 focus:border-white/40 focus:outline-none"
              />
              <p className="mt-1.5 text-[11.5px] text-white/45">
                Engagement data requires an API key with the admin scope. Stored in your local browser only.
              </p>
            </div>
            <div className="shrink-0">
              <label className="block font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 mb-2">
                Status filter
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-xl border border-white/15 bg-black/60 px-4 py-3 text-[14px] text-white font-mono focus:border-white/40 focus:outline-none"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <button
              onClick={onConnect}
              disabled={loading || !adminKey}
              className="shrink-0 inline-flex items-center gap-2 rounded-full bg-white text-black text-[12.5px] font-mono font-bold tracking-[0.22em] uppercase hover:bg-white/90 disabled:bg-white/20 disabled:text-white/45 disabled:cursor-not-allowed transition-colors px-6 py-3"
            >
              {loading ? "Loading..." : "Load"}
              <span aria-hidden>→</span>
            </button>
          </div>
          {error && (
            <div className="mt-5 rounded-xl border border-red-400/30 bg-red-500/[0.05] p-4 font-mono text-[12.5px] text-red-200/80">
              {error}
            </div>
          )}
        </div>
      </section>

      <section className="px-6 md:px-10 py-8 max-w-[1280px] mx-auto">
        {engagements === null && (
          <div className="rounded-2xl border border-white/12 bg-white/[0.015] p-10 text-center text-white/55">
            Connect with an admin API key to load engagements.
          </div>
        )}
        {engagements !== null && engagements.length === 0 && (
          <div className="rounded-2xl border border-white/12 bg-white/[0.015] p-10 text-center text-white/55">
            No engagements match the current filter.
          </div>
        )}
        {engagements !== null && engagements.length > 0 && (
          <div className="space-y-3">
            {engagements.map((e) => (
              <article key={e.id} className="rounded-2xl border border-white/12 bg-white/[0.015] p-6">
                <header className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
                  <h3 className="font-display text-[22px] tracking-[-0.02em] text-white">
                    {e.customer_name}
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/65 border border-white/15 rounded-full px-2.5 py-1">
                      {e.status}
                    </span>
                    <span className="font-mono text-[11px] text-white/55">
                      {new Date(e.last_update_at * 1000).toLocaleDateString()}
                    </span>
                  </div>
                </header>
                <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-[13.5px] mb-3">
                  <div><dt className="text-white/45 font-mono text-[10.5px] uppercase tracking-[0.18em]">Primary FDE</dt>
                       <dd className="text-white/85">{e.primary_fde || "—"}</dd></div>
                  <div><dt className="text-white/45 font-mono text-[10.5px] uppercase tracking-[0.18em]">Org</dt>
                       <dd className="text-white/85 font-mono">{e.org_id}</dd></div>
                  <div><dt className="text-white/45 font-mono text-[10.5px] uppercase tracking-[0.18em]">Workflows built</dt>
                       <dd className="text-white/85 font-mono">{e.workflows_built}</dd></div>
                  <div><dt className="text-white/45 font-mono text-[10.5px] uppercase tracking-[0.18em]">Custom operators</dt>
                       <dd className="text-white/85 font-mono">{e.custom_operators_deployed}</dd></div>
                </dl>
                {e.notes && (
                  <p className="text-[13.5px] text-white/65 leading-relaxed">{e.notes}</p>
                )}
                {e.open_items.length > 0 && (
                  <ul className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-[13px] text-white/72">
                    {e.open_items.map((it, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-2 inline-block w-1 h-1 rounded-full bg-white/40 shrink-0" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
