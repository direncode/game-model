import NextLink from "next/link";

type PrevNextLink = { slug: string; title: string };

type Props = {
  prev: PrevNextLink | null;
  next: PrevNextLink | null;
};

export function PrevNext({ prev, next }: Props) {
  return (
    <nav className="handbook-prev-next mt-12 flex justify-between border-t border-zinc-200 dark:border-zinc-800 pt-6">
      <div>
        {prev !== null && (
          <NextLink
            href={`/handbook/${prev.slug}`}
            className="block text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <div className="text-xs uppercase tracking-wider">Previous</div>
            <div className="mt-1">{prev.title}</div>
          </NextLink>
        )}
      </div>
      <div className="text-right">
        {next !== null && (
          <NextLink
            href={`/handbook/${next.slug}`}
            className="block text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <div className="text-xs uppercase tracking-wider">Next</div>
            <div className="mt-1">{next.title}</div>
          </NextLink>
        )}
      </div>
    </nav>
  );
}
