'use client';

import { useMemo } from 'react';
import type { Player, TrackingMetrics, PlayerAlert } from '@/types';
import type { SimpleTwin } from '@/data/generate-tracking';
import { Activity, Heart, Zap, TrendingDown, AlertTriangle, Timer } from 'lucide-react';
import { formatDistance } from '@/lib/utils';

interface PhysicalPerformanceProps {
  players: Player[];
  liveData: Map<string, TrackingMetrics>;
  twins: Map<string, SimpleTwin>;
  alerts: PlayerAlert[];
  minute: number;
  positions: { x: number; y: number }[];
}

function FatigueColor(fatigue: number): string {
  if (fatigue > 80) return '#EF4444';
  if (fatigue > 60) return '#F59E0B';
  if (fatigue > 40) return '#3B82F6';
  return '#22C55E';
}

function PlayerCard({
  player,
  metrics,
  twin,
}: {
  player: Player;
  metrics?: TrackingMetrics;
  twin?: SimpleTwin;
}) {
  const fatigue = twin?.fatigue ?? 0;
  const surname = player.name.split(' ').pop() || player.name;
  const hrCurrent = metrics?.heartRate?.current;
  const hrZone = hrCurrent
    ? hrCurrent > 175
      ? 5
      : hrCurrent > 165
      ? 4
      : hrCurrent > 155
      ? 3
      : hrCurrent > 145
      ? 2
      : 1
    : 0;

  return (
    <div className="bg-[#252A31] rounded-lg border border-[#2F343C] p-3">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ background: '#CD4246' }}
          >
            {player.number}
          </div>
          <div>
            <div className="text-[12px] font-semibold text-[#F6F7F9]">{surname}</div>
            <div className="text-[10px] text-[#5F6B7C]">{player.position}</div>
          </div>
        </div>
        {/* Fatigue badge */}
        <div
          className="px-2 py-0.5 rounded text-[10px] font-bold"
          style={{
            background: `${FatigueColor(fatigue)}22`,
            color: FatigueColor(fatigue),
          }}
        >
          {fatigue}%
        </div>
      </div>

      {/* Metrics grid */}
      {metrics ? (
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div className="bg-[#1C2127] rounded p-1.5">
            <div className="text-[#5F6B7C] flex items-center gap-1">
              <Activity className="w-3 h-3" /> Dist
            </div>
            <div className="text-[#F6F7F9] font-medium mt-0.5">
              {formatDistance(metrics.totalDistance)}
            </div>
          </div>
          <div className="bg-[#1C2127] rounded p-1.5">
            <div className="text-[#5F6B7C] flex items-center gap-1">
              <Zap className="w-3 h-3" /> Sprints
            </div>
            <div className="text-[#F6F7F9] font-medium mt-0.5">
              {metrics.accelerations.high}
            </div>
          </div>
          <div className="bg-[#1C2127] rounded p-1.5">
            <div className="text-[#5F6B7C] flex items-center gap-1">
              <Heart className="w-3 h-3" /> HR
            </div>
            <div className="text-[#F6F7F9] font-medium mt-0.5">
              {hrCurrent ? `${hrCurrent}` : '—'}
              {hrZone > 0 && (
                <span
                  className="ml-1"
                  style={{
                    color:
                      hrZone >= 4
                        ? '#EF4444'
                        : hrZone >= 3
                        ? '#F59E0B'
                        : '#22C55E',
                  }}
                >
                  Z{hrZone}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-[10px] text-[#5F6B7C] text-center py-2">No data</div>
      )}

      {/* Fatigue bar */}
      <div className="mt-2">
        <div className="h-1.5 bg-[#1C2127] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${fatigue}%`,
              background: FatigueColor(fatigue),
            }}
          />
        </div>
      </div>

      {/* Work rate */}
      {twin && (
        <div className="flex items-center justify-between mt-1.5 text-[9px]">
          <span className="text-[#5F6B7C]">Work Rate</span>
          <span
            style={{
              color: twin.currentWorkRate < 65 ? '#EF4444' : twin.currentWorkRate < 80 ? '#F59E0B' : '#22C55E',
            }}
          >
            {twin.currentWorkRate}%
          </span>
        </div>
      )}
    </div>
  );
}

export function PhysicalPerformance({
  players,
  liveData,
  twins,
  alerts,
  minute,
  positions,
}: PhysicalPerformanceProps) {
  const startingXI = players.slice(0, 11);

  // Physical alerts only
  const physicalAlerts = useMemo(
    () =>
      alerts
        .filter((a) => a.type === 'fatigue' || a.type === 'injury_risk' || a.type === 'physical')
        .slice(-8)
        .reverse(),
    [alerts]
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Mini pitch with fatigue dots */}
      <div className="flex-shrink-0 h-48 border-b border-[#2F343C] p-3">
        <div className="h-full bg-[#0d1f0d] rounded-lg relative overflow-hidden">
          <svg
            viewBox="0 0 105 68"
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Pitch lines */}
            <rect width="105" height="68" fill="#0d1f0d" />
            <rect x="0.5" y="0.5" width="104" height="67" fill="none" stroke="#1a3a1a" strokeWidth="0.3" />
            <line x1="52.5" y1="0.5" x2="52.5" y2="67.5" stroke="#1a3a1a" strokeWidth="0.3" />
            <circle cx="52.5" cy="34" r="9.15" fill="none" stroke="#1a3a1a" strokeWidth="0.3" />

            {/* Player dots colored by fatigue */}
            {startingXI.map((player, i) => {
              const pos = positions[i];
              if (!pos) return null;
              const twin = twins.get(player.id);
              const fatigue = twin?.fatigue ?? 0;
              const color = FatigueColor(fatigue);
              const surname = player.name.split(' ').pop() || player.name;
              // Scale position: x is 0-100 → 0-105, y is 0-100 → 0-68
              const px = (pos.x / 100) * 105;
              const py = (pos.y / 100) * 68;

              return (
                <g key={player.id}>
                  <circle cx={px} cy={py} r="3.5" fill={color} opacity="0.9" />
                  <text
                    x={px}
                    y={py + 0.8}
                    textAnchor="middle"
                    fill="white"
                    fontSize="2.8"
                    fontWeight="bold"
                  >
                    {player.number}
                  </text>
                  <text
                    x={px}
                    y={py + 6}
                    textAnchor="middle"
                    fill={color}
                    fontSize="2.2"
                    opacity="0.8"
                  >
                    {surname}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div className="absolute bottom-1 right-2 flex items-center gap-2 text-[8px]">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-white/50">&lt;40%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-white/50">40-60%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-white/50">60-80%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-white/50">&gt;80%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Player Cards Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {startingXI.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              metrics={liveData.get(player.id)}
              twin={twins.get(player.id)}
            />
          ))}
        </div>
      </div>

      {/* Bottom: Alerts panel */}
      <div className="flex-shrink-0 border-t border-[#2F343C] px-3 py-2 max-h-32 overflow-y-auto">
        <div className="flex items-center gap-1.5 mb-1.5">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          <span className="text-[9px] uppercase tracking-wider text-[#5F6B7C] font-medium">
            Physical Alerts
          </span>
        </div>
        {physicalAlerts.length === 0 ? (
          <div className="text-[10px] text-[#5F6B7C]">No physical alerts</div>
        ) : (
          <div className="space-y-1">
            {physicalAlerts.map((alert, i) => (
              <div
                key={i}
                className={`px-2 py-1 rounded text-[10px] ${
                  alert.severity === 'high'
                    ? 'bg-red-500/10 text-red-400'
                    : alert.severity === 'medium'
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-[#252A31] text-[#8F99A8]'
                }`}
              >
                {alert.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
