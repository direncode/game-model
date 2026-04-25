/**
 * Shared chrome for analytical products — confidence badge, topic label,
 * classification line, timestamp. Keeps every page visually consistent
 * without each one reinventing the header.
 */

type Confidence = "HIGH" | "MEDIUM" | "LOW" | null | undefined;

function badgeClass(level: Confidence): string {
  if (level === "HIGH") return "bg-li-green/15 text-li-green";
  if (level === "MEDIUM") return "bg-li-yellow/15 text-li-yellow";
  if (level === "LOW") return "bg-li-red/15 text-li-red";
  return "bg-li-gray-800 text-li-text-muted";
}

export function ProductChrome({
  eyebrow,
  title,
  subtitle,
  confidence,
  generatedAt,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  confidence?: Confidence;
  generatedAt?: string;
}) {
  return (
    <header className="border-b border-li-border pb-4 mb-8">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] tracking-[0.3em] text-li-text-muted font-mono uppercase">
            {eyebrow}
          </div>
          <h1 className="font-display text-4xl text-li-text-primary mt-1">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-li-text-secondary mt-2 max-w-2xl">
              {subtitle}
            </p>
          )}
          {generatedAt && (
            <p className="text-[10px] text-li-text-muted mt-2 font-mono">
              Generated {new Date(generatedAt).toLocaleString()}
            </p>
          )}
        </div>
        {confidence && (
          <span
            className={
              "inline-block px-3 py-1 text-[10px] tracking-[0.2em] font-mono uppercase rounded " +
              badgeClass(confidence)
            }
          >
            Confidence · {confidence}
          </span>
        )}
      </div>
    </header>
  );
}

export function ProductBody({ text }: { text: string }) {
  return (
    <article className="font-sans">
      <pre className="whitespace-pre-wrap text-[15px] leading-relaxed text-li-text-primary font-sans bg-transparent p-0 border-0">
        {text}
      </pre>
    </article>
  );
}

export function EmptyProduct({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="border border-dashed border-li-border rounded p-8 text-center">
      <div className="text-li-text-secondary text-sm font-mono">{title}</div>
      {hint && (
        <div className="text-li-text-muted text-xs mt-2 font-mono">{hint}</div>
      )}
    </div>
  );
}
