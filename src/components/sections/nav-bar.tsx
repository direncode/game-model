'use client';

import { useState, useEffect } from 'react';
import { Shield, ChevronRight, Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Platform', href: '#platform' },
  { label: 'Algorithms', href: '#algorithms' },
  { label: 'Ingestors', href: '#ingestors' },
  { label: 'Architecture', href: '#architecture' },
];

export function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#1C2127]/95 backdrop-blur-md border-b border-[#2F343C]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-[1280px] mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2.5 group">
          <Shield className="w-6 h-6 text-[#2D72D2] transition-transform group-hover:scale-110" />
          <span className="text-[#F6F7F9] font-semibold text-base tracking-tight">
            BigDunc
          </span>
        </a>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[#8F99A8] text-sm font-medium hover:text-[#F6F7F9] transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <a href="#contact" className="btn-primary text-sm">
            Request Demo
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-[#8F99A8] hover:text-[#F6F7F9]"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[#1C2127] border-t border-[#2F343C] px-6 py-4 space-y-3">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block text-[#8F99A8] text-sm font-medium hover:text-[#F6F7F9] py-2"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <a href="#contact" className="btn-primary text-sm w-full justify-center mt-2">
            Request Demo
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      )}
    </nav>
  );
}
