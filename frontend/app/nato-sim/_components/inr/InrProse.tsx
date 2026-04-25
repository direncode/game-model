"use client";

/**
 * Rich renderer for synthesized INR analytical prose.
 *
 * Reads the structured shape the synthesizer emits (BLUF, numbered
 * paragraphs, portion markers, citations, optional Alt View, optional
 * Confidence line) and renders it in cable-letterhead style.
 *
 * Restrained palette: a single accent (li-cyan) on links/citations,
 * mono for metadata, serif Instrument Serif for prose, paragraph
 * numbers as left-margin numerals. Falls back to whitespace-preserving
 * render if the input shape is unexpected.
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

/**
 * Strip common markdown formatting markers from LLM output. INR
 * products are plain prose; the synthesizer occasionally emits
 * **bold**, *italic*, `code`, # headings, or [link](url) — those are
 * removed before structural parsing so the rendered page reads as
 * clean cable-prose.
 *
 * Note: ``[bracketed citations]`` are NOT stripped because they
 * have no following ``(url)`` parens — only true markdown links match.
 * Portion markers ``(U)/(C)/(S)`` are also untouched (no markdown semantics).
 */
function stripMarkdown(text: string): string {
  if (!text) return text;
  return text
    // [link](url) → link  (must run BEFORE bracket-citation logic in parser)
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, "$1")
    // **bold** → bold
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    // __bold__ → bold
    .replace(/__([^_\n]+)__/g, "$1")
    // *italic* (not preceded/followed by another star) → italic
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1$2")
    // _italic_ (word-boundary friendly) → italic
    .replace(/(^|\s)_([^_\n]+)_(?=\s|[.,;:!?)]|$)/g, "$1$2")
    // `inline code` → code
    .replace(/`([^`\n]+)`/g, "$1")
    // ATX headings: leading #'s on their own
    .replace(/^#{1,6}\s+/gm, "")
    // Strikethrough ~~text~~ → text
    .replace(/~~([^~\n]+)~~/g, "$1")
    // Stray standalone ** or __ markers left behind
    .replace(/\*\*/g, "")
    .replace(/__/g, "");
}

function parse(text: string): ParsedFinding {
  if (!text || !text.trim()) {
    return { bluf: null, paragraphs: [], altView: null, confidenceLine: null };
  }
  const cleaned = stripMarkdown(text);
  const blocks = cleaned
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

    if (lower.startsWith("confidence:")) {
      confidenceLine = block;
      if (inAltView) {
        altView = altViewBuf.join("\n\n");
        inAltView = false;
      }
      continue;
    }

    if (lower.startsWith("alternative view")) {
      const restAfterHeader = block.replace(/^alternative view[:\s]*/i, "").trim();
      altViewBuf = restAfterHeader ? [restAfterHeader] : [];
      inAltView = true;
      continue;
    }

    if (inAltView) {
      altViewBuf.push(block);
      continue;
    }

    if (!bluf && lower.startsWith("bluf:")) {
      bluf = block.replace(/^bluf:\s*/i, "").trim();
      continue;
    }

    const m = block.match(PARA_RE);
    if (m) {
      paragraphs.push({
        n: parseInt(m[1], 10),
        text: block.replace(PARA_RE, "").trim(),
      });
    } else {
      paragraphs.push({ n: null, text: block });
    }
  }

  if (inAltView) altView = altViewBuf.join("\n\n");

  return { bluf, paragraphs, altView, confidenceLine };
}

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let cursor = 0;

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
      // Restrained: portion markers as inline small-caps, no pill background.
      out.push(
        <span
          key={key++}
          className="font-mono text-[10px] text-li-text-muted tracking-wider mr-0.5"
        >
          ({h.payload})
        </span>,
      );
    } else {
      // Citation chip: subtle, thin, single accent color, no border.
      out.push(
        <span
          key={key++}
          className="text-[11px] font-mono text-li-cyan/85 mx-0.5"
          title="source"
        >
          [{h.payload}]
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

function ConfidenceStrip({ line }: { line: string }) {
  const upper = line.toUpperCase();
  const level = upper.includes("HIGH")
    ? "HIGH"
    : upper.includes("MEDIUM") || upper.includes("MODERATE")
      ? "MEDIUM"
      : upper.includes("LOW")
        ? "LOW"
        : null;
  const justify = line
    .replace(/^confidence:\s*/i, "")
    .replace(/^(HIGH|MEDIUM|LOW)\s*[—-]?\s*/i, "");
  const color =
    level === "HIGH"
      ? "text-li-green"
      : level === "MEDIUM"
        ? "text-li-yellow"
        : level === "LOW"
          ? "text-li-red"
          : "text-li-text-muted";
  return (
    <div className="mt-10 pt-3 border-t border-li-border flex items-baseline gap-4 text-[12px]">
      <span
        className={`font-mono text-[10px] tracking-[0.3em] uppercase ${color}`}
      >
        Confidence · {level ?? "—"}
      </span>
      {justify && <p className="text-li-text-secondary">{justify}</p>}
    </div>
  );
}

export function InrProse({ text }: { text: string }) {
  const { bluf, paragraphs, altView, confidenceLine } = parse(text);

  if (!bluf && paragraphs.length === 0) {
    return (
      <pre className="whitespace-pre-wrap text-[13.5px] leading-[1.7] text-li-text-primary font-display bg-transparent p-0 border-0">
        {stripMarkdown(text)}
      </pre>
    );
  }

  return (
    <article className="font-display text-li-text-primary">
      {bluf && (
        <section className="my-2">
          <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-text-muted mb-1.5">
            Bottom Line Up Front
          </div>
          <p className="text-[16px] leading-[1.55] text-li-text-primary">
            {renderInline(bluf)}
          </p>
        </section>
      )}

      {paragraphs.length > 0 && (
        <section className="mt-8">
          <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-text-muted mb-3">
            Key Judgments
          </div>
          <div className="space-y-5">
            {paragraphs.map((p, i) => (
              <div key={i} className="flex gap-5">
                <div className="flex-shrink-0 w-7 pt-1.5 text-[11px] font-mono text-li-text-muted text-right">
                  {p.n !== null ? String(p.n).padStart(2, "0") : ""}
                </div>
                <p className="flex-1 text-[14px] leading-[1.7] text-li-text-primary">
                  {renderInline(p.text)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {altView && (
        <aside className="mt-10 border-l-2 border-li-yellow/60 pl-5 py-1">
          <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-yellow/80 mb-1.5">
            Alternative View
          </div>
          <div className="text-[13.5px] leading-[1.7] text-li-text-secondary whitespace-pre-wrap">
            {renderInline(altView)}
          </div>
        </aside>
      )}

      {confidenceLine && <ConfidenceStrip line={confidenceLine} />}
    </article>
  );
}
