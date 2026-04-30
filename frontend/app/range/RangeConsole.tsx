"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

type Capabilities = {
  runpod_available: boolean;
  btut_bridge_url: string | null;
  formed_models_dir: string;
};
type BuiltinCorpus = { id: string; label: string; path: string; size_bytes: number };

type FormedModelMeta = {
  id: string;
  name: string;
  corpus_path: string;
  corpus_format: string;
  corpus_records: number;
  corpus_bytes: number;
  corpus_sha256: string;
  fields: { name: string; nonEmptyShare: number; sampleType: string; entropy: number }[];
  formed_at: string;
  formation_ms: number;
  seed: number;
  fingerprinter_mode: "node" | "btut";
  bridge_url?: string;
  status: string;
};

type FormedModel = FormedModelMeta & {
  fingerprints: { recordIdx: number; fp48Hex: string; rawHash: string; contributing: string[] }[];
  taxonomy: { classes: { id: number; size: number; centroid_fp48Hex: string; sample_record_idxs: number[] }[]; silhouette: number; null_test_z: number; novel_class_count: number };
  sample_records: { idx: number; preview: string }[];
  response_digest: string;
  records_in_memory: number;
  air_gap_compliant: boolean;
};

function fmtBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}
function fmtMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}
function shortHash(h: string, head = 12, tail = 4): string {
  if (!h) return "—";
  if (h.length <= head + tail + 1) return h;
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}

export function RangeConsole() {
  const [tab, setTab] = useState<"form" | "gallery">("form");
  const [models, setModels] = useState<FormedModelMeta[]>([]);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [builtins, setBuiltins] = useState<BuiltinCorpus[]>([]);
  const [selectedModel, setSelectedModel] = useState<FormedModel | null>(null);

  // Formation state
  const [corpusPath, setCorpusPath] = useState<string>("");
  const [corpusText, setCorpusText] = useState<string>("");
  const [corpusName, setCorpusName] = useState<string>("");
  const [useRunpod, setUseRunpod] = useState(false);
  const [forming, setForming] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastFormed, setLastFormed] = useState<FormedModel | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [cor, list] = await Promise.all([
        fetch("/api/range-corpora", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/range-form", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setCaps(cor.capabilities);
      setBuiltins(cor.corpora ?? []);
      setModels((list.models ?? []) as FormedModelMeta[]);
    } catch (e) {
      // non-fatal
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const launchFormation = useCallback(async () => {
    setForming(true);
    setFormError(null);
    setLastFormed(null);
    try {
      const body: Record<string, unknown> = {};
      if (corpusPath.trim()) body.corpus_path = corpusPath.trim();
      else if (corpusText.trim()) {
        body.corpus_text = corpusText;
        body.corpus_filename_hint = "inline.txt";
      } else {
        setFormError("pick a built-in corpus or paste inline text");
        setForming(false);
        return;
      }
      if (corpusName.trim()) body.name = corpusName.trim();
      if (useRunpod) body.use_runpod = true;

      const r = await fetch("/api/range-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        setFormError(data?.detail || data?.error || `HTTP ${r.status}`);
      } else {
        // The POST returns meta; fetch the full artifact for the result panel
        const detail = await fetch(`/api/range-form/${data.id}`, { cache: "no-store" }).then((x) => x.json());
        setLastFormed(detail as FormedModel);
        await refresh();
      }
    } catch (e) {
      setFormError(String(e));
    } finally {
      setForming(false);
    }
  }, [corpusPath, corpusText, corpusName, useRunpod, refresh]);

  const inspect = useCallback(async (id: string) => {
    setSelectedModel(null);
    try {
      const r = await fetch(`/api/range-form/${id}`, { cache: "no-store" });
      if (r.ok) setSelectedModel((await r.json()) as FormedModel);
    } catch { /* swallow */ }
  }, []);

  const remove = useCallback(async (id: string) => {
    if (!confirm("Delete this formed model? The artifact file is permanently removed.")) return;
    try {
      await fetch(`/api/range-form/${id}`, { method: "DELETE" });
      if (selectedModel?.id === id) setSelectedModel(null);
      await refresh();
    } catch { /* swallow */ }
  }, [selectedModel, refresh]);

  const totalRecords = useMemo(() => models.reduce((a, m) => a + (m.corpus_records || 0), 0), [models]);

  return (
    <div className="space-y-6">
      {/* Capability strip */}
      <div className="rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-li-cyan">
            Capabilities · this appliance
          </span>
          <button
            onClick={refresh}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/50 hover:text-white transition-colors"
          >
            ↻ refresh
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4">
          <Cap k="formed models" v={`${models.length} on disk`} sub={`${totalRecords.toLocaleString()} records`} tone="cyan" />
          <Cap k="btut bridge" v={caps?.btut_bridge_url ? "available" : "node-only"} sub={caps?.btut_bridge_url ?? "no bridge configured"} tone={caps?.btut_bridge_url ? "green" : "white"} />
          <Cap k="runpod" v={caps?.runpod_available ? "available" : "not configured"} sub={caps?.runpod_available ? "async crystallization" : "set RUNPOD_API_KEY to enable"} tone={caps?.runpod_available ? "green" : "white"} />
          <Cap k="store" v="writable" sub={caps?.formed_models_dir ?? "/data/formed_models"} tone="cyan" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <TabButton active={tab === "form"} onClick={() => setTab("form")}>▶ Form a new model</TabButton>
        <TabButton active={tab === "gallery"} onClick={() => setTab("gallery")}>▦ Formed models ({models.length})</TabButton>
      </div>

      {/* FORM TAB */}
      {tab === "form" && (
        <div className="space-y-4">
          {/* Corpus picker */}
          <div className="rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02]">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                Step 1 · pick a corpus
              </span>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45 mb-2">
                  built-in corpora (mounted on appliance)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {builtins.length === 0 && (
                    <div className="font-mono text-[11px] text-white/35 italic">no built-ins detected · paste inline below</div>
                  )}
                  {builtins.map((b) => {
                    const active = corpusPath === b.path;
                    return (
                      <button
                        key={b.id}
                        onClick={() => { setCorpusPath(b.path); setCorpusText(""); }}
                        className={`text-left rounded-lg border p-3 transition-colors ${
                          active ? "border-li-cyan/60 bg-li-cyan/[0.04]" : "border-white/10 bg-white/[0.02] hover:border-white/25"
                        }`}
                      >
                        <div className="text-sm text-white tracking-tight">{b.label}</div>
                        <div className="font-mono text-[10.5px] text-white/45 mt-1 truncate">{b.path}</div>
                        <div className="font-mono text-[10.5px] text-white/35 mt-0.5">{fmtBytes(b.size_bytes)}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45 mb-2">
                  or paste inline (JSON / NDJSON / CSV / plaintext, ≤ 8 MB)
                </div>
                <textarea
                  value={corpusText}
                  onChange={(e) => { setCorpusText(e.target.value); if (e.target.value) setCorpusPath(""); }}
                  placeholder='paste corpus content. e.g. [{"id":1,"value":"a"},...] or one record per line'
                  rows={5}
                  spellCheck={false}
                  className="w-full font-mono text-[12px] text-white/85 bg-black/60 border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-li-cyan/60 placeholder:text-white/30 resize-y"
                />
              </div>
            </div>
          </div>

          {/* Step 2: name + options */}
          <div className="rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02]">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                Step 2 · name + options
              </span>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45 mb-2">model name (optional)</div>
                <input
                  value={corpusName}
                  onChange={(e) => setCorpusName(e.target.value)}
                  placeholder="auto-derived from corpus filename if blank"
                  className="w-full font-mono text-[12px] text-white/90 bg-black/60 border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-li-cyan/60 placeholder:text-white/30"
                />
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45 mb-2">crystallization</div>
                <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${useRunpod ? "border-li-purple/50 bg-li-purple/[0.04]" : "border-white/10 bg-white/[0.02]"} ${caps?.runpod_available ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
                  <input
                    type="checkbox"
                    disabled={!caps?.runpod_available}
                    checked={useRunpod && !!caps?.runpod_available}
                    onChange={(e) => setUseRunpod(e.target.checked)}
                    className="accent-li-purple"
                  />
                  <span className="font-mono text-[12px] text-white/85">
                    {caps?.runpod_available
                      ? "submit to RunPod GPU for full TCD-JEPA crystallization"
                      : "RunPod not configured (Node-side crystallization only)"}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Step 3: form */}
          <div className="rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-li-green">
                Step 3 · form
              </span>
              <span className="font-mono text-[10px] text-white/30">POST /api/range-form</span>
            </div>
            <div className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="font-mono text-[12px] text-white/55 max-w-2xl leading-relaxed">
                Range adapts the corpus, fingerprints every record under a
                schema-agnostic projection, crystallizes a taxonomy via
                Hamming neighborhood clustering, and writes a deterministic
                model.range artifact to <code className="text-white/85">{caps?.formed_models_dir ?? "/data/formed_models"}</code>.
              </div>
              <button
                onClick={launchFormation}
                disabled={forming || (!corpusPath.trim() && !corpusText.trim())}
                className="inline-flex items-center justify-center h-12 px-7 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {forming ? "forming…" : "▶ Form private model"}
              </button>
            </div>
          </div>

          {formError && (
            <div className="rounded-xl border border-li-red/30 bg-li-red/5 p-4 font-mono text-[12px] text-li-red">
              {formError}
            </div>
          )}

          {lastFormed && <ModelDetail m={lastFormed} headline="✓ formation complete" />}
        </div>
      )}

      {/* GALLERY TAB */}
      {tab === "gallery" && (
        <div className="space-y-4">
          {models.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-[#0a0a10] p-10 text-center">
              <div className="font-display text-2xl text-white/85 mb-2">No models formed yet</div>
              <div className="font-mono text-[12px] text-white/40 mb-5">
                Switch to “Form a new model” and pick a corpus.
              </div>
              <button
                onClick={() => setTab("form")}
                className="inline-flex items-center justify-center h-10 px-5 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
              >
                ▶ Form a model
              </button>
            </div>
          )}

          {models.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {models.map((m) => {
                const active = selectedModel?.id === m.id;
                return (
                  <div
                    key={m.id}
                    className={`rounded-2xl border bg-[#0a0a10] p-5 cursor-pointer transition-colors ${
                      active ? "border-li-cyan/60 bg-li-cyan/[0.04]" : "border-white/10 hover:border-white/25"
                    }`}
                    onClick={() => inspect(m.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-display text-lg text-white tracking-tight truncate pr-2">{m.name}</div>
                      <span
                        className={`font-mono text-[9px] uppercase tracking-[0.2em] px-1.5 py-0.5 rounded border ${
                          m.fingerprinter_mode === "btut"
                            ? "text-li-green border-li-green/40"
                            : "text-white/55 border-white/20"
                        }`}
                      >
                        {m.fingerprinter_mode === "btut" ? "btut bridge" : "node-only"}
                      </span>
                    </div>
                    <div className="font-mono text-[10.5px] text-white/45 mb-3 break-all leading-relaxed">
                      {m.id} · {m.corpus_format}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <Mini k="records" v={m.corpus_records.toLocaleString()} />
                      <Mini k="size" v={fmtBytes(m.corpus_bytes)} />
                      <Mini k="formed" v={fmtMs(m.formation_ms)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-white/35">
                        {new Date(m.formed_at).toLocaleString()}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); remove(m.id); }}
                        className="font-mono text-[10px] text-white/35 hover:text-li-red transition-colors"
                      >
                        delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selectedModel && <ModelDetail m={selectedModel} headline="selected" />}
        </div>
      )}
    </div>
  );
}

// ---------- subcomponents ----------

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center h-10 px-5 rounded-full font-mono text-[11.5px] uppercase tracking-[0.18em] transition-colors ${
        active
          ? "bg-white text-black"
          : "border border-white/15 text-white/65 hover:text-white hover:border-white/30"
      }`}
    >
      {children}
    </button>
  );
}

function Cap({ k, v, sub, tone }: { k: string; v: string; sub: string; tone: "cyan" | "green" | "white" }) {
  const c = tone === "cyan" ? "text-li-cyan" : tone === "green" ? "text-li-green" : "text-white";
  return (
    <div className="px-5 py-4 border-r border-white/[0.06] last:border-r-0">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">{k}</div>
      <div className={`font-display text-xl tracking-tight ${c}`}>{v}</div>
      <div className="font-mono text-[10px] text-white/35 mt-1 truncate">{sub}</div>
    </div>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-white/40">{k}</div>
      <div className="font-mono text-[12px] text-white/85 tabular-nums">{v}</div>
    </div>
  );
}

function ModelDetail({ m, headline }: { m: FormedModel; headline: string }) {
  return (
    <div className="rounded-2xl border border-li-green/30 bg-li-green/[0.03] overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-li-green">{headline}</span>
        <span className="font-mono text-[10px] text-white/40">
          formed in {fmtMs(m.formation_ms)} · seed={m.seed} · {m.fingerprinter_mode}
        </span>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <div className="font-display text-3xl text-white tracking-tight">{m.name}</div>
          <div className="font-mono text-[11px] text-white/45 mt-1">
            {m.id} · corpus_sha256 = <span className="text-li-cyan">{shortHash(m.corpus_sha256, 16, 6)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Mini k="records" v={m.corpus_records.toLocaleString()} />
          <Mini k="fingerprints" v={m.fingerprints.length.toLocaleString()} />
          <Mini k="classes" v={m.taxonomy.classes.length.toString()} />
          <Mini k="silhouette" v={m.taxonomy.silhouette.toFixed(2)} />
          <Mini k="null-test z" v={`${m.taxonomy.null_test_z.toFixed(2)}σ`} />
          <Mini k="novel" v={m.taxonomy.novel_class_count.toString()} />
          <Mini k="format" v={m.corpus_format} />
          <Mini k="size" v={fmtBytes(m.corpus_bytes)} />
        </div>

        <div className="rounded-lg border border-white/10 bg-black/40 p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1.5">response_digest</div>
          <div className="font-mono text-[11px] text-li-green break-all leading-relaxed">sha256:{m.response_digest}</div>
        </div>

        {m.fields.length > 0 && (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">discovered fields (top by entropy)</div>
            <div className="flex flex-wrap gap-1.5">
              {[...m.fields].sort((a, b) => b.entropy - a.entropy).slice(0, 12).map((f) => (
                <span key={f.name} className="font-mono text-[10.5px] text-white/75 px-2 py-1 rounded border border-white/10 bg-white/[0.02]">
                  {f.name} <span className="text-white/40">·{f.sampleType}</span>{" "}
                  <span className="text-li-cyan">e={f.entropy.toFixed(2)}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {m.taxonomy.classes.length > 0 && (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">discovered classes (top-5)</div>
            <div className="space-y-1">
              {m.taxonomy.classes.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-white/70">class #{c.id}</span>
                  <span className="text-li-cyan tabular-nums">{c.size.toLocaleString()} members</span>
                  <span className="text-white/40">centroid {shortHash(c.centroid_fp48Hex, 8, 0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <a
            href={`#query?model=${m.id}`}
            onClick={(e) => {
              e.preventDefault();
              const el = document.querySelector("[data-range-query-modelpicker]") as HTMLSelectElement | null;
              if (el) {
                el.value = m.id;
                el.dispatchEvent(new Event("change", { bubbles: true }));
                el.scrollIntoView({ behavior: "smooth", block: "center" });
              } else {
                document.getElementById("query")?.scrollIntoView({ behavior: "smooth" });
              }
            }}
            className="inline-flex items-center justify-center h-10 px-5 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
          >
            Query this model →
          </a>
          <a
            href={`/api/range-form/${m.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center h-10 px-4 rounded-full border border-white/15 text-white/75 text-xs font-mono hover:text-white hover:border-white/30 transition-colors"
          >
            view artifact (JSON) ↗
          </a>
        </div>
      </div>
    </div>
  );
}
