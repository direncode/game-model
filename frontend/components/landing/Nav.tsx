"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { label: "Start", href: "/start" },
  { label: "Platform", href: "/platform" },
  { label: "Titan", href: "/titan" },
  { label: "Live", href: "/live" },
  { label: "Pricing", href: "#pricing" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mobileOpen]);

  return (
    <>
    <nav
      className={`fixed top-0 inset-x-0 z-50 h-14 backdrop-blur-xl transition-colors duration-300 ${
        scrolled || mobileOpen ? "bg-black/80 border-b border-white/5" : "bg-transparent"
      }`}
    >
      <div className="max-w-[1280px] mx-auto h-full px-6 flex items-center justify-between">
        <Link
          href="/"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-2 group"
        >
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
          <a
            href="mailto:sales@latentocean.com?subject=Install%20Latent%20Ocean"
            className="hidden sm:inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
          >
            Install
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 6h6m0 0L6 3m3 3L6 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </a>

          {/* Hamburger — only visible on mobile; everything else above is hidden md:/sm: */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-full border border-white/10 text-white/80 hover:text-white hover:border-white/25 transition-colors"
          >
            {mobileOpen ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

    </nav>

    {/* Mobile sheet — rendered as a sibling of <nav>, not a child. The
        nav has backdrop-filter which creates a containing block and
        breaks `position: fixed` descendants; keeping the sheet at
        root level makes `fixed + inset-0` resolve against the viewport. */}
    {mobileOpen && (
      <div className="md:hidden fixed top-14 inset-x-0 bottom-0 z-40 bg-black/95 backdrop-blur-xl border-t border-white/5 overflow-y-auto">
        <div className="max-w-[1280px] mx-auto px-6 py-6 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="text-lg text-white/80 hover:text-white py-3 border-b border-white/5"
            >
              {item.label}
            </a>
          ))}
          <Link
            href="/admin"
            onClick={() => setMobileOpen(false)}
            className="text-lg text-white/80 hover:text-white py-3 border-b border-white/5"
          >
            Legacy App
          </Link>
          <a
            href="mailto:sales@latentocean.com?subject=Install%20Latent%20Ocean"
            onClick={() => setMobileOpen(false)}
            className="mt-4 inline-flex items-center justify-center gap-1.5 h-11 px-5 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
          >
            Install
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 6h6m0 0L6 3m3 3L6 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </a>
        </div>
      </div>
    )}
    </>
  );
}
