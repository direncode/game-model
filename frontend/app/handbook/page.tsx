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
