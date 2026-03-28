"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Database,
  Box,
  GitBranch,
  Swords,
  Route,
  FileBarChart,
  AlertTriangle,
  Users,
  ClipboardList,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Compass,
  Bell,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { useAppStore } from "@/stores/app";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  hidden?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
  adminOnly?: boolean;
}

interface SidebarProps {
  className?: string;
}

export default function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";
  const activeDatasetId = useAppStore((s) => s.activeDatasetId);

  const sections: NavSection[] = [
    {
      title: "DISCOVER",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Datasets", href: "/datasets", icon: Database },
      ],
    },
    {
      title: "ANALYZE",
      items: [
        { label: "Modules", href: "/modules", icon: Box },
        { label: "Connections", href: "/connections", icon: GitBranch },
        {
          label: "Search",
          href: activeDatasetId ? `/datasets/${activeDatasetId}/search` : "#",
          icon: Search,
          hidden: !activeDatasetId,
        },
        {
          label: "Explorer",
          href: activeDatasetId ? `/datasets/${activeDatasetId}/explorer` : "#",
          icon: Compass,
          hidden: !activeDatasetId,
        },
      ],
    },
    {
      title: "COLLABORATE",
      items: [
        { label: "Challenges", href: "/challenges", icon: Swords },
      ],
    },
    {
      title: "GOVERN",
      items: [
        { label: "Lineage", href: "/lineage", icon: Route },
        { label: "Reports", href: "/reports", icon: FileBarChart },
        { label: "Alerts", href: "/alerts", icon: Bell },
      ],
    },
    {
      title: "ADMIN",
      adminOnly: true,
      items: [
        { label: "Users", href: "/admin/users", icon: Users },
        { label: "Audit", href: "/admin/audit", icon: ClipboardList },
        { label: "Compliance", href: "/admin/compliance", icon: ShieldCheck },
        { label: "Organizations", href: "/admin/organizations", icon: Building2 },
      ],
    },
  ];

  return (
    <aside
      className={cn(
        "fixed left-0 top-14 bottom-0 z-40 bg-li-surface border-r border-li-border flex flex-col transition-all duration-200",
        collapsed ? "w-16" : "w-60",
        className
      )}
    >
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        {sections.map((section) => {
          if (section.adminOnly && !isAdmin) return null;
          const visibleItems = section.items.filter((item) => !item.hidden);
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.title}>
              {!collapsed && (
                <p className="px-3 mb-2 text-[10px] font-display font-semibold tracking-widest text-li-text-muted uppercase">
                  {section.title}
                </p>
              )}
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = pathname === item.href || pathname?.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                          active
                            ? "bg-li-primary/10 text-li-primary border-l-2 border-li-primary"
                            : "text-li-text-secondary hover:bg-li-surface-hover hover:text-li-text-primary"
                        )}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-li-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 rounded-md text-li-text-muted hover:bg-li-surface-hover hover:text-li-text-primary transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
