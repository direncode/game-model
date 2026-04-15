"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  GitFork,
  Users,
  CreditCard,
  RefreshCw,
  Package,
  Activity,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Fleet Overview", icon: LayoutDashboard },
  { href: "/forks", label: "Forks", icon: GitFork },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/updates", label: "Updates", icon: RefreshCw },
  { href: "/modules", label: "Modules", icon: Package },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <html lang="en">
      <body className="bg-cp-black font-sans antialiased">
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <aside className="flex w-56 flex-shrink-0 flex-col border-r border-cp-border bg-cp-black-light">
            {/* Brand */}
            <div className="flex h-14 items-center gap-2 border-b border-cp-border px-4">
              <Activity className="h-5 w-5 text-cp-cyan" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-cp-white">
                  Control Plane
                </span>
                <span className="text-[10px] uppercase tracking-widest text-cp-gray-600">
                  Latent Ocean
                </span>
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-2 py-3">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-cp-cyan/10 text-cp-cyan"
                        : "text-cp-gray-400 hover:bg-cp-gray-800 hover:text-cp-gray-200"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Status */}
            <div className="border-t border-cp-border px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cp-green" />
                <span className="text-xs text-cp-gray-500">API Connected</span>
              </div>
              <p className="mt-1 font-mono text-[10px] text-cp-gray-700">
                v0.1.0
              </p>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto">
            <div className="px-6 py-5">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
