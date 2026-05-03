"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

// Three-layer information architecture per docs/BUSINESS_FRAME.md.
// Layer 1: protocols. Layer 2: build. Layer 3: silicon. Plus Language + Gallery.
const NAV_ITEMS = [
  { label: "Protocols", href: "/protocols", layer: "L1" },
  { label: "Build",     href: "/build",     layer: "L2" },
  { label: "Silicon",   href: "/silicon",   layer: "L3" },
  { label: "Language",  href: "/language",  layer: null },
  { label: "Gallery",   href: "/gallery",   layer: null },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
        className={`fixed top-0 inset-x-0 z-50 h-16 backdrop-blur-xl transition-colors duration-300 ${
          scrolled || mobileOpen ? "bg-black/85 border-b border-white/5" : "bg-transparent"
        }`}
      >
        <div className="max-w-[1480px] mx-auto h-full px-6 flex items-center justify-between">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2.5 group shrink-0"
            aria-label="Latent Ocean — home"
          >
            <span className="font-mono text-[15px] font-bold tracking-[-0.02em] text-white leading-none">
              lo
            </span>
            <span className="hidden sm:inline-block text-[12.5px] font-mono font-medium tracking-[0.18em] uppercase text-white/85 group-hover:text-white transition-colors">
              Latent Ocean
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6 lg:gap-8">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="group flex items-center gap-1.5 font-mono text-[11.5px] font-medium tracking-[0.22em] uppercase text-white/70 hover:text-white transition-colors"
              >
                {item.layer && (
                  <span className="text-[9px] tracking-[0.18em] text-white/35 group-hover:text-white/55 transition-colors">
                    {item.layer}
                  </span>
                )}
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/vault"
              className="hidden sm:inline-flex items-center justify-center h-9 px-5 rounded-full bg-white text-black text-[11.5px] font-mono font-medium tracking-[0.22em] uppercase hover:bg-white/90 transition-colors"
            >
              Vault →
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-full border border-white/15 text-white/85 hover:text-white hover:border-white/30 transition-colors"
            >
              {mobileOpen ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div className="md:hidden fixed top-16 inset-x-0 bottom-0 z-40 bg-black/95 backdrop-blur-xl border-t border-white/5 overflow-y-auto">
          <div className="max-w-[1280px] mx-auto px-6 py-7 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 font-mono text-[14px] font-medium tracking-[0.22em] uppercase text-white/85 hover:text-white py-3.5 border-b border-white/[0.06]"
              >
                {item.layer && (
                  <span className="text-[10px] tracking-[0.18em] text-white/40 w-7">
                    {item.layer}
                  </span>
                )}
                <span>{item.label}</span>
              </Link>
            ))}
            <Link
              href="/vault"
              onClick={() => setMobileOpen(false)}
              className="mt-5 inline-flex items-center justify-center h-11 px-5 rounded-full bg-white text-black text-[12px] font-mono font-medium tracking-[0.22em] uppercase hover:bg-white/90 transition-colors"
            >
              Vault →
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
