'use client';

export interface Anomaly {
  name: string;
  type: string;
  anomaly_score: number;
  narrative?: string;
}

interface AnomalyFeedProps {
  anomalies: Anomaly[];
  threshold?: number;
}

export function AnomalyFeed({ anomalies, threshold = 0.7 }: AnomalyFeedProps) {
  const filtered = anomalies
    .filter((a) => a.anomaly_score >= threshold)
    .sort((a, b) => b.anomaly_score - a.anomaly_score);

  if (filtered.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-white/20 font-mono">
        No anomalies above threshold
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map((a, i) => {
        const severity =
          a.anomaly_score >= 0.9
            ? { color: 'border-li-red/20 bg-li-red/[0.03]', dot: 'bg-li-red', label: 'Critical' }
            : a.anomaly_score >= 0.8
              ? { color: 'border-orange-500/20 bg-orange-500/[0.03]', dot: 'bg-orange-400', label: 'High' }
              : { color: 'border-li-yellow/20 bg-li-yellow/[0.03]', dot: 'bg-li-yellow', label: 'Medium' };

        return (
          <div
            key={`${a.name}-${i}`}
            className={`border rounded-lg px-4 py-3 ${severity.color} opacity-0 animate-fade-in`}
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'forwards' }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{a.name}</span>
                <span className="text-[10px] font-mono text-white/30 bg-white/[0.04] px-1.5 py-0.5 rounded">
                  {a.type}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${severity.dot}`} />
                <span className="text-[10px] font-mono text-white/40">
                  {a.anomaly_score.toFixed(2)}
                </span>
              </div>
            </div>
            {a.narrative && (
              <p className="text-xs text-white/40 leading-relaxed">{a.narrative}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
