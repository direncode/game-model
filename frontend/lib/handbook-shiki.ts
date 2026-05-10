import type { Highlighter } from "shiki";
import oceanGrammar from "./ocean-syntax.json";

let highlighterPromise: Promise<Highlighter> | null = null;

export function getOceanHighlighter(): Promise<Highlighter> {
  if (highlighterPromise === null) {
    highlighterPromise = (async () => {
      const shiki = await import("shiki");
      // Shiki v1+ exposes `createHighlighter`. Fall back to `getHighlighter`
      // if a future version renames it again.
      const create =
        (shiki as unknown as { createHighlighter?: (...args: unknown[]) => Promise<Highlighter> })
          .createHighlighter ??
        (shiki as unknown as { getHighlighter?: (...args: unknown[]) => Promise<Highlighter> })
          .getHighlighter;
      if (!create) {
        throw new Error("shiki: neither createHighlighter nor getHighlighter is exported");
      }
      return await create({
        themes: ["github-light", "github-dark"],
        // `langs` accepts TextMate grammar objects.
        langs: [oceanGrammar],
      });
    })();
  }
  return highlighterPromise;
}

export async function highlightOcean(
  code: string,
  theme: "github-light" | "github-dark" = "github-light",
): Promise<string> {
  const highlighter = await getOceanHighlighter();
  return highlighter.codeToHtml(code, { lang: "ocean", theme });
}
