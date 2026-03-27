"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Database,
  Plus,
  Shield,
  Users,
  FileText,
  Activity,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/datasets", label: "Datasets", icon: Database },
  { href: "/datasets/new", label: "New Dataset", icon: Plus },
];

const adminItems = [
  { href: "/admin", label: "Admin", icon: Shield },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/audit", label: "Audit Log", icon: FileText },
  { href: "/admin/compliance", label: "Compliance", icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-[calc(100vh-4rem)] fixed top-16 left-0 border-r border-li-border bg-li-surface/50 overflow-y-auto">
      <div className="p-4 space-y-6">
        <div>
          <p className="px-3 mb-2 text-xs font-data uppercase tracking-wider text-li-text-muted">
            Navigation
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
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
                      ? "bg-li-primary/10 text-li-primary"
                      : "text-li-text-secondary hover:text-li-text-primary hover:bg-li-surface-hover"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div>
          <p className="px-3 mb-2 text-xs font-data uppercase tracking-wider text-li-text-muted">
            Administration
          </p>
          <nav className="space-y-1">
            {adminItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-li-primary/10 text-li-primary"
                      : "text-li-text-secondary hover:text-li-text-primary hover:bg-li-surface-hover"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}
