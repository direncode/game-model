"use client";

import { useState } from "react";

export function ShowcaseSourcePanel({
  source,
  presetName,
  tier,
}: {
  source: string;
  presetName: string;
  tier: "free" | "premium";
}) {
  const [copied, setCopied] = useState(false);

  function onCopy() {
    void navigator.clipboard.writeText(source);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const runCommand = `ocean run ${presetName}`;

  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-xs font-mono text-zinc-500">
          stdlib/{presetName.split(".")[0]}.ocean | {tier === "free" ? "free-tier preset" : "premium preset"}
        </span>
        <button
          onClick={onCopy}
          className="text-xs text-emerald-600 hover:text-emerald-700"
        >
          {copied ? "copied!" : "copy"}
        </button>
      </div>
      <pre className="p-3 text-xs font-mono text-zinc-700 dark:text-zinc-300 overflow-x-auto whitespace-pre-wrap">
        {source}
      </pre>
      <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-500">
        run with: <span className="text-zinc-700 dark:text-zinc-300">{runCommand}</span>
      </div>
    </div>
  );
}
