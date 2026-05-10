"use client";

import { useEffect, useState, useTransition } from "react";
import { highlightOcean } from "@/lib/handbook-shiki";
import { runSnippet, type RunResult, type RunUnavailable } from "@/lib/handbook-runner-client";

type Props = {
  code: string;
  runnable: boolean;
  corpus: string | null;
};

export function OceanCodeBlock({ code, runnable, corpus }: Props) {
  const [html, setHtml] = useState<string>("");
  const [result, setResult] = useState<RunResult | RunUnavailable | null>(null);
  const [isRunning, startTransition] = useTransition();

  useEffect(() => {
    let canceled = false;
    highlightOcean(code)
      .then((h) => {
        if (!canceled) setHtml(h);
      })
      .catch(() => {
        // Fall back to plain escaped code if Shiki is unavailable (e.g. in tests).
        if (!canceled) setHtml(`<pre>${escapeHtml(code)}</pre>`);
      });
    return () => {
      canceled = true;
    };
  }, [code]);

  function onCopy() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(code);
    }
  }

  function onRun() {
    if (!corpus) return;
    startTransition(async () => {
      const r = await runSnippet(code, corpus);
      setResult(r);
    });
  }

  return (
    <div className="handbook-code-block rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between px-3 py-1 text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
        <span>ocean{corpus ? `  corpus=${corpus}` : ""}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCopy}
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Copy
          </button>
          {runnable && (
            <button
              type="button"
              onClick={onRun}
              disabled={isRunning}
              className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
            >
              {isRunning ? "Running…" : "Run ▶"}
            </button>
          )}
        </div>
      </div>
      <div
        className="p-3 text-sm overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: html || `<pre>${escapeHtml(code)}</pre>` }}
      />
      {result !== null && <RunResultPanel result={result} />}
    </div>
  );
}

function RunResultPanel({ result }: { result: RunResult | RunUnavailable }) {
  if (result.ok === false && result.category === "unavailable") {
    return (
      <div className="border-t border-zinc-200 dark:border-zinc-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
        {result.message}
      </div>
    );
  }
  if (result.ok === false) {
    return (
      <div className="border-t border-zinc-200 dark:border-zinc-800 px-3 py-2 text-xs text-rose-700 dark:text-rose-400 font-mono">
        line {result.diagnostic.line}, col {result.diagnostic.col}: {result.category} error
        <br />
        {result.diagnostic.message}
        <br />
        <span className="text-zinc-500">hint: {result.diagnostic.hint}</span>
      </div>
    );
  }
  return (
    <div className="border-t border-zinc-200 dark:border-zinc-800 px-3 py-2 text-xs font-mono">
      {result.steps.map((s, i) => (
        <div key={i}>
          [{i + 1}/{result.steps.length}] {s.verb} — {s.duration_ms}ms · {s.summary}
        </div>
      ))}
      <div className="mt-2 text-zinc-500">artifact:</div>
      <pre className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{result.artifact_preview}</pre>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
