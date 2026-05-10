import { notFound } from "next/navigation";
import { handbookChapters } from "@/lib/handbook-content.generated";
import { OceanCodeBlock } from "@/components/handbook/OceanCodeBlock";
import { OnThisPage } from "@/components/handbook/OnThisPage";
import { PrevNext } from "@/components/handbook/PrevNext";
import { Exercise } from "@/components/handbook/Exercise";

type Params = { params: { chapter: string } };

export function generateStaticParams() {
  return handbookChapters
    .filter((c) => c.slug !== "index")
    .map((c) => ({ chapter: c.slug }));
}

export default function ChapterPage({ params }: Params) {
  const chapter = handbookChapters.find((c) => c.slug === params.chapter);
  if (!chapter) notFound();

  const numbered = handbookChapters
    .filter((c) => typeof c.number === "number" && (c.number ?? 0) >= 1)
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

      <OnThisPage outline={[...chapter.outline]} />
    </div>
  );
}
