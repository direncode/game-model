'use client';

import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import type { Player, TrackingMetrics, FormationPosition } from '@/types';

interface PitchViewProps {
  players: Player[];
  liveData?: Map<string, TrackingMetrics>;
  formation?: { positions: FormationPosition[] };
  showHeatmap?: boolean;
  selectedPlayerId?: string | null;
  onPlayerClick?: (playerId: string) => void;
  className?: string;
}

export function PitchView({
  players,
  liveData,
  formation,
  showHeatmap = false,
  selectedPlayerId,
  onPlayerClick,
  className,
}: PitchViewProps) {
  // Calculate player positions on the pitch
  const playerPositions = useMemo(() => {
    return players.map((player) => {
      const metrics = liveData?.get(player.id);

      // Use live position if available, otherwise use formation position
      if (metrics?.position) {
        return {
          player,
          x: 50 + (metrics.position.x / 52.5) * 45, // Convert to percentage
          y: 50 + (metrics.position.y / 34) * 45,
          metrics,
        };
      }

      // Use formation position
      const formationPos = formation?.positions.find(
        (p) => p.role === player.position
      );
      if (formationPos) {
        return {
          player,
          x: formationPos.baseX,
          y: formationPos.baseY,
          metrics: undefined,
        };
      }

      // Default positions based on player position
      const defaultPositions: Record<string, { x: number; y: number }> = {
        GK: { x: 8, y: 50 },
        CB: { x: 20, y: 50 },
        LB: { x: 22, y: 15 },
        RB: { x: 22, y: 85 },
        CDM: { x: 35, y: 50 },
        CM: { x: 45, y: 50 },
        LM: { x: 45, y: 20 },
        RM: { x: 45, y: 80 },
        CAM: { x: 55, y: 50 },
        LW: { x: 70, y: 15 },
        RW: { x: 70, y: 85 },
        CF: { x: 80, y: 50 },
        ST: { x: 85, y: 50 },
        LWB: { x: 30, y: 10 },
        RWB: { x: 30, y: 90 },
      };

      const pos = defaultPositions[player.position] || { x: 50, y: 50 };
      return { player, ...pos, metrics: undefined };
    });
  }, [players, liveData, formation]);

  return (
    <div className={cn('relative w-full aspect-[105/68] bg-green-600 rounded-lg overflow-hidden', className)}>
      {/* Pitch markings */}
      <svg
        viewBox="0 0 105 68"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Field outline */}
        <rect
          x="0.5"
          y="0.5"
          width="104"
          height="67"
          fill="none"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="0.3"
        />

        {/* Center line */}
        <line
          x1="52.5"
          y1="0.5"
          x2="52.5"
          y2="67.5"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="0.3"
        />

        {/* Center circle */}
        <circle
          cx="52.5"
          cy="34"
          r="9.15"
          fill="none"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="0.3"
        />

        {/* Center spot */}
        <circle cx="52.5" cy="34" r="0.5" fill="rgba(255,255,255,0.6)" />

        {/* Left penalty area */}
        <rect
          x="0.5"
          y="13.84"
          width="16.5"
          height="40.32"
          fill="none"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="0.3"
        />

        {/* Left goal area */}
        <rect
          x="0.5"
          y="24.84"
          width="5.5"
          height="18.32"
          fill="none"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="0.3"
        />

        {/* Left penalty spot */}
        <circle cx="11" cy="34" r="0.5" fill="rgba(255,255,255,0.6)" />

        {/* Right penalty area */}
        <rect
          x="88"
          y="13.84"
          width="16.5"
          height="40.32"
          fill="none"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="0.3"
        />

        {/* Right goal area */}
        <rect
          x="99"
          y="24.84"
          width="5.5"
          height="18.32"
          fill="none"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="0.3"
        />

        {/* Right penalty spot */}
        <circle cx="94" cy="34" r="0.5" fill="rgba(255,255,255,0.6)" />

        {/* Goals */}
        <rect
          x="-2"
          y="30.34"
          width="2.5"
          height="7.32"
          fill="none"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="0.3"
        />
        <rect
          x="104.5"
          y="30.34"
          width="2.5"
          height="7.32"
          fill="none"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="0.3"
        />
      </svg>

      {/* Heatmap overlay */}
      {showHeatmap && liveData && (
        <div className="absolute inset-0 opacity-40">
          {/* Render heatmap cells */}
        </div>
      )}

      {/* Players */}
      {playerPositions.map(({ player, x, y, metrics }) => (
        <div
          key={player.id}
          className={cn(
            'absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300',
            selectedPlayerId === player.id && 'z-10'
          )}
          style={{
            left: `${x}%`,
            top: `${y}%`,
          }}
          onClick={() => onPlayerClick?.(player.id)}
        >
          {/* Player marker */}
          <div
            className={cn(
              'relative w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg',
              selectedPlayerId === player.id
                ? 'bg-yellow-500 ring-2 ring-yellow-300'
                : 'bg-blue-600',
              metrics && metrics.currentSpeed > 20 && 'animate-pulse'
            )}
          >
            {player.number}
          </div>

          {/* Player name tooltip */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 px-2 py-0.5 bg-black/80 text-white text-xs rounded whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity">
            {player.name}
            {metrics && (
              <span className="ml-1 text-gray-300">
                {metrics.currentSpeed.toFixed(1)} km/h
              </span>
            )}
          </div>

          {/* Speed indicator */}
          {metrics && metrics.currentSpeed > 15 && (
            <div
              className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
              style={{
                backgroundColor:
                  metrics.currentSpeed > 25
                    ? '#ef4444'
                    : metrics.currentSpeed > 20
                    ? '#f59e0b'
                    : '#22c55e',
              }}
            />
          )}
        </div>
      ))}

      {/* Pitch thirds overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-0 top-0 w-1/3 h-full border-r border-white/20" />
        <div className="absolute right-0 top-0 w-1/3 h-full border-l border-white/20" />
      </div>
    </div>
  );
}
