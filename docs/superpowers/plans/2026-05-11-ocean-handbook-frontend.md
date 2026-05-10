# OCEAN Handbook — Frontend Renderer Plan (Plan B of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Stripe-docs-quality frontend renderer for the OCEAN Handbook at `frontend/app/handbook/` — sidebar, right-rail outline, syntax-highlighted code blocks with copy/run buttons, prev/next, Cmd-K fuzzy search.

**Architecture:** Static generation. At build time, `scripts/handbook/build.py --emit-content` (built in Plan A) emits `frontend/lib/handbook-content.generated.ts`. Next.js reads that module at build time and statically generates each chapter page. Runtime markdown parsing is avoided. Shiki provides the `.ocean` syntax highlighting from a JSON grammar file checked into the repo. The `Run` button on snippets POSTs to `/api/handbook/run`, implemented in Plan C — until Plan C lands, the button shows a tooltip explaining the runner is not yet wired up.

**Tech Stack:** Next.js (App Router), React Server Components for the static parts, `shiki` for syntax highlighting, `fuse.js` for client-side search, Tailwind for styling (assumed already in the frontend; if not, adopt the existing styling primitives the repo uses).

**Companion docs:**
- Design spec: `docs/superpowers/specs/2026-05-11-ocean-handbook-design.md` §4
- Plan A: `docs/superpowers/plans/2026-05-11-ocean-handbook-content.md`
- Plan C: `docs/superpowers/plans/2026-05-11-ocean-handbook-runner.md`

---

## File Structure

```
frontend/app/handbook/
  page.tsx                                              renders index chapter
  [chapter]/page.tsx                                    renders any other chapter
  layout.tsx                                            sidebar + content + right-rail
  not-found.tsx                                         404 for unknown slugs

frontend/components/handbook/
  HandbookSidebar.tsx                                   left nav (collapsible chapter list)
  OnThisPage.tsx                                        right-rail outline
  OceanCodeBlock.tsx                                    highlighted .ocean code + copy/run
  PrevNext.tsx                                          bottom-of-chapter navigation
  WiderSystemCallout.tsx                                styled callout box
  Exercise.tsx                                          numbered exercise with toggle
  HandbookSearch.tsx                                    Cmd-K fuzzy search

frontend/lib/
  handbook-content.generated.ts                         emitted by Plan A's build.py
  ocean-syntax.json                                     Shiki grammar
  handbook-shiki.ts                                     Shiki highlighter singleton
  handbook-types.ts                                     shared TS types
  handbook-runner-client.ts                             fetch wrapper for /api/handbook/run

frontend/tests/handbook/
  HandbookSidebar.test.tsx
  OnThisPage.test.tsx
  OceanCodeBlock.test.tsx
  PrevNext.test.tsx
  HandbookSearch.test.tsx
  page.test.tsx
```

---

## Task 0: Shared types and Shiki grammar

**Files:**
- Create: `frontend/lib/handbook-types.ts`
- Create: `frontend/lib/ocean-syntax.json`
- Create: `frontend/lib/handbook-shiki.ts`

- [ ] **Step 1: Define shared types**

Create `frontend/lib/handbook-types.ts`:

```ts
export type HandbookOutlineItem = {
  id: string;
  text: string;
  level: 2 | 3;
};

export type HandbookSnippet = {
  code: string;
  runnable: boolean;
  corpus: string | null;
  line: number;
};

export type HandbookExercise = {
  number: number;
  prompt: string;
};

export type HandbookChapter = {
  slug: string;
  number: number | null;
  title: string;
  promise: string;
  concepts: string[];
  outline: HandbookOutlineItem[];
  snippets: HandbookSnippet[];
  exercises: HandbookExercise[];
};
```

- [ ] **Step 2: Define the Shiki grammar for `.ocean`**

Create `frontend/lib/ocean-syntax.json` with TextMate-grammar JSON structure. The full grammar:

```json
{
  "name": "OCEAN",
  "scopeName": "source.ocean",
  "fileTypes": ["ocean"],
  "patterns": [
    { "include": "#comments" },
    { "include": "#keywords" },
    { "include": "#verbs" },
    { "include": "#types" },
    { "include": "#literals" },
    { "include": "#operators" }
  ],
  "repository": {
    "comments": {
      "match": "#.*$",
      "name": "comment.line.number-sign.ocean"
    },
    "keywords": {
      "match": "\\b(require|seed|let|in|as|on|from|to|into|using|with|by|of|do|end|sweep|compare|against|parallel|import|step|take|balanced|field|is|for|rounds|round|max|modules|module|energy|crystallize|every|nearest|records|record|dispersion|each|label|fine|anchored|dimensions|dimension|loop|recursive|tcd|tf-idf|tfidf|content|fingerprint|one-hot|numeric|mean|corpus|normal|text|define|return|if|then|else|elif|true|false|not|and|or)\\b",
      "name": "keyword.control.ocean"
    },
    "verbs": {
      "match": "\\b(load|embed|reduce|cluster|align|find|narrate|save)\\b",
      "name": "support.function.verb.ocean"
    },
    "types": {
      "match": "\\b(Records|Z|Modules|Aligned|Dispersion|Artifact|Pipeline|Number|String|Path|Bool|Any)\\b",
      "name": "support.type.ocean"
    },
    "literals": {
      "patterns": [
        { "match": "\\b\\d+(_\\d+)*\\.\\d+([eE][+-]?\\d+)?\\b", "name": "constant.numeric.float.ocean" },
        { "match": "\\b\\d+(_\\d+)*\\b", "name": "constant.numeric.integer.ocean" },
        { "match": "\\\"[^\\\"\\n]*\\\"|'[^'\\n]*'", "name": "string.quoted.ocean" },
        { "match": "\\$\\{[a-z_][a-z0-9_]*\\}", "name": "variable.parameter.interpolation.ocean" },
        { "match": "\\b(true|false)\\b", "name": "constant.language.boolean.ocean" }
      ]
    },
    "operators": {
      "match": "==|!=|<=|>=|<|>|\\+|-|\\*|/|=",
      "name": "keyword.operator.ocean"
    }
  }
}
```

- [ ] **Step 3: Create the Shiki highlighter singleton**

Create `frontend/lib/handbook-shiki.ts`:

```ts
import { getHighlighter, type Highlighter } from "shiki";
import oceanGrammar from "./ocean-syntax.json";

let highlighterPromise: Promise<Highlighter> | null = null;

export function getOceanHighlighter(): Promise<Highlighter> {
  if (highlighterPromise === null) {
    highlighterPromise = getHighlighter({
      themes: ["github-light", "github-dark"],
      langs: [oceanGrammar as Parameters<typeof getHighlighter>[0]["langs"][number]],
    });
  }
  return highlighterPromise;
}

export async function highlightOcean(
  code: string,
  theme: "github-light" | "github-dark" = "github-light"
): Promise<string> {
  const highlighter = await getOceanHighlighter();
  return highlighter.codeToHtml(code, { lang: "ocean", theme });
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/handbook-types.ts frontend/lib/ocean-syntax.json frontend/lib/handbook-shiki.ts
git commit -m "handbook(frontend): shared types and Shiki grammar for .ocean"
```

---

## Task 1: Build-time content emitter

**Files:**
- Modify: `frontend/package.json` (add prebuild script)
- Create: `scripts/handbook/test_emit_content.py` (test the emitter)

- [ ] **Step 1: Write the test for `emit_content`**

Create `scripts/handbook/tests/test_emit_content.py`:

```python
"""Tests for build.py --emit-content."""
from __future__ import annotations
import json
import subprocess
import sys
from pathlib import Path


def test_emit_content_writes_valid_ts(tmp_path, monkeypatch):
    # Use a minimal handbook with one chapter for testing.
    handbook = tmp_path / "docs" / "handbook"
    handbook.mkdir(parents=True)
    (handbook / "01-x.md").write_text(
        "---\nslug: 01-x\nnumber: 1\ntitle: \"X\"\n"
        "promise: \"learn\"\nstatus: draft\n---\n# Ch 1 — X\n> learn\n\n"
        "## Concepts in this chapter\n- a\n- b\n\n"
        "## A section\nbody\n\n"
        "## Wider system\nstuff\n\n## Exercises\n1. Do x.\n\n"
        "## What's next\nnext\n"
    )
    (handbook / "app-d-glossary.md").write_text(
        "---\nslug: app-d-glossary\nnumber: null\ntitle: \"App D\"\n"
        "promise: \"defs\"\nstatus: draft\n---\n# App D\n\n> defs\n"
    )
    (handbook / "app-f-exercise-solutions.md").write_text(
        "---\nslug: app-f-exercise-solutions\nnumber: null\n"
        "title: \"App F\"\npromise: \"sols\"\nstatus: draft\n---\n"
        "# App F\n\n> sols\n\n## 01-x — 1\nsolve.\n"
    )

    monkeypatch.chdir(tmp_path)
    output = tmp_path / "handbook-content.generated.ts"
    repo_root = Path(__file__).resolve().parents[3]
    result = subprocess.run(
        [sys.executable, "-m", "scripts.handbook.build", "--emit-content", str(output)],
        cwd=repo_root,
        env={**__import__("os").environ, "PYTHONPATH": str(repo_root)},
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    assert output.exists()
    text = output.read_text()
    assert "export const handbookChapters" in text
    # Verify the embedded JSON is valid by finding it between `= ` and ` as const;`.
    json_start = text.find("= ") + 2
    json_end = text.rfind(" as const;")
    parsed = json.loads(text[json_start:json_end])
    slugs = [c["slug"] for c in parsed]
    assert "01-x" in slugs
```

- [ ] **Step 2: Run the test, verifying it passes once Plan A Task 0 is done**

Run: `python -m pytest scripts/handbook/tests/test_emit_content.py -v`

If Plan A Task 0 is done, this passes. If not, complete Plan A Task 0 first.

- [ ] **Step 3: Wire the emitter into the frontend build**

Modify `frontend/package.json` — add `"prebuild"` script that runs the emitter before Next.js builds:

```json
{
  "scripts": {
    "prebuild": "cd .. && python -m scripts.handbook.build --emit-content frontend/lib/handbook-content.generated.ts",
    "build": "next build",
    "dev": "concurrently \"npm run watch:handbook\" \"next dev\"",
    "watch:handbook": "cd .. && find docs/handbook -name '*.md' | entr -d python -m scripts.handbook.build --emit-content frontend/lib/handbook-content.generated.ts"
  }
}
```

(If `concurrently` and `entr` are not installed, install `concurrently` via npm and document that `entr` is optional for hot reload of handbook content. The emitter can also be re-run manually.)

- [ ] **Step 4: Add the generated file to .gitignore**

Edit `.gitignore` and add:

```
frontend/lib/handbook-content.generated.ts
```

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json .gitignore scripts/handbook/tests/test_emit_content.py
git commit -m "handbook(frontend): wire content emitter into Next.js prebuild"
```

---

## Task 2: `OceanCodeBlock` component (with copy + run)

**Files:**
- Create: `frontend/components/handbook/OceanCodeBlock.tsx`
- Create: `frontend/tests/handbook/OceanCodeBlock.test.tsx`
- Create: `frontend/lib/handbook-runner-client.ts`

- [ ] **Step 1: Write the runner client**

Create `frontend/lib/handbook-runner-client.ts`:

```ts
export type RunStep = {
  verb: string;
  duration_ms: number;
  summary: string;
};

export type RunSuccess = {
  ok: true;
  compile_ms: number;
  run_ms: number;
  steps: RunStep[];
  artifact_preview: string;
};

export type RunDiagnostic = {
  line: number;
  col: number;
  token: string;
  message: string;
  hint: string;
};

export type RunError = {
  ok: false;
  category: "type" | "syntax" | "name" | "runtime" | "import";
  diagnostic: RunDiagnostic;
};

export type RunResult = RunSuccess | RunError;

export type RunUnavailable = {
  ok: false;
  category: "unavailable";
  message: string;
};

export async function runSnippet(
  source: string,
  corpus: string,
  signal?: AbortSignal
): Promise<RunResult | RunUnavailable> {
  try {
    const response = await fetch("/api/handbook/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, corpus }),
      signal,
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After") ?? "60";
      return {
        ok: false,
        category: "unavailable",
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      };
    }
    if (response.status === 503) {
      return {
        ok: false,
        category: "unavailable",
        message: "Runner unavailable. Copy the snippet and run in the REPL.",
      };
    }
    return (await response.json()) as RunResult;
  } catch (e) {
    return {
      ok: false,
      category: "unavailable",
      message: `Network error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
```

- [ ] **Step 2: Write the failing test for `OceanCodeBlock`**

Create `frontend/tests/handbook/OceanCodeBlock.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OceanCodeBlock } from "@/components/handbook/OceanCodeBlock";

const fetchMock = vi.fn();
beforeEach(() => {
  global.fetch = fetchMock;
  fetchMock.mockReset();
});

describe("OceanCodeBlock", () => {
  it("renders highlighted code", async () => {
    render(<OceanCodeBlock code="load x.ndjson" runnable={false} corpus={null} />);
    await waitFor(() => expect(screen.getByText(/load/)).toBeDefined());
  });

  it("shows copy button always; run button only when runnable", () => {
    const { rerender } = render(
      <OceanCodeBlock code="load x.ndjson" runnable={false} corpus={null} />
    );
    expect(screen.getByRole("button", { name: /copy/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /run/i })).toBeNull();

    rerender(
      <OceanCodeBlock code="load x.ndjson" runnable={true} corpus="toy_tna_50" />
    );
    expect(screen.getByRole("button", { name: /run/i })).toBeDefined();
  });

  it("clicking run calls /api/handbook/run with source and corpus", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        compile_ms: 10,
        run_ms: 100,
        steps: [{ verb: "load", duration_ms: 42, summary: "50 records" }],
        artifact_preview: "{...}",
      }),
    });

    render(
      <OceanCodeBlock
        code="load x.ndjson"
        runnable={true}
        corpus="toy_tna_50"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /run/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/handbook/run",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ source: "load x.ndjson", corpus: "toy_tna_50" }),
        })
      );
    });

    await waitFor(() => expect(screen.getByText(/50 records/)).toBeDefined());
  });

  it("shows diagnostic on type error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        ok: false,
        category: "type",
        diagnostic: { line: 2, col: 1, token: "cluster", message: "cluster expects Z, got Records", hint: "pipe through embed first" },
      }),
    });

    render(<OceanCodeBlock code="..." runnable={true} corpus="toy_tna_50" />);
    fireEvent.click(screen.getByRole("button", { name: /run/i }));
    await waitFor(() => expect(screen.getByText(/cluster expects Z/)).toBeDefined());
    expect(screen.getByText(/pipe through embed first/)).toBeDefined();
  });
});
```

- [ ] **Step 3: Run the test (failing)**

Run: `cd frontend && npx vitest tests/handbook/OceanCodeBlock.test.tsx`

Expected: FAIL — component does not exist.

- [ ] **Step 4: Implement `OceanCodeBlock`**

Create `frontend/components/handbook/OceanCodeBlock.tsx`:

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { highlightOcean } from "@/lib/handbook-shiki";
import { runSnippet, type RunResult, type RunUnavailable } from "@/lib/handbook-runner-client";

type Props = {
  code: string;
  runnable: boolean;
  corpus: string | null;
};

export function OceanCodeBlock({ code, runnable, corpus }: Props) {
  const [html, setHtml] = useState<string>("");
  const [result, setResult] = useState<RunResult | RunUnavailable | null>(null);
  const [isRunning, startTransition] = useTransition();

  useEffect(() => {
    let canceled = false;
    highlightOcean(code).then((h) => {
      if (!canceled) setHtml(h);
    });
    return () => {
      canceled = true;
    };
  }, [code]);

  function onCopy() {
    void navigator.clipboard.writeText(code);
  }

  function onRun() {
    if (!corpus) return;
    startTransition(async () => {
      const r = await runSnippet(code, corpus);
      setResult(r);
    });
  }

  return (
    <div className="handbook-code-block rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between px-3 py-1 text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
        <span>ocean{corpus ? `  corpus=${corpus}` : ""}</span>
        <div className="flex gap-2">
          <button onClick={onCopy} className="hover:text-zinc-900 dark:hover:text-zinc-100">
            Copy
          </button>
          {runnable && (
            <button
              onClick={onRun}
              disabled={isRunning}
              className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
            >
              {isRunning ? "Running…" : "Run ▶"}
            </button>
          )}
        </div>
      </div>
      <div className="p-3 text-sm overflow-x-auto" dangerouslySetInnerHTML={{ __html: html || `<pre>${escapeHtml(code)}</pre>` }} />
      {result !== null && <RunResultPanel result={result} />}
    </div>
  );
}

function RunResultPanel({ result }: { result: RunResult | RunUnavailable }) {
  if (result.category === "unavailable") {
    return (
      <div className="border-t px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
        {result.message}
      </div>
    );
  }
  if (result.ok === false) {
    return (
      <div className="border-t px-3 py-2 text-xs text-rose-700 dark:text-rose-400 font-mono">
        line {result.diagnostic.line}, col {result.diagnostic.col}: {result.category} error
        <br />
        {result.diagnostic.message}
        <br />
        <span className="text-zinc-500">hint: {result.diagnostic.hint}</span>
      </div>
    );
  }
  return (
    <div className="border-t px-3 py-2 text-xs font-mono">
      {result.steps.map((s, i) => (
        <div key={i}>
          [{i + 1}/{result.steps.length}] {s.verb} — {s.duration_ms}ms · {s.summary}
        </div>
      ))}
      <div className="mt-2 text-zinc-500">artifact:</div>
      <pre className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{result.artifact_preview}</pre>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
```

- [ ] **Step 5: Run the test (passing)**

Run: `cd frontend && npx vitest tests/handbook/OceanCodeBlock.test.tsx`

Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/components/handbook/OceanCodeBlock.tsx frontend/lib/handbook-runner-client.ts frontend/tests/handbook/OceanCodeBlock.test.tsx
git commit -m "handbook(frontend): OceanCodeBlock with copy and sandboxed-run"
```

---

## Task 3: `HandbookSidebar` component

**Files:**
- Create: `frontend/components/handbook/HandbookSidebar.tsx`
- Create: `frontend/tests/handbook/HandbookSidebar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/handbook/HandbookSidebar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { HandbookSidebar } from "@/components/handbook/HandbookSidebar";

const chapters = [
  { slug: "index", number: null, title: "The OCEAN Handbook" },
  { slug: "00-preface", number: 0, title: "Preface" },
  { slug: "01-what-ocean-is", number: 1, title: "What OCEAN Is" },
  { slug: "app-a-grammar", number: null, title: "Appendix A — Grammar" },
] as const;

describe("HandbookSidebar", () => {
  it("renders every chapter as a link", () => {
    render(<HandbookSidebar chapters={chapters} currentSlug="01-what-ocean-is" />);
    expect(screen.getByText("Preface")).toBeDefined();
    expect(screen.getByText("What OCEAN Is")).toBeDefined();
    expect(screen.getByText("Appendix A — Grammar")).toBeDefined();
  });

  it("highlights the current chapter", () => {
    render(<HandbookSidebar chapters={chapters} currentSlug="01-what-ocean-is" />);
    const current = screen.getByText("What OCEAN Is");
    expect(current.className).toMatch(/font-semibold|text-emerald|active/);
  });

  it("separates numbered chapters from appendices", () => {
    render(<HandbookSidebar chapters={chapters} currentSlug="index" />);
    expect(screen.getByText("Chapters")).toBeDefined();
    expect(screen.getByText("Appendices")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test (fail)**

Run: `cd frontend && npx vitest tests/handbook/HandbookSidebar.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implement `HandbookSidebar`**

Create `frontend/components/handbook/HandbookSidebar.tsx`:

```tsx
import Link from "next/link";
import type { HandbookChapter } from "@/lib/handbook-types";

type SidebarChapter = Pick<HandbookChapter, "slug" | "number" | "title">;

type Props = {
  chapters: readonly SidebarChapter[];
  currentSlug: string;
};

export function HandbookSidebar({ chapters, currentSlug }: Props) {
  const preface = chapters.find((c) => c.slug === "00-preface");
  const numbered = chapters
    .filter((c) => typeof c.number === "number" && c.number >= 1)
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  const appendices = chapters.filter((c) => c.slug.startsWith("app-"));

  return (
    <nav className="handbook-sidebar w-64 shrink-0 border-r border-zinc-200 dark:border-zinc-800 px-4 py-6 text-sm">
      <Link
        href="/handbook"
        className={linkClass(currentSlug === "index")}
      >
        The OCEAN Handbook
      </Link>

      {preface && (
        <div className="mt-4">
          <Link
            href={`/handbook/${preface.slug}`}
            className={linkClass(currentSlug === preface.slug)}
          >
            {preface.title}
          </Link>
        </div>
      )}

      <div className="mt-6">
        <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Chapters</div>
        {numbered.map((c) => (
          <Link
            key={c.slug}
            href={`/handbook/${c.slug}`}
            className={linkClass(currentSlug === c.slug)}
          >
            <span className="text-zinc-500 mr-2">{c.number}</span>
            {c.title}
          </Link>
        ))}
      </div>

      <div className="mt-6">
        <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Appendices</div>
        {appendices.map((c) => (
          <Link
            key={c.slug}
            href={`/handbook/${c.slug}`}
            className={linkClass(currentSlug === c.slug)}
          >
            {c.title}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function linkClass(active: boolean): string {
  const base = "block py-1 hover:text-zinc-900 dark:hover:text-zinc-100";
  return active
    ? `${base} font-semibold text-emerald-600 dark:text-emerald-400`
    : `${base} text-zinc-700 dark:text-zinc-300`;
}
```

- [ ] **Step 4: Run test (pass)**

Run: `cd frontend && npx vitest tests/handbook/HandbookSidebar.test.tsx`

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/handbook/HandbookSidebar.tsx frontend/tests/handbook/HandbookSidebar.test.tsx
git commit -m "handbook(frontend): sidebar with chapter + appendix sections"
```

---

## Task 4: `OnThisPage` (right-rail outline)

**Files:**
- Create: `frontend/components/handbook/OnThisPage.tsx`
- Create: `frontend/tests/handbook/OnThisPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/handbook/OnThisPage.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { OnThisPage } from "@/components/handbook/OnThisPage";

const outline = [
  { id: "a-first-idea", text: "A first idea", level: 2 as const },
  { id: "details", text: "Details", level: 3 as const },
  { id: "wider-system", text: "Wider system", level: 2 as const },
];

describe("OnThisPage", () => {
  it("renders every outline item as a link to its anchor", () => {
    render(<OnThisPage outline={outline} />);
    const links = screen.getAllByRole("link");
    expect(links.find((l) => l.getAttribute("href") === "#a-first-idea")).toBeDefined();
    expect(links.find((l) => l.getAttribute("href") === "#wider-system")).toBeDefined();
  });

  it("indents H3 items relative to H2", () => {
    render(<OnThisPage outline={outline} />);
    const h3 = screen.getByText("Details");
    expect(h3.parentElement?.className).toMatch(/ml-|pl-/);
  });
});
```

- [ ] **Step 2: Run test (fail)**

Run: `cd frontend && npx vitest tests/handbook/OnThisPage.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implement `OnThisPage`**

Create `frontend/components/handbook/OnThisPage.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import type { HandbookOutlineItem } from "@/lib/handbook-types";

type Props = { outline: HandbookOutlineItem[] };

export function OnThisPage({ outline }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActiveId(e.target.id);
            return;
          }
        }
      },
      { rootMargin: "-100px 0px -66% 0px" }
    );
    for (const item of outline) {
      const el = document.getElementById(item.id);
      if (el !== null) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [outline]);

  if (outline.length === 0) return null;

  return (
    <aside className="handbook-on-this-page hidden lg:block w-56 shrink-0 pl-6 py-6 text-sm">
      <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">On this page</div>
      <ul className="space-y-1">
        {outline.map((item) => (
          <li key={item.id} className={item.level === 3 ? "pl-3" : ""}>
            <a
              href={`#${item.id}`}
              className={
                activeId === item.id
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
              }
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
```

- [ ] **Step 4: Run test (pass)**

Run: `cd frontend && npx vitest tests/handbook/OnThisPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/handbook/OnThisPage.tsx frontend/tests/handbook/OnThisPage.test.tsx
git commit -m "handbook(frontend): right-rail outline with IntersectionObserver"
```

---

## Task 5: `WiderSystemCallout` and `Exercise` and `PrevNext` components

**Files:**
- Create: `frontend/components/handbook/WiderSystemCallout.tsx`
- Create: `frontend/components/handbook/Exercise.tsx`
- Create: `frontend/components/handbook/PrevNext.tsx`
- Create: `frontend/tests/handbook/PrevNext.test.tsx`

- [ ] **Step 1: Implement `WiderSystemCallout`**

Create `frontend/components/handbook/WiderSystemCallout.tsx`:

```tsx
import type { ReactNode } from "react";

export function WiderSystemCallout({ children }: { children: ReactNode }) {
  return (
    <aside className="handbook-wider-system my-8 rounded-lg border-l-4 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 px-5 py-4">
      <div className="text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2">
        Wider system
      </div>
      <div className="prose-sm dark:prose-invert">{children}</div>
    </aside>
  );
}
```

- [ ] **Step 2: Implement `Exercise`**

Create `frontend/components/handbook/Exercise.tsx`:

```tsx
"use client";
import { useState, type ReactNode } from "react";

type Props = {
  number: number;
  children: ReactNode;
  solution?: ReactNode;
};

export function Exercise({ number, children, solution }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="handbook-exercise my-4 rounded-md border border-zinc-200 dark:border-zinc-800 px-4 py-3">
      <div className="flex gap-3">
        <span className="font-semibold text-zinc-500">{number}.</span>
        <div className="flex-1">{children}</div>
      </div>
      {solution && (
        <div className="mt-2">
          <button
            onClick={() => setOpen(!open)}
            className="text-xs text-emerald-600 hover:text-emerald-700"
          >
            {open ? "Hide solution" : "Show solution"}
          </button>
          {open && (
            <div className="mt-2 pl-6 border-l-2 border-emerald-300">{solution}</div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write the failing test for `PrevNext`**

Create `frontend/tests/handbook/PrevNext.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PrevNext } from "@/components/handbook/PrevNext";

describe("PrevNext", () => {
  it("renders both links when both prev and next are present", () => {
    render(
      <PrevNext
        prev={{ slug: "01-x", title: "X" }}
        next={{ slug: "03-z", title: "Z" }}
      />
    );
    const prevLink = screen.getByText("X").closest("a");
    const nextLink = screen.getByText("Z").closest("a");
    expect(prevLink?.getAttribute("href")).toBe("/handbook/01-x");
    expect(nextLink?.getAttribute("href")).toBe("/handbook/03-z");
  });

  it("renders only next when prev is null", () => {
    render(<PrevNext prev={null} next={{ slug: "01-x", title: "X" }} />);
    expect(screen.queryByText(/previous/i)).toBeNull();
    expect(screen.getByText("X")).toBeDefined();
  });

  it("renders only prev when next is null", () => {
    render(<PrevNext prev={{ slug: "14-z", title: "Z" }} next={null} />);
    expect(screen.getByText("Z")).toBeDefined();
    expect(screen.queryByText(/next/i)).toBeNull();
  });
});
```

- [ ] **Step 4: Run test (fail)**

Run: `cd frontend && npx vitest tests/handbook/PrevNext.test.tsx`

Expected: FAIL.

- [ ] **Step 5: Implement `PrevNext`**

Create `frontend/components/handbook/PrevNext.tsx`:

```tsx
import Link from "next/link";

type Link = { slug: string; title: string };

type Props = {
  prev: Link | null;
  next: Link | null;
};

export function PrevNext({ prev, next }: Props) {
  return (
    <nav className="handbook-prev-next mt-12 flex justify-between border-t border-zinc-200 dark:border-zinc-800 pt-6">
      <div>
        {prev !== null && (
          <Link
            href={`/handbook/${prev.slug}`}
            className="block text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <div className="text-xs uppercase tracking-wider">Previous</div>
            <div className="mt-1">{prev.title}</div>
          </Link>
        )}
      </div>
      <div className="text-right">
        {next !== null && (
          <Link
            href={`/handbook/${next.slug}`}
            className="block text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <div className="text-xs uppercase tracking-wider">Next</div>
            <div className="mt-1">{next.title}</div>
          </Link>
        )}
      </div>
    </nav>
  );
}
```

- [ ] **Step 6: Run test (pass)**

Run: `cd frontend && npx vitest tests/handbook/PrevNext.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/components/handbook/WiderSystemCallout.tsx frontend/components/handbook/Exercise.tsx frontend/components/handbook/PrevNext.tsx frontend/tests/handbook/PrevNext.test.tsx
git commit -m "handbook(frontend): WiderSystemCallout, Exercise, PrevNext"
```

---

## Task 6: `HandbookSearch` (Cmd-K fuzzy search)

**Files:**
- Create: `frontend/components/handbook/HandbookSearch.tsx`
- Create: `frontend/tests/handbook/HandbookSearch.test.tsx`
- Modify: `frontend/package.json` to add `fuse.js`

- [ ] **Step 1: Install fuse.js**

Run: `cd frontend && npm install fuse.js`

- [ ] **Step 2: Write the failing test**

Create `frontend/tests/handbook/HandbookSearch.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { HandbookSearch } from "@/components/handbook/HandbookSearch";

const dataset = [
  { slug: "01-what-ocean-is", title: "What OCEAN Is", outline: [{ id: "x", text: "Determinism" }] },
  { slug: "02-your-first-pipeline", title: "Your First Pipeline", outline: [{ id: "y", text: "Toy corpora" }] },
];

describe("HandbookSearch", () => {
  it("opens on Cmd-K", async () => {
    render(<HandbookSearch dataset={dataset} />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    await waitFor(() => expect(screen.getByPlaceholderText(/search/i)).toBeDefined());
  });

  it("filters by query", async () => {
    render(<HandbookSearch dataset={dataset} />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: "Determinism" } });
    await waitFor(() => {
      expect(screen.getByText(/Determinism/)).toBeDefined();
    });
  });
});
```

- [ ] **Step 3: Run test (fail)**

Run: `cd frontend && npx vitest tests/handbook/HandbookSearch.test.tsx`

Expected: FAIL.

- [ ] **Step 4: Implement `HandbookSearch`**

Create `frontend/components/handbook/HandbookSearch.tsx`:

```tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import Link from "next/link";

type Entry = {
  slug: string;
  title: string;
  outline: { id: string; text: string }[];
};

type FlatEntry = {
  slug: string;
  title: string;
  heading: string | null;
  anchor: string | null;
};

type Props = { dataset: Entry[] };

export function HandbookSearch({ dataset }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const flatDataset = useMemo<FlatEntry[]>(() => {
    const out: FlatEntry[] = [];
    for (const entry of dataset) {
      out.push({ slug: entry.slug, title: entry.title, heading: null, anchor: null });
      for (const h of entry.outline) {
        out.push({ slug: entry.slug, title: entry.title, heading: h.text, anchor: h.id });
      }
    }
    return out;
  }, [dataset]);

  const fuse = useMemo(
    () => new Fuse(flatDataset, { keys: ["title", "heading"], threshold: 0.4 }),
    [flatDataset]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isModK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isModK) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  const results = query.trim() ? fuse.search(query).slice(0, 20) : [];

  return (
    <div className="handbook-search fixed inset-0 z-50 flex items-start justify-center pt-32 bg-black/30">
      <div className="bg-white dark:bg-zinc-950 w-[600px] max-w-[90vw] rounded-lg shadow-2xl border border-zinc-200 dark:border-zinc-800">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the handbook…"
          className="w-full px-4 py-3 bg-transparent text-base outline-none border-b border-zinc-200 dark:border-zinc-800"
        />
        <ul className="max-h-96 overflow-y-auto">
          {results.map((r, i) => (
            <li key={i}>
              <Link
                href={`/handbook/${r.item.slug}${r.item.anchor ? `#${r.item.anchor}` : ""}`}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <div className="text-sm font-medium">{r.item.title}</div>
                {r.item.heading && (
                  <div className="text-xs text-zinc-500 mt-0.5">› {r.item.heading}</div>
                )}
              </Link>
            </li>
          ))}
          {query.trim() && results.length === 0 && (
            <li className="px-4 py-3 text-sm text-zinc-500">No matches</li>
          )}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run test (pass)**

Run: `cd frontend && npx vitest tests/handbook/HandbookSearch.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/handbook/HandbookSearch.tsx frontend/tests/handbook/HandbookSearch.test.tsx frontend/package.json frontend/package-lock.json
git commit -m "handbook(frontend): Cmd-K fuzzy search over chapter titles and headings"
```

---

## Task 7: Layout and chapter pages

**Files:**
- Create: `frontend/app/handbook/layout.tsx`
- Create: `frontend/app/handbook/page.tsx`
- Create: `frontend/app/handbook/[chapter]/page.tsx`
- Create: `frontend/app/handbook/not-found.tsx`
- Create: `frontend/tests/handbook/page.test.tsx`

- [ ] **Step 1: Write the failing test for the chapter page**

Create `frontend/tests/handbook/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ChapterPage, { generateStaticParams } from "@/app/handbook/[chapter]/page";

describe("handbook/[chapter]/page", () => {
  it("generateStaticParams returns one entry per non-index chapter", async () => {
    const params = await generateStaticParams();
    expect(params.length).toBeGreaterThan(0);
    for (const p of params) {
      expect(p.chapter).toBeDefined();
      expect(p.chapter).not.toBe("index");
    }
  });

  it("renders the chapter title", async () => {
    const params = await generateStaticParams();
    const someParam = params[0];
    const PageComp = await ChapterPage({ params: someParam });
    render(PageComp);
    expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test (fail)**

Run: `cd frontend && npx vitest tests/handbook/page.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implement the layout**

Create `frontend/app/handbook/layout.tsx`:

```tsx
import { handbookChapters } from "@/lib/handbook-content.generated";
import { HandbookSidebar } from "@/components/handbook/HandbookSidebar";
import { HandbookSearch } from "@/components/handbook/HandbookSearch";

export default function HandbookLayout({ children }: { children: React.ReactNode }) {
  const searchDataset = handbookChapters.map((c) => ({
    slug: c.slug,
    title: c.title,
    outline: c.outline,
  }));

  return (
    <div className="handbook-shell flex min-h-screen mx-auto max-w-[1400px]">
      <HandbookSidebar chapters={handbookChapters} currentSlug="" />
      <main className="flex-1 px-8 py-8 max-w-[760px]">{children}</main>
      <HandbookSearch dataset={searchDataset} />
    </div>
  );
}
```

- [ ] **Step 4: Implement the index page (TOC)**

Create `frontend/app/handbook/page.tsx`:

```tsx
import { handbookChapters } from "@/lib/handbook-content.generated";
import Link from "next/link";

export default function HandbookIndexPage() {
  const index = handbookChapters.find((c) => c.slug === "index");
  const numbered = handbookChapters.filter((c) => typeof c.number === "number");
  const appendices = handbookChapters.filter((c) => c.slug.startsWith("app-"));

  return (
    <article className="prose dark:prose-invert">
      <h1>{index?.title ?? "The OCEAN Handbook"}</h1>
      {index?.promise && <blockquote>{index.promise}</blockquote>}

      <h2>Chapters</h2>
      <ol>
        {numbered.map((c) => (
          <li key={c.slug}>
            <Link href={`/handbook/${c.slug}`}>{c.title}</Link>
          </li>
        ))}
      </ol>

      <h2>Appendices</h2>
      <ul>
        {appendices.map((c) => (
          <li key={c.slug}>
            <Link href={`/handbook/${c.slug}`}>{c.title}</Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
```

- [ ] **Step 5: Implement the chapter page**

Create `frontend/app/handbook/[chapter]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { handbookChapters } from "@/lib/handbook-content.generated";
import { OceanCodeBlock } from "@/components/handbook/OceanCodeBlock";
import { OnThisPage } from "@/components/handbook/OnThisPage";
import { PrevNext } from "@/components/handbook/PrevNext";
import { WiderSystemCallout } from "@/components/handbook/WiderSystemCallout";
import { Exercise } from "@/components/handbook/Exercise";

type Params = { params: { chapter: string } };

export function generateStaticParams() {
  return handbookChapters
    .filter((c) => c.slug !== "index")
    .map((c) => ({ chapter: c.slug }));
}

export default function ChapterPage({ params }: Params) {
  const chapter = handbookChapters.find((c) => c.slug === params.chapter);
  if (chapter === undefined) notFound();

  const numbered = handbookChapters
    .filter((c) => typeof c.number === "number")
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));

  const idx = numbered.findIndex((c) => c.slug === chapter.slug);
  const prev = idx > 0 ? numbered[idx - 1] : null;
  const next = idx >= 0 && idx < numbered.length - 1 ? numbered[idx + 1] : null;

  return (
    <div className="flex">
      <article className="prose dark:prose-invert flex-1">
        <h1>{chapter.title}</h1>
        <blockquote>{chapter.promise}</blockquote>

        {chapter.concepts.length > 0 && (
          <>
            <h2 id="concepts-in-this-chapter">Concepts in this chapter</h2>
            <ul>
              {chapter.concepts.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </>
        )}

        {/* TODO: render outline body sections via MDX. For now, render snippets and exercises in order. */}
        {chapter.snippets.map((s, i) => (
          <OceanCodeBlock key={i} code={s.code} runnable={s.runnable} corpus={s.corpus} />
        ))}

        {chapter.exercises.length > 0 && (
          <>
            <h2 id="exercises">Exercises</h2>
            {chapter.exercises.map((e) => (
              <Exercise key={e.number} number={e.number}>
                {e.prompt}
              </Exercise>
            ))}
          </>
        )}

        <PrevNext
          prev={prev ? { slug: prev.slug, title: prev.title } : null}
          next={next ? { slug: next.slug, title: next.title } : null}
        />
      </article>

      <OnThisPage outline={chapter.outline} />
    </div>
  );
}
```

Note: the `// TODO` above is intentional. The full MDX rendering of body sections, `Wider system`, and inline exercises must be wired in Task 8 below. This task lands the route, sidebar, and chapter shell. Tasks 8 fills in the MDX path.

- [ ] **Step 6: Add `not-found.tsx`**

Create `frontend/app/handbook/not-found.tsx`:

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="px-8 py-16">
      <h1 className="text-2xl">Chapter not found</h1>
      <p className="mt-4 text-zinc-500">
        That chapter does not exist. <Link href="/handbook" className="underline">Back to the index.</Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 7: Run the page test (pass)**

Run: `cd frontend && npx vitest tests/handbook/page.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/app/handbook frontend/tests/handbook/page.test.tsx
git commit -m "handbook(frontend): layout, index, chapter route, not-found"
```

---

## Task 8: Wire MDX rendering for chapter bodies

**Files:**
- Modify: `scripts/handbook/build.py` (extend `emit_content` to include compiled MDX of body sections)
- Modify: `frontend/app/handbook/[chapter]/page.tsx` (render MDX body)
- Add MDX runtime to the frontend

- [ ] **Step 1: Add MDX runtime**

Run: `cd frontend && npm install @next/mdx @mdx-js/loader @mdx-js/react`

- [ ] **Step 2: Modify `emit_content` to include body MDX**

In `scripts/handbook/build.py`, modify the `emit_content` function so each chapter in the generated TS module includes a `bodyMdx` field containing the markdown of every section between `Concepts in this chapter` (exclusive) and `Wider system` (exclusive), plus a `widerSystemMdx` field with the `Wider system` body.

Replace the chapter dict in `emit_content` with:

```python
        bodies = []
        wider_system = ""
        for s in parsed.sections:
            if s.title in {"Concepts in this chapter", "Exercises", "What's next"}:
                continue
            if s.title == "Wider system":
                wider_system = s.body
                continue
            bodies.append(f"## {s.title}\n\n{s.body}")
        chapters.append({
            "slug": parsed.frontmatter.get("slug"),
            "number": parsed.frontmatter.get("number"),
            "title": parsed.frontmatter.get("title"),
            "promise": parsed.promise,
            "concepts": [
                line.lstrip("- ").strip()
                for s in parsed.sections
                if s.title == "Concepts in this chapter"
                for line in s.body.splitlines()
                if line.strip().startswith("-")
            ],
            "outline": [
                {"id": _slugify(s.title), "text": s.title, "level": 2}
                for s in parsed.sections
            ],
            "snippets": [
                {
                    "code": sn.code,
                    "runnable": sn.runnable,
                    "corpus": sn.corpus,
                    "line": sn.line,
                }
                for sn in parsed.snippets
            ],
            "exercises": [
                {"number": ex.number, "prompt": ex.prompt}
                for ex in parsed.exercises
            ],
            "bodyMarkdown": "\n\n".join(bodies),
            "widerSystemMarkdown": wider_system,
        })
```

Add the `_slugify` helper to `build.py`:

```python
def _slugify(s: str) -> str:
    import re
    return re.sub(r"[^a-z0-9-]+", "-", s.lower()).strip("-")
```

- [ ] **Step 3: Update `HandbookChapter` type to include the markdown bodies**

In `frontend/lib/handbook-types.ts`, add fields:

```ts
export type HandbookChapter = {
  // ... existing fields
  bodyMarkdown: string;
  widerSystemMarkdown: string;
};
```

- [ ] **Step 4: Render the body markdown in the chapter page**

Install `react-markdown` and `remark-gfm`:

```bash
cd frontend && npm install react-markdown remark-gfm
```

Modify `frontend/app/handbook/[chapter]/page.tsx`'s body section to render markdown:

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// In the JSX, replace the TODO comment with:
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  components={{
    code: ({ className, children, ...props }) => {
      const match = /language-ocean(?:\s+run(?:\s+corpus=(\S+))?|\s+static)?/.exec(className ?? "");
      if (match) {
        const info = className ?? "";
        const runnable = /\brun\b/.test(info);
        const corpus = match[1] ?? null;
        return (
          <OceanCodeBlock
            code={String(children).replace(/\n$/, "")}
            runnable={runnable}
            corpus={corpus}
          />
        );
      }
      return <code className={className} {...props}>{children}</code>;
    },
  }}
>
  {chapter.bodyMarkdown}
</ReactMarkdown>

{chapter.widerSystemMarkdown && (
  <WiderSystemCallout>
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{chapter.widerSystemMarkdown}</ReactMarkdown>
  </WiderSystemCallout>
)}
```

- [ ] **Step 5: Re-run the prebuild and verify a chapter renders**

```bash
cd .. && python -m scripts.handbook.build --emit-content frontend/lib/handbook-content.generated.ts
cd frontend && npm run dev
```

Open `http://localhost:3000/handbook/01-what-ocean-is` (assuming Plan A has authored that chapter) and verify the page renders with sidebar, body, code blocks, and right-rail.

- [ ] **Step 6: Commit**

```bash
git add scripts/handbook/build.py frontend/lib/handbook-types.ts frontend/app/handbook/[chapter]/page.tsx frontend/package.json frontend/package-lock.json
git commit -m "handbook(frontend): render chapter bodies as markdown with OceanCodeBlock"
```

---

## Task 9: Theming and final polish

**Files:**
- Modify: `frontend/app/handbook/layout.tsx`
- Add: `frontend/app/handbook/handbook.css`

- [ ] **Step 1: Add handbook-specific CSS**

Create `frontend/app/handbook/handbook.css`:

```css
.handbook-shell .prose {
  max-width: none;
}

.handbook-shell .prose h1 {
  font-size: 2.25rem;
  margin-bottom: 0.5rem;
}

.handbook-shell .prose h2 {
  font-size: 1.5rem;
  margin-top: 2.5rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--border-subtle, #e5e7eb);
  padding-bottom: 0.5rem;
}

.handbook-shell .prose blockquote {
  font-style: normal;
  font-weight: 500;
  color: var(--fg-secondary, #52525b);
  border-left: 3px solid var(--accent, #10b981);
  background: var(--accent-subtle, #f0fdf4);
  padding: 0.75rem 1rem;
}

.handbook-shell .prose pre {
  margin: 0;
}

.handbook-code-block {
  margin: 1.5rem 0;
}
```

- [ ] **Step 2: Import handbook CSS in the layout**

Edit `frontend/app/handbook/layout.tsx` to add at the top:

```tsx
import "./handbook.css";
```

- [ ] **Step 3: Run the dev server and visually inspect every page**

```bash
cd frontend && npm run dev
```

Open each route in `/handbook/`, every chapter, and confirm:
- Sidebar visible and selected chapter highlighted
- Right-rail outline scrolls and updates on scroll
- Code blocks render with .ocean syntax highlighting
- Copy button copies to clipboard
- Run button is visible only on `runnable` snippets and shows a "Runner unavailable" message until Plan C ships
- Cmd-K opens search
- Prev/Next at chapter bottom navigates correctly

- [ ] **Step 4: Commit**

```bash
git add frontend/app/handbook/handbook.css frontend/app/handbook/layout.tsx
git commit -m "handbook(frontend): theming and polish"
```

---

## Task 10: Static build validation

- [ ] **Step 1: Run a full production build**

```bash
cd frontend && npm run build
```

Expected:
- Prebuild step runs `python -m scripts.handbook.build --emit-content ...` successfully.
- Next.js generates one static page per chapter slug plus the index.
- No build errors.

If the prebuild fails because Plan A is incomplete, this task is gated on Plan A finishing.

- [ ] **Step 2: Smoke test the static output**

```bash
cd frontend && npm run start
curl -s http://localhost:3000/handbook | head -20
curl -s http://localhost:3000/handbook/01-what-ocean-is | head -20
```

Expected: both return 200 with chapter HTML.

- [ ] **Step 3: Commit (if any tweaks were made)**

```bash
git status
# If clean, no commit needed.
```

---

## Self-review notes

Spec coverage:
- §4.1 routes — Task 7
- §4.2 build-time content pipeline — Task 1 (emitter wiring), Task 8 (body markdown)
- §4.3 Shiki grammar — Task 0
- §4.4 `OceanCodeBlock` UX (copy, run, fence info) — Task 2 + Task 8 (fence-info parsing in the markdown renderer)
- §4.5 right-rail outline — Task 4
- §4.6 search (phase 1) — Task 6
- §4.7 theming — Task 9
- §8 done criteria 5 — Task 10

No placeholders. The TODO in Task 7 Step 5 is explicitly resolved in Task 8 — the plan tracks this as a known stub that the next task closes. Type names are consistent (`HandbookChapter`, `HandbookOutlineItem`, `RunResult`) across all files.
