"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronRight, Command, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { useAppStore } from "@/stores/app";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface NavbarProps {
  breadcrumbs?: BreadcrumbItem[];
  onCommandPalette?: () => void;
  notificationCount?: number;
}

export default function Navbar({
  breadcrumbs,
  onCommandPalette,
  notificationCount: notificationCountProp,
}: NavbarProps) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const storeAlertCount = useAppStore((s) => (s as any).alerts?.length ?? 0);
  const notificationCount = notificationCountProp ?? storeAlertCount;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-li-surface border-b border-li-border flex items-center justify-between px-4">
      {/* Left: Logo */}
      <div className="flex items-center gap-3">
        <span className="font-display font-bold text-lg text-li-primary">LI</span>
        <span className="hidden sm:inline text-xs font-display tracking-widest text-li-text-secondary uppercase">
          Latent Intelligence
        </span>
      </div>

      {/* Center: Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="hidden md:flex items-center gap-1 text-sm">
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && <ChevronRight className="w-3 h-3 text-li-text-muted" />}
              {crumb.href ? (
                <a
                  href={crumb.href}
                  className="text-li-text-secondary hover:text-li-text-primary transition-colors"
                >
                  {crumb.label}
                </a>
              ) : (
                <span className="text-li-text-primary">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Cmd+K trigger */}
        <button
          onClick={onCommandPalette}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-li-bg border border-li-border text-li-text-muted text-xs hover:border-li-border-light transition-colors"
        >
          <Command className="w-3 h-3" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="ml-1 px-1 py-0.5 rounded bg-li-surface text-[10px] font-display">
            {typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent) ? "\u2318K" : "Ctrl+K"}
          </kbd>
        </button>

        {/* Notifications */}
        <button
          onClick={() => router.push("/alerts")}
          className="relative p-2 rounded-md hover:bg-li-surface-hover transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4 text-li-text-secondary" />
          {notificationCount > 0 && (
            <>
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-li-danger text-[10px] font-bold text-white leading-none">
                {notificationCount > 99 ? "99+" : notificationCount}
              </span>
            </>
          )}
        </button>

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-li-surface-hover transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-li-primary/20 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-li-primary" />
            </div>
            <span className="hidden sm:inline text-sm text-li-text-primary">
              {user?.name ?? "User"}
            </span>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-li-surface border border-li-border rounded-lg shadow-lg py-1 z-50">
              <div className="px-3 py-2 border-b border-li-border">
                <p className="text-sm text-li-text-primary">{user?.name}</p>
                <p className="text-xs text-li-text-muted">{user?.email}</p>
              </div>
              <button
                onClick={async () => {
                  setDropdownOpen(false);
                  await logout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-li-danger hover:bg-li-surface-hover transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
