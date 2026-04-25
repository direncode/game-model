/**
 * U.S. Department of State seal — simplified vector rendition.
 * The official seal is public-domain U.S. government insignia. We render
 * a clean, recognizable approximation in SVG so the workstation looks
 * like an actual State Department product. Sized for inline use in
 * page headers. Color overridden by `currentColor` so it adapts to the
 * page palette.
 */
export function StateDeptSeal({
  size = 56,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="U.S. Department of State"
      className={className}
    >
      {/* Outer ring */}
      <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
      <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.4" />
      {/* Outer text-ring decorations (small dashes simulating the lettering) */}
      {Array.from({ length: 36 }).map((_, i) => {
        const angle = (i * 360) / 36;
        const rad = (angle * Math.PI) / 180;
        const x1 = 50 + Math.cos(rad) * 45.5;
        const y1 = 50 + Math.sin(rad) * 45.5;
        const x2 = 50 + Math.cos(rad) * 47;
        const y2 = 50 + Math.sin(rad) * 47;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth="0.7"
            opacity="0.55"
          />
        );
      })}
      {/* Eagle silhouette (very simplified). Wings + body + shield. */}
      <g fill="currentColor" opacity="0.85">
        {/* Body */}
        <ellipse cx="50" cy="55" rx="3.5" ry="9" />
        {/* Head */}
        <circle cx="50" cy="44" r="3.2" />
        {/* Beak */}
        <path d="M53 44 L56 44 L53 46 Z" />
        {/* Wing left */}
        <path d="M28 50 Q38 42, 47 52 Q42 56, 35 58 Q30 56, 28 50 Z" />
        {/* Wing right */}
        <path d="M72 50 Q62 42, 53 52 Q58 56, 65 58 Q70 56, 72 50 Z" />
        {/* Shield over chest */}
        <rect x="46.5" y="50" width="7" height="9" rx="0.6" opacity="0.7" />
        {/* Shield stripes */}
        <line x1="47.5" y1="53" x2="52.5" y2="53" stroke="black" strokeWidth="0.3" opacity="0.4" />
        <line x1="47.5" y1="55" x2="52.5" y2="55" stroke="black" strokeWidth="0.3" opacity="0.4" />
        <line x1="47.5" y1="57" x2="52.5" y2="57" stroke="black" strokeWidth="0.3" opacity="0.4" />
        {/* Olive branch left, arrows right (simplified as small lines) */}
        <line x1="33" y1="62" x2="42" y2="64" stroke="currentColor" strokeWidth="0.7" />
        <line x1="35" y1="60" x2="42" y2="63" stroke="currentColor" strokeWidth="0.5" />
        <line x1="58" y1="64" x2="67" y2="62" stroke="currentColor" strokeWidth="0.7" />
        <line x1="58" y1="63" x2="65" y2="60" stroke="currentColor" strokeWidth="0.5" />
      </g>
      {/* Bottom banner — "U.S.A." style */}
      <text
        x="50"
        y="78"
        textAnchor="middle"
        fontSize="6"
        fontFamily="Inter, sans-serif"
        fontWeight="600"
        fill="currentColor"
        opacity="0.75"
        letterSpacing="1.5"
      >
        DEPT OF STATE
      </text>
      <text
        x="50"
        y="86"
        textAnchor="middle"
        fontSize="4"
        fontFamily="Inter, sans-serif"
        fill="currentColor"
        opacity="0.55"
        letterSpacing="1.2"
      >
        BUREAU OF INTELLIGENCE
      </text>
    </svg>
  );
}
