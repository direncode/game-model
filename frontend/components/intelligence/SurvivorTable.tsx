'use client';

import { useState, useMemo } from 'react';

export interface Survivor {
  name: string;
  type: string;
  score: number;
  anomaly_score: number;
}

interface SurvivorTableProps {
  survivors: Survivor[];
}

type SortKey = 'name' | 'type' | 'score' | 'anomaly_score';
type SortDir = 'asc' | 'desc';

function AnomalyBadge({ score }: { score: number }) {
  if (score < 0.5) return null;
  const color =
    score >= 0.9
      ? 'bg-li-red/15 text-li-red'
      : score >= 0.8
        ? 'bg-orange-500/15 text-orange-400'
        : score >= 0.7
          ? 'bg-li-yellow/15 text-li-yellow'
          : 'bg-white/5 text-white/40';
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${color}`}>
      <span className="w-1 h-1 rounded-full bg-current" />
      {score.toFixed(2)}
    </span>
  );
}

function ScoreBar({ value }: { value: number }) {
  const color =
    value >= 0.8
      ? 'bg-li-cyan'
      : value >= 0.5
        ? 'bg-li-cyan/60'
        : 'bg-white/20';
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono text-white/70 w-8 text-right">
        {value.toFixed(2)}
      </span>
      <div className="flex-1 h-[3px] bg-white/[0.04] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500 ease-out`}
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}

export function SurvivorTable({ survivors }: SurvivorTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = useMemo(() => {
    return [...survivors].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc'
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
  }, [survivors, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const headerClass =
    'text-[10px] font-mono uppercase tracking-wider text-white/30 pb-3 cursor-pointer hover:text-white/50 transition-colors select-none text-left';
  const arrow = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' \u2191' : ' \u2193') : '';

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/[0.04]">
            <th className={headerClass} onClick={() => toggleSort('name')}>
              Entity{arrow('name')}
            </th>
            <th className={headerClass} onClick={() => toggleSort('type')}>
              Type{arrow('type')}
            </th>
            <th className={`${headerClass} w-48`} onClick={() => toggleSort('score')}>
              Score{arrow('score')}
            </th>
            <th className={headerClass} onClick={() => toggleSort('anomaly_score')}>
              Anomaly{arrow('anomaly_score')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => (
            <tr
              key={`${s.name}-${i}`}
              className={`border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors duration-150 ${
                i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.01]'
              }`}
            >
              <td className="py-2.5 pr-4">
                <span className="text-sm text-white font-medium">{s.name}</span>
              </td>
              <td className="py-2.5 pr-4">
                <span className="text-xs font-mono text-white/40 bg-white/[0.04] px-2 py-0.5 rounded">
                  {s.type}
                </span>
              </td>
              <td className="py-2.5 pr-4 w-48">
                <ScoreBar value={s.score} />
              </td>
              <td className="py-2.5">
                <AnomalyBadge score={s.anomaly_score} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {survivors.length === 0 && (
        <div className="py-12 text-center text-sm text-white/20 font-mono">
          No survivors yet
        </div>
      )}
    </div>
  );
}
