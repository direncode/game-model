/**
 * Tasking — operationalize a DNI tasking memo (or any tasking inject).
 *
 * Operator pastes the memo, system extracts each discrete task, runs
 * RAG over the corpus + graph, synthesizes an INR-voice answer per task,
 * surfaces residual gap, recommends agencies + specific collection ask.
 *
 * Each task becomes a finding (kind='task-response') and a gap row,
 * so the rest of the workstation reflects the new tasking-derived
 * intel posture immediately.
 */
import { Letterhead } from "../_components/Letterhead";
import { TaskingClient } from "./TaskingClient";

export const dynamic = "force-dynamic";

export default function TaskingPage() {
  return (
    <main>
      <div className="max-w-4xl mx-auto px-10 py-10">
        <Letterhead cableNumber="INR-NATO-TASKING-001" />

        <div className="font-mono text-[10px] tracking-[0.28em] uppercase text-li-text-muted mb-1">
          Tasking · Operationalize
        </div>
        <h1 className="font-display text-[34px] leading-tight text-li-text-primary tracking-tight">
          DNI / Collection Orders → Action
        </h1>
        <div className="mt-2 text-[13px] text-li-text-secondary leading-relaxed max-w-3xl">
          Paste the DNI tasking memo, an RFI from another agency, or any
          collection order. The system extracts each discrete task, runs
          RAG over the briefing + corpus + graph, synthesizes an INR-voice
          response per task, and surfaces the residual gap with IC
          tasking recommendations. Each task becomes a finding and a gap
          row — Country Files, Watchboard, and Gaps all reflect the new
          posture.
        </div>

        <div className="my-8 h-px bg-li-border" />

        <TaskingClient />
      </div>
    </main>
  );
}
