'use client';

export interface Connection {
  source: string;
  target: string;
  signal_type: string;
  strength: number;
}

interface ConnectionGraphProps {
  connections: Connection[];
  maxDisplay?: number;
}

export function ConnectionGraph({ connections, maxDisplay = 20 }: ConnectionGraphProps) {
  const sorted = [...connections]
    .sort((a, b) => b.strength - a.strength)
    .slice(0, maxDisplay);

  if (sorted.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-white/20 font-mono">
        No connections discovered
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {sorted.map((c, i) => (
        <div
          key={`${c.source}-${c.target}-${i}`}
          className="flex items-center gap-3 py-2 px-3 rounded hover:bg-white/[0.02] transition-colors duration-150 opacity-0 animate-fade-in"
          style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'forwards' }}
        >
          <span className="text-sm text-white/70 font-mono truncate min-w-0 flex-shrink">
            {c.source}
          </span>
          <span className="text-white/15 flex-shrink-0">&rarr;</span>
          <span className="text-sm text-white/70 font-mono truncate min-w-0 flex-shrink">
            {c.target}
          </span>
          <span className="text-[10px] font-mono text-white/25 bg-white/[0.03] px-1.5 py-0.5 rounded flex-shrink-0 ml-auto">
            {c.signal_type}
          </span>
          <span className="text-[10px] font-mono text-li-cyan/60 flex-shrink-0 w-10 text-right">
            {(c.strength * 100).toFixed(0)}%
          </span>
        </div>
      ))}
      {connections.length > maxDisplay && (
        <div className="pt-2 text-center text-[11px] text-white/20 font-mono">
          Showing top {maxDisplay} of {connections.length} connections
        </div>
      )}
    </div>
  );
}
