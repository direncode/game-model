'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Navbar } from '@/components/Navbar';
import { GridBackground } from '@/components/effects/GridBackground';

// Routes that use the full sidebar + navbar chrome.
// Everything else gets the minimal layout (no sidebar, no navbar).
// Routes that use the full sidebar + navbar chrome.
// Verticals with their own layout (dunc, franklin) are excluded —
// they render with the minimal shell and handle their own navigation.
const DEEP_DIVE_PREFIXES = [
  '/datasets',
  '/modules',
  '/admin',
  '/settings',
  '/search',
  '/alerts',
  '/btut',
  '/tcd',
  '/flow-engine',
  '/data-estate',
  '/data-layer',
  '/qr',
  '/login',
  '/register',
  '/ocean',
];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isDeepDive = DEEP_DIVE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isDeepDive) {
    return (
      <>
        <GridBackground />
        <div className="gradient-top" />
        <div className="relative z-20 flex min-h-screen">
          <Sidebar />
          <div className="flex-1 ml-60 p-8">
            <Navbar />
            {children}
          </div>
        </div>
      </>
    );
  }

  // Minimal layout for root page — no sidebar, no navbar, no grid background
  return (
    <div className="relative z-20">
      {children}
    </div>
  );
}
