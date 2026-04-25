"use client";

/**
 * Classification banner for the NATO Simulation workstation.
 *
 * Tradecraft-authentic: the real INR/JWICS terminals carry a thin
 * classification strip top and bottom of every page. Color encodes the
 * level (TS = orange, S = red, C = blue, U = green). For the AWIS sim
 * the banner is unclassified-with-handling-caveat.
 *
 * Restrained: 22px tall, mono type, no icons, single neutral accent.
 */
export function ClassificationBanner({ position }: { position: "top" | "bottom" }) {
  return (
    <div
      className={
        "w-full bg-li-red text-white text-center py-1 text-[10px] tracking-[0.32em] font-mono uppercase select-none " +
        (position === "top"
          ? "border-b border-li-red"
          : "border-t border-li-red")
      }
      role="presentation"
    >
      Unclassified // For Simulation Use Only // AWIS 2026
    </div>
  );
}
