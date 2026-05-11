"use client";

import { useEffect, useState } from "react";

const LAUNCH_COMMAND = `python scripts/operators/mine_sweep_console.py`;
const ADVANCED_COMMAND = `python scripts/operators/mine_sweep_console.py --rate 20 --max-contacts 5000 --alert-threshold 14.0`;

// A representation of the TUI's live panels. The actual terminal binary
// renders these with rich.console.Layout at runtime; this is the visual
// preview operators see before they spawn the on-prem session.
const PREVIEW_FRAMES = [
  {
    label: "boot",
    header: "OCEAN SUBSTRATE · MCM CONSOLE · STRAIT OF HORMUZ AOR · DEMO / PUBLIC SONAR · 2026-05-11 12:04:11 UTC",
    map: [
      ["mod 0", "(awaiting first contact)", "--", ""],
    ],
    audit: [
      "(awaiting first contact)",
    ],
    alerts: ["(no doctrinal-shift alerts yet)"],
    events: [
      "[12:01:28] BOOT   ocean substrate · mcm console booting",
      "[12:01:28] BOOT   corpus: features_uatd_gabor.parquet",
      "[12:01:34] BOOT   loaded 60000 records · feat_dim=128",
      "[12:01:34] BOOT   loading substrate operators",
      "[12:01:34] BOOT   training substrate on 39046 bg records",
      "[12:04:08] BOOT   substrate emerged 14 modules",
      "[12:04:08] BOOT   entering streaming mode · Ctrl-C to exit",
    ],
    status: ["contacts: 0", "rate: 0.0/s", "modules: 14", "alerts: 0", "uptime: 0s"],
  },
  {
    label: "streaming",
    header: "OCEAN SUBSTRATE · MCM CONSOLE · STRAIT OF HORMUZ AOR · DEMO / PUBLIC SONAR · 2026-05-11 12:07:42 UTC",
    map: [
      ["mod 8",  "tyre",        "1,247", "████████████████████ "],
      ["mod 10", "ball",        "  983", "███████████████░░░░░ "],
      ["mod 11", "human body",  "  421", "██████░░░░░░░░░░░░░░ "],
      ["mod 12", "square cage", "  198", "███░░░░░░░░░░░░░░░░░ "],
      ["mod 4",  "circle cage", "  117", "█░░░░░░░░░░░░░░░░░░░ "],
      ["mod 17", "UNKNOWN [NEW]", "    7", "░░░░░░░░░░░░░░░░░░░░ "],
    ],
    audit: [
      "contact_id              ping_2026-05-11_AUV-04_4783",
      "ground truth            POSITIVE",
      "assigned module         mod-17  (UNKNOWN [NEW])",
      "distance to centroid    21.42σ",
      "nearest 3 alternatives  mod-17(21.42σ) / mod-12(28.7σ) / mod-4(31.1σ)",
      "feature deviation L2    21.418",
      "driver feature dim      feat_414  (+21.40σ)",
      "classification          NOVEL · DOCTRINAL SHIFT ALERT",
      "reproducibility         byte-identical from seed=42",
    ],
    alerts: [
      "[12:07:41] DOCTRINAL SHIFT · contact ping_4783 · dist=21.42 > 18σ · nearest=mod-17 (UNKNOWN [NEW])",
      "[12:07:23] DOCTRINAL SHIFT · contact ping_4612 · dist=19.85 > 18σ · nearest=mod-17 (UNKNOWN [NEW])",
      "[12:06:58] DOCTRINAL SHIFT · contact ping_4441 · dist=18.93 > 18σ · nearest=mod-17 (UNKNOWN [NEW])",
    ],
    events: [
      "[12:07:42] INFO   contact 2973 assigned mod-8 (tyre) · dist 1.94σ",
      "[12:07:42] INFO   contact 2972 assigned mod-10 (ball) · dist 0.87σ",
      "[12:07:41] INFO   contact 2971 assigned mod-17 (NEW) · dist 21.42σ · ALERT",
      "[12:07:41] INFO   contact 2970 assigned mod-11 (human body) · dist 1.15σ",
      "[12:07:40] INFO   contact 2969 assigned mod-8 (tyre) · dist 2.08σ",
      "[12:07:40] INFO   contact 2968 assigned mod-10 (ball) · dist 1.42σ",
      "[12:07:39] INFO   contact 2967 assigned mod-4 (circle cage) · dist 1.93σ",
    ],
    status: ["contacts: 2,973", "rate: 12.1/s", "modules: 14", "alerts: 3", "uptime: 213s"],
  },
];

export function ConsoleLaunch() {
  const [copied, setCopied] = useState<string | null>(null);
  const [frameIdx, setFrameIdx] = useState(0);

  // Auto-cycle through the preview frames so the embed feels live
  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIdx((i) => (i + 1) % PREVIEW_FRAMES.length);
    }, 4200);
    return () => clearInterval(interval);
  }, []);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied("err");
      setTimeout(() => setCopied(null), 1800);
    }
  };

  const frame = PREVIEW_FRAMES[frameIdx];
  const isAlert = frame.label === "streaming";

  return (
    <section id="launch" className="px-6 border-b border-white/5 py-20">
      <div className="max-w-[1100px] mx-auto">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
          on-premise tactical console
        </p>
        <h2 className="font-display font-medium text-[clamp(34px,5vw,68px)] leading-[0.96] tracking-[-0.03em] text-white max-w-3xl mb-8">
          Spawn the native session.
        </h2>
        <p className="text-lg text-white/75 max-w-3xl leading-relaxed mb-4">
          The web page is for catalog visibility. The operational surface
          is a native terminal binary that runs on the tactical
          workstation — CIC display, AUV ground station, ATR console —
          without a browser, without a web server, without cloud
          connectivity. Same substrate operators the measurements above
          ran on, same OCEAN pipeline file, same byte-identical
          reproducibility, multi-pane real-time display.
        </p>
        <p className="text-sm text-white/55 max-w-3xl leading-relaxed mb-10">
          Copy the command into the tactical workstation's shell to
          launch the live session on the locally-stored corpus. The preview
          below cycles between the boot phase and a representative
          streaming frame mid-session.
        </p>

        {/* Launch command blocks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-10">
          <div className="border border-cyan-400/25 bg-cyan-500/[0.04] rounded-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-cyan-400/20 bg-cyan-500/[0.06]">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-cyan-300/85">
                launch · default
              </div>
              <button
                onClick={() => copy(LAUNCH_COMMAND, "default")}
                className="font-mono text-[10.5px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-sm border border-cyan-400/30 text-cyan-200/85 hover:bg-cyan-500/15 hover:text-white transition-colors"
              >
                {copied === "default" ? "copied" : "copy"}
              </button>
            </div>
            <pre className="font-mono text-xs text-white/90 leading-relaxed p-4 overflow-x-auto">
              {LAUNCH_COMMAND}
            </pre>
            <div className="px-4 pb-3 text-xs text-white/45">
              Boot, train substrate on local corpus, stream contacts at default 12/sec rate.
            </div>
          </div>
          <div className="border border-white/10 bg-white/[0.02] rounded-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/[0.02]">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/55">
                launch · high-tempo + tight alert threshold
              </div>
              <button
                onClick={() => copy(ADVANCED_COMMAND, "advanced")}
                className="font-mono text-[10.5px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-sm border border-white/15 text-white/65 hover:bg-white/10 hover:text-white transition-colors"
              >
                {copied === "advanced" ? "copied" : "copy"}
              </button>
            </div>
            <pre className="font-mono text-xs text-white/85 leading-relaxed p-4 overflow-x-auto whitespace-pre-wrap">
              {ADVANCED_COMMAND}
            </pre>
            <div className="px-4 pb-3 text-xs text-white/45">
              20 contacts/sec stream, 5,000 contact cap, 14σ doctrinal-shift threshold.
            </div>
          </div>
        </div>

        {/* Terminal embed — styled HTML representation of the TUI */}
        <div className="border border-white/15 rounded-sm overflow-hidden bg-black shadow-2xl">
          {/* Title bar (mac-style traffic lights for visual familiarity) */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/[0.04]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
            </div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/55">
              tactical-workstation:~/latentocean ·{" "}
              <span className="text-cyan-300/85">
                python scripts/operators/mine_sweep_console.py
              </span>
            </div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45">
              {frame.label === "boot" ? "phase · boot" : "phase · streaming"}
            </div>
          </div>

          {/* Embedded TUI representation */}
          <div className="p-4 font-mono text-[11.5px] leading-relaxed text-white/85 space-y-3">
            {/* Header bar */}
            <div className="border border-cyan-400/30 rounded-sm p-1.5 text-center text-cyan-200/85 bg-cyan-500/[0.05]">
              {frame.header}
            </div>

            {/* Main body — map (left) + audit (right) */}
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {/* Campaign Map */}
              <div className="md:col-span-3 border border-cyan-400/25 rounded-sm overflow-hidden">
                <div className="border-b border-cyan-400/20 px-3 py-1.5 text-cyan-300/85 text-[10.5px] uppercase tracking-[0.18em]">
                  Live Campaign Map
                </div>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-cyan-400/15 bg-cyan-500/[0.04] text-cyan-300/75 text-[9.5px] uppercase tracking-[0.15em]">
                      <th className="text-left px-2 py-1.5">mod</th>
                      <th className="text-left px-2 py-1.5">class</th>
                      <th className="text-right px-2 py-1.5">n</th>
                      <th className="text-left px-2 py-1.5">load</th>
                    </tr>
                  </thead>
                  <tbody>
                    {frame.map.map((row, i) => {
                      const isNew = row[1].includes("NEW");
                      return (
                        <tr key={i} className="border-b border-white/5 last:border-b-0">
                          <td className="px-2 py-1.5 text-white/85">{row[0]}</td>
                          <td className={`px-2 py-1.5 ${isNew ? "text-fuchsia-300/90 font-medium" : "text-white/85"}`}>
                            {row[1]}
                          </td>
                          <td className="px-2 py-1.5 text-right text-white/75">{row[2]}</td>
                          <td className="px-2 py-1.5 text-cyan-300/70 whitespace-pre">{row[3]}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Audit */}
              <div className={`md:col-span-4 border rounded-sm overflow-hidden ${
                isAlert && frame.audit.some((l) => l.includes("DOCTRINAL"))
                  ? "border-rose-400/40"
                  : "border-cyan-400/25"
              }`}>
                <div className={`border-b px-3 py-1.5 text-[10.5px] uppercase tracking-[0.18em] ${
                  isAlert && frame.audit.some((l) => l.includes("DOCTRINAL"))
                    ? "border-rose-400/30 text-rose-300/90"
                    : "border-cyan-400/20 text-cyan-300/85"
                }`}>
                  Per-Contact Audit · 11 structured fields
                </div>
                <div className="px-3 py-2 space-y-0.5">
                  {frame.audit.map((line, i) => {
                    if (line.includes("DOCTRINAL SHIFT ALERT")) {
                      const [label, ...val] = line.split(/\s{2,}/);
                      return (
                        <div key={i} className="grid grid-cols-[180px_1fr] text-[11px]">
                          <span className="text-cyan-300/60">{label}</span>
                          <span className="text-rose-300 font-medium">{val.join(" ")}</span>
                        </div>
                      );
                    }
                    if (line.startsWith("(") && line.endsWith(")")) {
                      return <div key={i} className="text-white/40 italic">{line}</div>;
                    }
                    const m = line.match(/^(\S(?:\S| )*?)\s{2,}(.*)$/);
                    if (m) {
                      return (
                        <div key={i} className="grid grid-cols-[180px_1fr] text-[11px]">
                          <span className="text-cyan-300/60">{m[1]}</span>
                          <span className="text-white/85">{m[2]}</span>
                        </div>
                      );
                    }
                    return <div key={i} className="text-white/75">{line}</div>;
                  })}
                </div>
              </div>
            </div>

            {/* Alerts panel */}
            <div className={`border rounded-sm overflow-hidden ${
              frame.alerts.some((a) => a.includes("DOCTRINAL"))
                ? "border-rose-400/40"
                : "border-white/15"
            }`}>
              <div className={`border-b px-3 py-1.5 text-[10.5px] uppercase tracking-[0.18em] ${
                frame.alerts.some((a) => a.includes("DOCTRINAL"))
                  ? "border-rose-400/30 text-rose-300/90"
                  : "border-white/15 text-white/55"
              }`}>
                Doctrinal-Shift Alerts ·{" "}
                {frame.alerts.filter((a) => a.includes("DOCTRINAL")).length} active · novel-class on first occurrence
              </div>
              <div className="px-3 py-2 space-y-0.5">
                {frame.alerts.map((line, i) => {
                  if (line.startsWith("(") && line.endsWith(")")) {
                    return <div key={i} className="text-white/40 italic">{line}</div>;
                  }
                  return (
                    <div key={i} className="text-rose-200/90">
                      {line}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Event log */}
            <div className="border border-white/15 rounded-sm overflow-hidden">
              <div className="border-b border-white/15 px-3 py-1.5 text-[10.5px] uppercase tracking-[0.18em] text-white/55">
                Event Log
              </div>
              <div className="px-3 py-2 space-y-0.5">
                {frame.events.map((line, i) => {
                  const isInfo = line.includes("INFO");
                  const isBoot = line.includes("BOOT");
                  const isAlert = line.includes("ALERT");
                  return (
                    <div key={i} className="text-white/80">
                      <span className="text-white/45">{line.slice(0, 10)}</span>{" "}
                      <span className={
                        isAlert ? "text-rose-300" :
                        isBoot ? "text-cyan-300/75" :
                        "text-white/55"
                      }>
                        {line.slice(11, 17)}
                      </span>
                      <span className={isAlert ? "text-rose-200" : "text-white/80"}>
                        {line.slice(17)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status bar */}
            <div className="border border-white/15 rounded-sm bg-white/[0.02] px-3 py-1.5 grid grid-cols-5 gap-3 text-[11px]">
              {frame.status.map((s, i) => {
                const isAlertField = s.toLowerCase().startsWith("alerts");
                const alertCount = isAlertField ? parseInt(s.split(":")[1].trim()) : 0;
                return (
                  <div
                    key={i}
                    className={`text-center ${
                      isAlertField && alertCount > 0 ? "text-rose-300 font-medium" : "text-white/75"
                    }`}
                  >
                    <span className="text-cyan-300/55">{s.split(":")[0]}:</span>{" "}
                    <span>{s.split(":").slice(1).join(":").trim()}</span>
                  </div>
                );
              })}
            </div>

            {/* Frame indicator */}
            <div className="flex items-center justify-center gap-2 pt-2 pb-1">
              {PREVIEW_FRAMES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setFrameIdx(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === frameIdx ? "bg-cyan-300" : "bg-white/20 hover:bg-white/40"
                  }`}
                  aria-label={`frame ${i + 1}`}
                />
              ))}
              <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                preview cycles {PREVIEW_FRAMES.length}× phases · click dots to jump
              </span>
            </div>
          </div>
        </div>

        <p className="mt-8 text-xs text-white/45 leading-relaxed max-w-3xl">
          The embed above is a styled representation of the
          terminal binary's output. The real session at the tactical
          workstation runs via rich.console.Layout with full ANSI
          rendering, refreshes 8× per second, and accepts Ctrl-C to halt.
          Source: scripts/operators/mine_sweep_console.py.
        </p>
      </div>
    </section>
  );
}
