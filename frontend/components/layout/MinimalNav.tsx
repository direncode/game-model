'use client';

import Link from 'next/link';
import { Settings } from 'lucide-react';

interface MinimalNavProps {
  databaseName?: string;
  status?: 'idle' | 'connecting' | 'connected' | 'error';
}

export function MinimalNav({ databaseName, status = 'idle' }: MinimalNavProps) {
  const statusColor = {
    idle: 'bg-white/20',
    connecting: 'bg-li-yellow animate-pulse',
    connected: 'bg-li-green',
    error: 'bg-li-red',
  }[status];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-12 flex items-center justify-between px-6 bg-black/60 backdrop-blur-xl border-b border-white/[0.04]">
      <Link href="/" className="flex items-center gap-2">
        <span className="text-[13px] font-sans font-medium tracking-[0.08em] text-white/90">
          Latent Ocean
        </span>
      </Link>

      {databaseName && (
        <span className="text-xs font-mono text-white/40 hidden sm:block">
          {databaseName}
        </span>
      )}

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
          <span className="text-[11px] font-mono text-white/30 hidden sm:inline">
            {status}
          </span>
        </div>
        <Link
          href="/settings"
          className="text-white/30 hover:text-white/60 transition-colors duration-200"
        >
          <Settings className="w-3.5 h-3.5" />
        </Link>
      </div>
    </nav>
  );
}
