import Link from "next/link";
import type { HandbookChapter } from "@/lib/handbook-types";

type SidebarChapter = Pick<HandbookChapter, "slug" | "number" | "title">;

type Props = {
  chapters: readonly SidebarChapter[];
  currentSlug: string;
};

export function HandbookSidebar({ chapters, currentSlug }: Props) {
  // Preface: number === 0 (matches both `00-preface` test fixture and real slug `preface`).
  const preface = chapters.find((c) => c.number === 0);
  const numbered = chapters
    .filter((c) => typeof c.number === "number" && (c.number ?? 0) >= 1)
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  const appendices = chapters.filter((c) => c.slug.startsWith("app-"));

  return (
    <nav className="handbook-sidebar w-64 shrink-0 border-r border-zinc-200 dark:border-zinc-800 px-4 py-6 text-sm">
      <Link href="/handbook" className={linkClass(currentSlug === "index" || currentSlug === "")}>
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
