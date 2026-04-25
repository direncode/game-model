/**
 * State Department / INR letterhead.
 *
 * Restrained typographic mark — no SVG eagle. Real analytical products
 * are letterhead + rule + body. We mirror that. The seal cosplay is
 * gone; the type carries the authority.
 */
export function Letterhead({
  cableNumber,
  generatedAt,
}: {
  cableNumber?: string;
  generatedAt?: string;
}) {
  const ts = generatedAt
    ? new Date(generatedAt)
    : null;
  const date = ts
    ? ts.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).toUpperCase()
    : "—";
  const time = ts
    ? ts
        .toUTCString()
        .match(/\d{2}:\d{2}/)?.[0]
        .replace(":", "") + "Z"
    : "—";
  return (
    <header className="border-b-2 border-li-text-primary pb-3 mb-6">
      <div className="flex items-baseline justify-between gap-6">
        <div>
          <div className="font-display text-[28px] leading-none text-li-text-primary tracking-tight">
            United States Department of State
          </div>
          <div className="font-mono text-[10px] tracking-[0.32em] text-li-text-secondary mt-1.5 uppercase">
            Bureau of Intelligence and Research · Office of Analysis for Europe
          </div>
        </div>
        <div className="text-right font-mono text-[10px] text-li-text-secondary leading-relaxed">
          <div>{cableNumber ?? "INR-NATO-001"}</div>
          <div>{date}</div>
          <div>{time}</div>
        </div>
      </div>
    </header>
  );
}
