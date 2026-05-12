import type { ShowcaseArtifact } from "./types";
import { perLabelScores } from "./types";

export function ShowcaseArtifactPanel({
  artifact,
  tier,
  labelField,
}: {
  artifact: ShowcaseArtifact;
  tier: "free" | "premium";
  labelField: string;
}) {
  const tierLabel = tier === "free" ? "free-tier" : "premium";
  const tierClass =
    tier === "free"
      ? "border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/40"
      : "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30";

  const isStub =
    typeof artifact._note === "string" ||
    artifact.pipeline?.status === "premium-stub";

  const scores = isStub ? {} : perLabelScores(artifact);
  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const moduleCount = artifact.aligned_modules?.length ?? 0;

  return (
    <div className={`rounded-md border ${tierClass} p-5`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
          {tierLabel}
        </h3>
        {artifact.pipeline?.seed !== undefined && (
          <span className="text-xs text-zinc-500">seed {artifact.pipeline.seed}</span>
        )}
      </div>
      {isStub ? (
        <div className="text-sm text-amber-700 dark:text-amber-400 italic">
          {artifact._note ?? "premium-tier stub"}
        </div>
      ) : (
        <>
          {sortedScores.length > 0 && (
            <div className="mb-3">
              <div className="text-xs uppercase text-zinc-500 mb-1">
                dispersion (per {labelField})
              </div>
              <ul className="space-y-0.5">
                {sortedScores.slice(0, 8).map(([label, score]) => (
                  <li key={label} className="text-sm font-mono">
                    <span className="text-zinc-700 dark:text-zinc-300">{label}</span>
                    <span className="text-zinc-400 mx-2">{"->"}</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {score.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="text-xs text-zinc-500 mt-3">{moduleCount} modules</div>
        </>
      )}
    </div>
  );
}
