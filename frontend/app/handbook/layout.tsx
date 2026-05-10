import "./handbook.css";
import { handbookChapters } from "@/lib/handbook-content.generated";
import { HandbookSidebar } from "@/components/handbook/HandbookSidebar";
import { HandbookSearch } from "@/components/handbook/HandbookSearch";

export default function HandbookLayout({ children }: { children: React.ReactNode }) {
  const searchDataset = handbookChapters.map((c) => ({
    slug: c.slug,
    title: c.title,
    outline: c.outline.map((o) => ({ id: o.id, text: o.text })),
  }));

  return (
    <div className="handbook-shell flex min-h-screen mx-auto max-w-[1400px]">
      <HandbookSidebar chapters={handbookChapters} currentSlug="" />
      <main className="flex-1 px-8 py-8 max-w-[760px]">{children}</main>
      <HandbookSearch dataset={searchDataset} />
    </div>
  );
}
