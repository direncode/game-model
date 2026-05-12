export type AlignedModuleAlignment = {
  k_nearest?: number;
  dominant_label?: string;
  dominant_share?: number;
  bleed_share?: number;
  top3_labels?: { label: string; count: number; share: number }[];
  fine_label_dist?: Record<string, number>;
  sample_records?: { paper_id?: string; label?: string; title?: string }[];
};

export type AlignedModule = {
  module_id?: number | string;
  module_class?: string;
  centroid_stats?: Record<string, unknown>;
  topology?: Record<string, unknown> | null;
  alignment?: AlignedModuleAlignment;
};

export type ShowcaseArtifact = {
  _meta?: Record<string, unknown>;
  _note?: string;
  aligned_modules?: AlignedModule[];
  // Legacy/stub fields (premium-stub artifacts use these placeholders):
  pipeline?: { seed?: number; tier?: string; status?: string };
  modules?: unknown[];
  alignment?: Record<string, unknown>;
  dispersion?: Record<string, unknown>;
};

export type ShowcaseProps = {
  namespace: string;
  dataset: string;
  title: string;
  tagline: string;
  labelField: string;       // e.g. "directorate" for pulse
  free: ShowcaseArtifact;
  premium: ShowcaseArtifact;
  freeSource: string;
  premiumSource: string;
};

/** Derive per-label headline dispersion scores from the aligned_modules. */
export function perLabelScores(artifact: ShowcaseArtifact): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const mod of artifact.aligned_modules ?? []) {
    const dl = mod.alignment?.dominant_label;
    const ds = mod.alignment?.dominant_share;
    if (typeof dl !== "string" || typeof ds !== "number") continue;
    scores[dl] = Math.max(scores[dl] ?? 0, ds);
  }
  return scores;
}
