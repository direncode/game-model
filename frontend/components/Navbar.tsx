"use client";

import { useRouter } from "next/navigation";
import { useAppStore } from "@/stores/app";
import {
  LogOut,
  Settings,
  Search,
  Bell,
  HelpCircle,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";

export function Navbar() {
  const user = useAppStore((s) => s.user);
  const signOut = useAppStore((s) => s.logout);
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  // Get user initials for avatar
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <nav className="h-14 bg-black fixed top-0 left-60 right-0 z-50 flex items-center justify-between px-6 border-b border-li-gray-900">
      {/* Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-li-gray-800 text-li-text-muted text-sm cursor-pointer hover:border-li-gray-600 transition-colors w-full">
          <Search className="w-3.5 h-3.5" />
          <span className="flex-1">Search</span>
          <kbd className="text-xs text-li-text-muted bg-white/[0.06] px-1.5 py-0.5 rounded font-mono">
            Ctrl+K
          </kbd>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <button className="p-2 rounded-lg text-li-text-muted hover:text-white hover:bg-white/[0.04] transition-colors">
          <HelpCircle className="w-4 h-4" />
        </button>
        <button className="p-2 rounded-lg text-li-text-muted hover:text-white hover:bg-white/[0.04] transition-colors">
          <Bell className="w-4 h-4" />
        </button>

        {/* User avatar */}
        <div className="relative ml-2">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-8 h-8 rounded-full bg-li-gray-800 flex items-center justify-center text-xs font-medium text-white hover:bg-li-gray-700 transition-colors"
          >
            {initials}
          </button>

          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-56 bg-li-surface border border-li-gray-800 rounded-xl shadow-2xl py-1.5 z-50">
                <div className="px-4 py-2.5 border-b border-li-gray-800">
                  <p className="text-sm font-medium text-white">
                    {user?.name || "User"}
                  </p>
                  <p className="text-xs text-li-text-muted mt-0.5">{user?.email}</p>
                </div>
                <Link
                  href="/settings"
                  className="flex items-center gap-3 px-4 py-2 text-sm text-li-text-secondary hover:text-white hover:bg-white/[0.04] transition-colors"
                  onClick={() => setShowUserMenu(false)}
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-li-danger hover:bg-white/[0.04] transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
