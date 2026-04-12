"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui";
import {
  LayoutDashboard,
  Database,
  Library,
  Plus,
  Cpu,
  BrainCircuit,
  Shield,
  Users,
  FileText,
  Activity,
  Settings,
  MapPin,
  Goal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const exploreItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/datasets", label: "Datasets", icon: Database },
  { href: "/datasets/library", label: "Dataset Library", icon: Library },
  { href: "/datasets/new", label: "New Dataset", icon: Plus },
];

const engineItems = [
  { href: "/engine", label: "Engine Console", icon: Cpu },
  { href: "/btut", label: "BTUT Intelligence", icon: BrainCircuit },
  { href: "/data-layer", label: "Data Layer", icon: Activity },
];

const liveDataItems = [
  { href: "/franklin", label: "Franklin Street", icon: MapPin },
  { href: "/dunc", label: "D-U-N-C Football", icon: Goal },
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
  collapsed,
}: {
  label: string;
  items: Array<{ href: string; label: string; icon: any }>;
  pathname: string;
  collapsed: boolean;
}) {
  return (
    <div>
      {!collapsed && label && (
        <p className="px-3 mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-li-text-muted">
          {label}
        </p>
      )}
      {collapsed && label && <div className="h-3" />}
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
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg text-sm transition-colors",
                collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
                isActive
                  ? "text-white bg-white/[0.08]"
                  : "text-li-text-secondary hover:text-white hover:bg-white/[0.04]"
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <aside
      className={cn(
        "h-screen fixed top-0 left-0 bg-black overflow-y-auto flex flex-col z-40 transition-all duration-200",
        sidebarCollapsed ? "w-14" : "w-60"
      )}
    >
      {/* Brand */}
      <div className={cn("pt-5 pb-4 flex items-center justify-between", sidebarCollapsed ? "px-2" : "px-4")}>
        <Link href="/" className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center flex-shrink-0">
            <span className="text-black font-sans font-bold text-xs">LI</span>
          </div>
          {!sidebarCollapsed && (
            <span className="text-sm font-medium text-white tracking-wide truncate">
              Latent Intelligence
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <div className={cn("flex-1 space-y-5 overflow-y-auto", sidebarCollapsed ? "px-1" : "px-2")}>
        <NavSection label="Explore" items={exploreItems} pathname={pathname} collapsed={sidebarCollapsed} />
        <NavSection label="Engine" items={engineItems} pathname={pathname} collapsed={sidebarCollapsed} />
        <NavSection label="Live Data" items={liveDataItems} pathname={pathname} collapsed={sidebarCollapsed} />
        <NavSection label="Admin" items={adminItems} pathname={pathname} collapsed={sidebarCollapsed} />
      </div>

      {/* Bottom: settings + collapse toggle */}
      <div className={cn("pb-4 pt-2 border-t border-li-gray-900", sidebarCollapsed ? "px-1" : "px-2")}>
        <NavSection label="" items={settingsItems} pathname={pathname} collapsed={sidebarCollapsed} />
        <button
          onClick={toggleSidebar}
          className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-li-text-muted hover:text-white hover:bg-white/[0.04] transition-colors text-sm"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
