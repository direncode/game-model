"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { label: "Live", href: "/live" },
  { label: "Universal", href: "/universal" },
  { label: "Watchlist", href: "/watchlist" },
  { label: "Validation", href: "/validation" },
  { label: "Pricing", href: "#pricing" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 h-14 backdrop-blur-xl transition-colors duration-300 ${
        scrolled ? "bg-black/80 border-b border-white/5" : "bg-transparent"
      }`}
    >
      <div className="max-w-[1280px] mx-auto h-full px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-2 h-2 rounded-full bg-li-cyan shadow-[0_0_8px_rgba(0,212,255,0.6)]" />
          <span className="font-display text-base tracking-tight text-white/90 group-hover:text-white">
            Latent Ocean
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="hidden sm:inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-white/10 text-white/60 text-sm hover:text-white hover:border-white/25 transition-colors"
          >
            Legacy App
          </Link>
          <Link
            href="/engine"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
          >
            Launch Engine
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 6h6m0 0L6 3m3 3L6 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </Link>
        </div>
      </div>
    </nav>
  );
}
