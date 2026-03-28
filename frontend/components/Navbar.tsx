"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import {
  LogOut,
  User,
  Settings,
  Search,
} from "lucide-react";
import { useState } from "react";

export function Navbar() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <nav className="h-16 border-b border-li-border bg-li-surface/80 backdrop-blur-sm fixed top-0 left-0 right-0 z-50">
      <div className="h-full flex items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-li-primary flex items-center justify-center">
              <span className="text-white font-sans font-bold text-sm">LI</span>
            </div>
            <span className="font-sans text-sm font-medium tracking-[0.15em] uppercase text-li-text-primary">
              LATENT INTELLIGENCE
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            <Link
              href="/"
              className="px-3 py-2 rounded-lg text-sm text-li-text-secondary hover:text-li-text-primary hover:bg-li-surface-hover transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/datasets"
              className="px-3 py-2 rounded-lg text-sm text-li-text-secondary hover:text-li-text-primary hover:bg-li-surface-hover transition-colors"
            >
              Datasets
            </Link>
            {user?.role === "admin" && (
              <Link
                href="/admin"
                className="px-3 py-2 rounded-lg text-sm text-li-text-secondary hover:text-li-text-primary hover:bg-li-surface-hover transition-colors"
              >
                Admin
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="p-2 rounded-lg text-li-text-muted hover:text-li-text-primary hover:bg-li-surface-hover transition-colors">
            <Search className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-li-surface-hover transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-li-primary/20 flex items-center justify-center">
                <User className="w-4 h-4 text-li-primary" />
              </div>
              <span className="text-sm text-li-text-secondary hidden sm:block">
                {user?.name || "User"}
              </span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-li-surface border border-li-border rounded-xl shadow-xl py-2 z-50">
                <div className="px-4 py-2 border-b border-li-border">
                  <p className="text-sm font-medium text-li-text-primary">
                    {user?.name}
                  </p>
                  <p className="text-xs text-li-text-muted">{user?.email}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-data bg-li-primary/20 text-li-primary">
                    {user?.role}
                  </span>
                </div>
                <Link
                  href="/settings"
                  className="flex items-center gap-3 px-4 py-2 text-sm text-li-text-secondary hover:bg-li-surface-hover transition-colors"
                  onClick={() => setShowUserMenu(false)}
                >
                  <Settings className="w-4 h-4" />
                  Account Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-li-danger hover:bg-li-surface-hover transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
