'use client';

import { useState, useEffect } from 'react';

const LINKS = [
  { label: 'Platform', href: '#platform' },
  { label: 'Algorithms', href: '#algorithms' },
  { label: 'Ingestors', href: '#ingestors' },
  { label: 'Architecture', href: '#architecture' },
];

export function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-[#111418]/95 backdrop-blur-md border-b border-[#2F343C]/60' : 'bg-transparent'
      }`}
    >
      <div className="max-w-[1200px] mx-auto px-8 h-[72px] flex items-center justify-between">
        <a href="#" className="text-[#F6F7F9] text-[15px] font-semibold tracking-tight">
          BigDunc
        </a>

        <div className="hidden md:flex items-center gap-10">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[#8F99A8] text-[13px] hover:text-[#F6F7F9] transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <a
            href="/demo"
            className="text-[13px] text-[#2D72D2] hover:text-[#4A90E2] transition-colors"
          >
            Live Demo
          </a>
          <a
            href="#contact"
            className="text-[13px] text-[#F6F7F9] border border-[#2F343C] px-5 py-2 hover:border-[#5F6B7C] transition-colors"
          >
            Request Demo
          </a>
        </div>

        <button
          className="md:hidden text-[#8F99A8] text-[13px]"
          onClick={() => setOpen(!open)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-[#111418] border-t border-[#2F343C]/60 px-8 py-6 space-y-4">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="block text-[#8F99A8] text-[13px] hover:text-[#F6F7F9]"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <a href="/demo" className="block text-[13px] text-[#2D72D2] hover:text-[#4A90E2] mt-2">
            Live Demo
          </a>
          <a href="#contact" className="block text-[13px] text-[#F6F7F9] border border-[#2F343C] px-5 py-2 text-center mt-4">
            Request Demo
          </a>
        </div>
      )}
    </nav>
  );
}
