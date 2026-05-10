import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { handbookChapters } from "@/lib/handbook-content.generated";
import { OceanCodeBlock } from "@/components/handbook/OceanCodeBlock";
import { OnThisPage } from "@/components/handbook/OnThisPage";
import { PrevNext } from "@/components/handbook/PrevNext";
import { Exercise } from "@/components/handbook/Exercise";
import { WiderSystemCallout } from "@/components/handbook/WiderSystemCallout";

type Params = { params: { chapter: string } };

export function generateStaticParams() {
  return handbookChapters
    .filter((c) => c.slug !== "index")
    .map((c) => ({ chapter: c.slug }));
}

const markdownComponents = {
  code({
    className,
    children,
    ...props
  }: {
    className?: string;
    children?: React.ReactNode;
  } & React.HTMLAttributes<HTMLElement>) {
    // Fence info comes through as e.g. "language-ocean run corpus=toy_tna_50".
    // We only special-case `language-ocean...` blocks; everything else falls
    // back to default <code>.
    const info = className ?? "";
    if (!info.startsWith("language-ocean")) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    // "run" anywhere in the info string means runnable. `static` overrides to false.
    const isStatic = /\bstatic\b/.test(info);
    const runnable = !isStatic && /\brun\b/.test(info);
    const corpusMatch = /corpus=(\S+)/.exec(info);
    const corpus = corpusMatch ? corpusMatch[1] : null;
    const code = String(children ?? "").replace(/\n$/, "");
    return <OceanCodeBlock code={code} runnable={runnable} corpus={corpus} />;
  },
};

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

        {chapter.bodyMarkdown && (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {chapter.bodyMarkdown}
          </ReactMarkdown>
        )}

        {chapter.widerSystemMarkdown && (
          <WiderSystemCallout>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {chapter.widerSystemMarkdown}
            </ReactMarkdown>
          </WiderSystemCallout>
        )}

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
