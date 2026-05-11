import { handbookChapters } from "@/lib/handbook-content.generated";
import Link from "next/link";

export default function HandbookIndexPage() {
  const index = handbookChapters.find((c) => c.slug === "index");
  const numbered = handbookChapters
    .filter((c) => typeof c.number === "number" && (c.number ?? 0) >= 1)
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  const appendices = handbookChapters.filter((c) => c.slug.startsWith("app-"));

  return (
    <article className="prose dark:prose-invert">
      <h1>{index?.title ?? "The OCEAN Handbook"}</h1>
      {index?.promise && <blockquote>{index.promise}</blockquote>}

      <div className="not-prose my-6 flex gap-3 flex-wrap">
        <a
          href="/ocean-handbook.pdf"
          download
          className="inline-flex items-center gap-2 rounded-md border border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/60"
        >
          <span>Download PDF</span>
          <span className="text-xs text-emerald-600/70 dark:text-emerald-500/70">
            (~300 KB &middot; 114 pages)
          </span>
        </a>
        <a
          href="/ocean-handbook.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          Open PDF in new tab
        </a>
      </div>

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
