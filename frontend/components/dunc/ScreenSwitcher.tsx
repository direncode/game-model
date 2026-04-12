"use client";

// ScreenSwitcher — three-way pill toggle for the match dashboard.
//
// Ported from the multi-screen-backend-demo reference repo, adapted to our
// dark li-* palette. The reference used three screens: Technical (Backend),
// Technical (Analytics), and Manager. Same split here; each is a distinct
// Next.js route under /dunc/match/[id]/ so deep-linking and back-button
// behavior Just Work.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Cpu, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Screen {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: (matchId: string) => string;
  matchPath: (matchId: string) => RegExp;
}

const SCREENS: Screen[] = [
  {
    key: "backend",
    label: "Backend",
    icon: Cpu,
    href: (id) => `/dunc/match/${id}/backend`,
    matchPath: (id) => new RegExp(`/dunc/match/${id}/backend/?$`),
  },
  {
    key: "analytics",
    label: "Analytics",
    icon: BarChart3,
    href: (id) => `/dunc/match/${id}/analytics`,
    matchPath: (id) => new RegExp(`/dunc/match/${id}/analytics/?$`),
  },
  {
    key: "manager",
    label: "Manager",
    icon: Users,
    href: (id) => `/dunc/match/${id}`,
    matchPath: (id) => new RegExp(`/dunc/match/${id}/?$`),
  },
];

export function ScreenSwitcher({ matchId }: { matchId: string }) {
  const pathname = usePathname() || "";
  return (
    <div className="inline-flex items-center gap-0.5 bg-li-black-surface border border-li-border rounded-md p-0.5">
      {SCREENS.map((s) => {
        const Icon = s.icon;
        const active = s.matchPath(matchId).test(pathname);
        return (
          <Link
            key={s.key}
            href={s.href(matchId)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-sm text-[11px] font-mono uppercase tracking-wider transition-colors",
              active
                ? "bg-li-white text-li-black"
                : "text-li-text-secondary hover:text-li-white",
            )}
          >
            <Icon className="w-3 h-3" />
            {s.label}
          </Link>
        );
      })}
    </div>
  );
}
