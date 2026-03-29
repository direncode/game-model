"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Database,
  Library,
  Plus,
  Cpu,
  Shield,
  Users,
  FileText,
  Activity,
  Settings,
  MapPin,
} from "lucide-react";

const exploreItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/datasets", label: "Datasets", icon: Database },
  { href: "/datasets/library", label: "Dataset Library", icon: Library },
  { href: "/datasets/new", label: "New Dataset", icon: Plus },
];

const engineItems = [
  { href: "/engine", label: "Engine Console", icon: Cpu },
];

const liveDataItems = [
  { href: "/franklin", label: "Franklin Street", icon: MapPin },
];

const adminItems = [
  { href: "/admin", label: "Overview", icon: Shield },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/audit", label: "Audit Log", icon: FileText },
  { href: "/admin/compliance", label: "Compliance", icon: Activity },
];

const settingsItems = [
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavSection({
  label,
  items,
  pathname,
}: {
  label: string;
  items: Array<{ href: string; label: string; icon: any }>;
  pathname: string;
}) {
  return (
    <div>
      <p className="px-3 mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-li-text-muted">
        {label}
      </p>
      <nav className="space-y-0.5">
        {items.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "text-white bg-white/[0.08]"
                  : "text-li-text-secondary hover:text-white hover:bg-white/[0.04]"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 h-screen fixed top-0 left-0 bg-black overflow-y-auto flex flex-col z-40">
      {/* Brand */}
      <div className="px-4 pt-5 pb-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center">
            <span className="text-black font-sans font-bold text-xs">LI</span>
          </div>
          <span className="text-sm font-medium text-white tracking-wide">
            Latent Intelligence
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-2 space-y-5 overflow-y-auto">
        <NavSection label="Explore" items={exploreItems} pathname={pathname} />
        <NavSection label="Engine" items={engineItems} pathname={pathname} />
        <NavSection label="Live Data" items={liveDataItems} pathname={pathname} />
        <NavSection label="Admin" items={adminItems} pathname={pathname} />
      </div>

      {/* Bottom settings */}
      <div className="px-2 pb-4 pt-2 border-t border-li-gray-900">
        <NavSection label="" items={settingsItems} pathname={pathname} />
      </div>
    </aside>
  );
}
