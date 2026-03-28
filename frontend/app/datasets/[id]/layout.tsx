"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Overview", href: "" },
  { label: "Modules", href: "/modules" },
  { label: "Connections", href: "/connections" },
  { label: "Search", href: "/search" },
  { label: "Explorer", href: "/explorer" },
  { label: "Compare", href: "/compare" },
  { label: "Graph", href: "/graph" },
  { label: "Challenges", href: "/challenges" },
  { label: "Lineage", href: "/lineage" },
  { label: "Reports", href: "/reports" },
];

export default function DatasetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const datasetId = params.id as string;
  const basePath = `/datasets/${datasetId}`;

  return (
    <div className="min-h-screen">
      <Navbar />
      <Sidebar />
      <main className="ml-60 pt-14">
        <div className="border-b border-li-border bg-li-surface/30">
          <div className="px-8 pt-4">
            <nav className="flex gap-1 -mb-px overflow-x-auto">
              {tabs.map((tab) => {
                const tabPath = `${basePath}${tab.href}`;
                // For "Overview" tab, match exact path; for others, match prefix
                const isActive =
                  tab.href === ""
                    ? pathname === basePath
                    : pathname.startsWith(tabPath);

                return (
                  <Link
                    key={tab.label}
                    href={tabPath}
                    className={cn(
                      "px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                      isActive
                        ? "border-li-primary text-li-primary"
                        : "border-transparent text-li-text-muted hover:text-li-text-secondary hover:border-li-border"
                    )}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
