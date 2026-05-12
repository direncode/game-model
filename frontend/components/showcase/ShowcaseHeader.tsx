import type { ShowcaseProps } from "./types";
import { perLabelScores } from "./types";

export function ShowcaseHeader({ namespace, dataset, title, tagline, free, premium }: ShowcaseProps) {
  const freeScores = perLabelScores(free);
  const isStub =
    typeof premium._note === "string" || premium.pipeline?.status === "premium-stub";

  const freeTop = Math.max(0, ...Object.values(freeScores));

  return (
    <header className="mb-8">
      <div className="text-xs font-mono uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">
        stdlib | {namespace}.{dataset}
      </div>
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">{title}</h1>
      <p className="text-zinc-600 dark:text-zinc-400 mb-4">{tagline}</p>
      <div className="inline-flex items-center gap-3 text-sm font-mono text-zinc-700 dark:text-zinc-300">
        <span>free max-dispersion {freeTop.toFixed(2)}</span>
        <span className="text-zinc-400">|</span>
        <span>premium {isStub ? "(stub)" : "see panel"}</span>
      </div>
    </header>
  );
}
