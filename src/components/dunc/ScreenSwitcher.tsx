"use client";

// ScreenSwitcher — role-gated screen navigation.
// Manager sees only their view. Technical staff sees Backend + Analytics + Manager.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Cpu, Users } from "lucide-react";
import { useDuncStore } from "@/lib/dunc/store";
import { cn } from "@/lib/utils";

interface Screen {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: (matchId: string) => string;
  matchPath: (matchId: string) => RegExp;
  staffOnly: boolean;
}

const SCREENS: Screen[] = [
  {
    key: "backend",
    label: "Backend",
    icon: Cpu,
    href: (id) => `/match/${id}/backend`,
    matchPath: (id) => new RegExp(`/match/${id}/backend/?$`),
    staffOnly: true,
  },
  {
    key: "analytics",
    label: "Analytics",
    icon: BarChart3,
    href: (id) => `/match/${id}/analytics`,
    matchPath: (id) => new RegExp(`/match/${id}/analytics/?$`),
    staffOnly: true,
  },
  {
    key: "manager",
    label: "Manager",
    icon: Users,
    href: (id) => `/match/${id}`,
    matchPath: (id) => new RegExp(`/match/${id}/?$`),
    staffOnly: false,
  },
];

export function ScreenSwitcher({ matchId }: { matchId: string }) {
  const pathname = usePathname() || "";
  const role = useDuncStore((s) => s.role);

  const visibleScreens = role === "manager"
    ? SCREENS.filter((s) => !s.staffOnly)
    : SCREENS;

  // Manager only has one screen — don't show a switcher at all
  if (visibleScreens.length <= 1) return null;

  return (
    <div className="inline-flex items-center gap-0.5 bg-li-black-surface border border-li-border rounded-md p-0.5">
      {visibleScreens.map((s) => {
        const Icon = s.icon;
        const active = s.matchPath(matchId).test(pathname);
        return (
          <Link
            key={s.key}
            href={s.href(matchId)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-sm text-[11px] font-mono uppercase tracking-wider transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-li-cyan focus:ring-offset-1 focus:ring-offset-li-black",
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
