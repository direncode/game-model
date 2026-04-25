/**
 * Gaps — intelligence-gap surface + IC tasking recommendations.
 *
 * Each row is a finding the analyst has flagged as evidence-thin
 * (LOW confidence, single-source, dissent-driven, etc.). For each
 * gap the system surfaces which agencies to ask and what to ask for.
 * Operator clicks "Scan now" to refresh.
 */
import { Letterhead } from "../_components/Letterhead";
import { GapsTable } from "./GapsTable";

export const dynamic = "force-dynamic";

export default function GapsPage() {
  return (
    <main>
      <div className="max-w-5xl mx-auto px-10 py-10">
        <Letterhead cableNumber="INR-NATO-GAPS-001" />

        <div className="font-mono text-[10px] tracking-[0.28em] uppercase text-li-text-muted mb-1">
          Analytical Gaps · IC Tasking Recommendations
        </div>
        <h1 className="font-display text-[34px] leading-tight text-li-text-primary tracking-tight">
          Where We&apos;re Thin — and Who To Ask
        </h1>
        <div className="mt-2 text-[13px] text-li-text-secondary leading-relaxed max-w-3xl">
          Auto-derived from current findings. Every LOW-confidence
          assessment, every single-source claim, every dissent-driven
          alt-view becomes a candidate gap. For each, the system
          recommends which IC agencies are best-positioned to fill it
          and what specific collection to ask for. Click <span className="text-li-cyan">Scan now</span>{" "}
          to refresh against the latest findings.
        </div>

        <div className="my-8 h-px bg-li-border" />

        <GapsTable />
      </div>
    </main>
  );
}
