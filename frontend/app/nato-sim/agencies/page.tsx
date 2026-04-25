/**
 * Agencies — IC directory + AWIS sim-team rosters.
 *
 * Lists every agency on the AWIS floor (and the off-floor IC partners
 * we may task remotely). For each:
 *   - long name
 *   - sim team room + director + members (per the Friday deck rosters)
 *   - capability strengths
 *   - best-for-gaps-about (used by the gap scanner)
 *
 * Lets the operator quickly look up "where is CIA's room" or "who's
 * the DIA director today" without leaving the workstation.
 */
import { Letterhead } from "../_components/Letterhead";
import { AgencyDirectory } from "./AgencyDirectory";

export const dynamic = "force-dynamic";

export default function AgenciesPage() {
  return (
    <main>
      <div className="max-w-5xl mx-auto px-10 py-10">
        <Letterhead cableNumber="INR-NATO-AGENCIES-001" />

        <div className="font-mono text-[10px] tracking-[0.28em] uppercase text-li-text-muted mb-1">
          IC Directory · AWIS Floor
        </div>
        <h1 className="font-display text-[34px] leading-tight text-li-text-primary tracking-tight">
          Agencies
        </h1>
        <div className="mt-2 text-[13px] text-li-text-secondary leading-relaxed max-w-3xl">
          Every team on the AWIS floor with room, director, members,
          collection strengths, and the kinds of analytical gaps each is
          best-positioned to fill. Off-floor IC components (NRO, Treasury,
          Energy) are listed at the bottom — taskable through ODNI but
          not staffed in this exercise.
        </div>

        <div className="my-8 h-px bg-li-border" />

        <AgencyDirectory />
      </div>
    </main>
  );
}
