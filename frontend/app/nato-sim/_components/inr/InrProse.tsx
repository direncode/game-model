"use client";

/**
 * Rich renderer for synthesized INR analytical prose.
 *
 * The synthesizer emits text with a known structure (per inr_voice
 * system prompt):
 *   - First paragraph starts with "BLUF:"
 *   - Subsequent paragraphs are numbered "1.", "2.", etc.
 *   - Each sentence carries a portion marker "(U)", "(C)", "(S)"
 *   - Citations are inline in [square brackets]
 *   - Optional "ALTERNATIVE VIEW:" block near the end
 *   - Optional "CONFIDENCE: HIGH/MEDIUM/LOW" closing line
 *
 * This component parses that structure into proper UI primitives:
 * BLUF in a styled callout, Key Judgments as numbered cards,
 * portion markers as subtle pills, citations as clickable chips.
 *
 * Falls back to whitespace-preserving rendering if the input doesn't
 * match the expected format — never throws, never hides content.
 */

import type { ReactNode } from "react";

interface ParsedFinding {
  bluf: string | null;
  paragraphs: { n: number | null; text: string }[];
  altView: string | null;
  confidenceLine: string | null;
}

const PARA_RE = /^\s*(\d+)\.\s+/;
const PORTION_RE = /\((U|C|S)\)\s*/g;
const CITE_RE = /\[([^\]\n]{1,160})\]/g;

function parse(text: string): ParsedFinding {
  if (!text || !text.trim()) {
    return { bluf: null, paragraphs: [], altView: null, confidenceLine: null };
  }
  // Split on blank-line boundaries to get logical paragraphs.
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  let bluf: string | null = null;
  let altView: string | null = null;
  let confidenceLine: string | null = null;
  const paragraphs: { n: number | null; text: string }[] = [];

  let inAltView = false;
  let altViewBuf: string[] = [];

  for (const block of blocks) {
    const lower = block.toLowerCase();

    // CONFIDENCE line — terminal
    if (lower.startsWith("confidence:")) {
      confidenceLine = block;
      if (inAltView) {
        altView = altViewBuf.join("\n\n");
        inAltView = false;
      }
      continue;
    }

    // ALTERNATIVE VIEW block start
    if (lower.startsWith("alternative view")) {
      // Strip the heading from the block before pushing the rest to altViewBuf.
      const restAfterHeader = block.replace(/^alternative view[:\s]*/i, "").trim();
      altViewBuf = restAfterHeader ? [restAfterHeader] : [];
      inAltView = true;
      continue;
    }

    if (inAltView) {
      altViewBuf.push(block);
      continue;
    }

    // BLUF block (singleton, first match)
    if (!bluf && lower.startsWith("bluf:")) {
      bluf = block.replace(/^bluf:\s*/i, "").trim();
      continue;
    }

    // Numbered paragraph
    const m = block.match(PARA_RE);
    if (m) {
      paragraphs.push({
        n: parseInt(m[1], 10),
        text: block.replace(PARA_RE, "").trim(),
      });
    } else {
      // Free-form paragraph
      paragraphs.push({ n: null, text: block });
    }
  }

  if (inAltView) altView = altViewBuf.join("\n\n");

  return { bluf, paragraphs, altView, confidenceLine };
}

function renderInline(text: string): ReactNode[] {
  // Splits a paragraph into spans, styling portion markers and citations.
  const out: ReactNode[] = [];
  let cursor = 0;

  // First pass: locate every portion marker and citation in source order.
  type Hit = { start: number; end: number; kind: "portion" | "cite"; payload: string };
  const hits: Hit[] = [];

  PORTION_RE.lastIndex = 0;
  for (let m: RegExpExecArray | null; (m = PORTION_RE.exec(text)) !== null; ) {
    hits.push({ start: m.index, end: m.index + m[0].length, kind: "portion", payload: m[1] });
  }
  CITE_RE.lastIndex = 0;
  for (let m: RegExpExecArray | null; (m = CITE_RE.exec(text)) !== null; ) {
    hits.push({ start: m.index, end: m.index + m[0].length, kind: "cite", payload: m[1] });
  }
  hits.sort((a, b) => a.start - b.start);

  let key = 0;
  for (const h of hits) {
    if (h.start > cursor) {
      out.push(<span key={key++}>{text.slice(cursor, h.start)}</span>);
    }
    if (h.kind === "portion") {
      out.push(
        <span
          key={key++}
          className="inline-block text-[9px] tracking-widest uppercase font-mono text-li-text-muted bg-li-gray-900/60 px-1 py-px mr-0.5 rounded-sm align-baseline"
        >
          {h.payload}
        </span>,
      );
    } else {
      out.push(
        <span
          key={key++}
          className="inline-block text-[10px] font-mono text-li-cyan/85 bg-li-cyan/10 border border-li-cyan/20 px-1.5 py-px rounded-sm mx-0.5 align-baseline"
          title="source"
        >
          {h.payload}
        </span>,
      );
    }
    cursor = h.end;
  }
  if (cursor < text.length) {
    out.push(<span key={key++}>{text.slice(cursor)}</span>);
  }
  return out;
}

function ConfidencePill({ line }: { line: string }) {
  const upper = line.toUpperCase();
  const level = upper.includes("HIGH")
    ? "HIGH"
    : upper.includes("MEDIUM") || upper.includes("MODERATE")
      ? "MEDIUM"
      : upper.includes("LOW")
        ? "LOW"
        : null;
  const color =
    level === "HIGH"
      ? "bg-li-green/15 text-li-green border-li-green/30"
      : level === "MEDIUM"
        ? "bg-li-yellow/15 text-li-yellow border-li-yellow/30"
        : level === "LOW"
          ? "bg-li-red/15 text-li-red border-li-red/30"
          : "bg-li-gray-900 text-li-text-muted border-li-border";
  // Strip the "CONFIDENCE:" prefix for the justification text.
  const justify = line.replace(/^confidence:\s*/i, "").replace(/^(HIGH|MEDIUM|LOW)\s*[—-]?\s*/i, "");
  return (
    <div className="mt-8 pt-4 border-t border-li-border flex items-start gap-3">
      <span className={`px-2.5 py-1 text-[10px] tracking-[0.2em] uppercase font-mono rounded border ${color}`}>
        Confidence · {level ?? "—"}
      </span>
      {justify && <p className="text-xs text-li-text-secondary leading-relaxed">{justify}</p>}
    </div>
  );
}

export function InrProse({ text }: { text: string }) {
  const { bluf, paragraphs, altView, confidenceLine } = parse(text);

  // Fallback: if the parser couldn't find any structure, just preserve
  // the raw text so we never hide content.
  if (!bluf && paragraphs.length === 0) {
    return (
      <pre className="whitespace-pre-wrap text-[15px] leading-relaxed text-li-text-primary font-sans bg-transparent p-0 border-0">
        {text}
      </pre>
    );
  }

  return (
    <article className="font-sans">
      {bluf && (
        <div className="border-l-4 border-li-green bg-li-green/5 px-5 py-4 my-2">
          <div className="text-[10px] tracking-[0.3em] text-li-green uppercase font-mono mb-1.5">
            Bottom Line Up Front
          </div>
          <p className="text-[16px] leading-relaxed text-li-text-primary">{renderInline(bluf)}</p>
        </div>
      )}

      <div className="mt-8 space-y-6">
        {paragraphs.map((p, i) => (
          <div key={i} className="flex gap-4">
            {p.n !== null && (
              <div className="flex-shrink-0 w-8 pt-1 text-[10px] font-mono text-li-text-muted tracking-widest">
                {String(p.n).padStart(2, "0")}.
              </div>
            )}
            <div className="flex-1 text-[15px] leading-relaxed text-li-text-primary">
              {renderInline(p.text)}
            </div>
          </div>
        ))}
      </div>

      {altView && (
        <aside className="mt-10 border-l-4 border-li-yellow bg-li-yellow/5 px-5 py-4">
          <div className="text-[10px] tracking-[0.3em] text-li-yellow uppercase font-mono mb-1.5">
            Alternative View
          </div>
          <div className="text-[14px] leading-relaxed text-li-text-secondary whitespace-pre-wrap">
            {renderInline(altView)}
          </div>
        </aside>
      )}

      {confidenceLine && <ConfidencePill line={confidenceLine} />}
    </article>
  );
}
