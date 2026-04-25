"use client";

/**
 * Classification banner for the NATO Simulation workstation.
 * Rendered at the top and bottom of the /nato-sim layout.
 *
 * Styling uses LO's li-* tokens + a red accent to signal classification
 * context. The text is always "UNCLASSIFIED // FOR SIMULATION USE ONLY"
 * because the briefing materials are student-produced, non-classified,
 * educational simulation artifacts. The look is tradecraft-authentic.
 */
export function ClassificationBanner({ position }: { position: "top" | "bottom" }) {
  return (
    <div
      className={
        "w-full bg-li-red/15 text-li-red text-center py-1 text-[10px] tracking-[0.3em] font-mono uppercase " +
        (position === "top"
          ? "border-b border-li-red/30"
          : "border-t border-li-red/30")
      }
      role="presentation"
    >
      Unclassified // For Simulation Use Only
    </div>
  );
}
