'use client';

import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import type { Player, TrackingMetrics, FormationPosition } from '@/types';

interface PitchViewProps {
  players: Player[];
  awayPlayers?: Player[];
  liveData?: Map<string, TrackingMetrics>;
  awayLiveData?: Map<string, TrackingMetrics>;
  formation?: { positions: FormationPosition[] };
  awayFormation?: { positions: FormationPosition[] };
  showHeatmap?: boolean;
  selectedPlayerId?: string | null;
  onPlayerClick?: (playerId: string | null) => void;
  className?: string;
  ballPosition?: { x: number; y: number };
  ballPossession?: 'home' | 'away';
}

// Standard formation positions for both teams
const HOME_POSITIONS: Record<string, { x: number; y: number }> = {
  GK: { x: 5, y: 50 },
  CB: { x: 18, y: 50 },
  'CB-L': { x: 18, y: 35 },
  'CB-R': { x: 18, y: 65 },
  LB: { x: 20, y: 12 },
  RB: { x: 20, y: 88 },
  CDM: { x: 32, y: 50 },
  'CDM-L': { x: 32, y: 40 },
  'CDM-R': { x: 32, y: 60 },
  CM: { x: 40, y: 50 },
  'CM-L': { x: 40, y: 35 },
  'CM-R': { x: 40, y: 65 },
  LM: { x: 40, y: 15 },
  RM: { x: 40, y: 85 },
  CAM: { x: 48, y: 50 },
  LW: { x: 45, y: 15 },
  RW: { x: 45, y: 85 },
  CF: { x: 48, y: 50 },
  ST: { x: 48, y: 50 },
  'ST-L': { x: 48, y: 40 },
  'ST-R': { x: 48, y: 60 },
  LWB: { x: 28, y: 8 },
  RWB: { x: 28, y: 92 },
};

// Away team positions (mirrored)
const AWAY_POSITIONS: Record<string, { x: number; y: number }> = {
  GK: { x: 95, y: 50 },
  CB: { x: 82, y: 50 },
  'CB-L': { x: 82, y: 35 },
  'CB-R': { x: 82, y: 65 },
  LB: { x: 80, y: 12 },
  RB: { x: 80, y: 88 },
  CDM: { x: 68, y: 50 },
  'CDM-L': { x: 68, y: 40 },
  'CDM-R': { x: 68, y: 60 },
  CM: { x: 60, y: 50 },
  'CM-L': { x: 60, y: 35 },
  'CM-R': { x: 60, y: 65 },
  LM: { x: 60, y: 15 },
  RM: { x: 60, y: 85 },
  CAM: { x: 52, y: 50 },
  LW: { x: 55, y: 15 },
  RW: { x: 55, y: 85 },
  CF: { x: 52, y: 50 },
  ST: { x: 52, y: 50 },
  'ST-L': { x: 52, y: 40 },
  'ST-R': { x: 52, y: 60 },
  LWB: { x: 72, y: 8 },
  RWB: { x: 72, y: 92 },
};

// 4-3-3 formation assignment for starting XI
function getFormationPosition(index: number, isHome: boolean): { x: number; y: number } {
  const positions = isHome ? [
    { x: 5, y: 50 },   // GK
    { x: 20, y: 88 },  // RB
    { x: 18, y: 65 },  // CB-R
    { x: 18, y: 35 },  // CB-L
    { x: 20, y: 12 },  // LB
    { x: 35, y: 50 },  // CDM
    { x: 40, y: 70 },  // CM-R
    { x: 40, y: 30 },  // CM-L
    { x: 45, y: 85 },  // RW
    { x: 48, y: 50 },  // ST
    { x: 45, y: 15 },  // LW
  ] : [
    { x: 95, y: 50 },  // GK
    { x: 80, y: 12 },  // RB (mirrored)
    { x: 82, y: 35 },  // CB-L (mirrored)
    { x: 82, y: 65 },  // CB-R (mirrored)
    { x: 80, y: 88 },  // LB (mirrored)
    { x: 65, y: 50 },  // CDM
    { x: 60, y: 30 },  // CM-L (mirrored)
    { x: 60, y: 70 },  // CM-R (mirrored)
    { x: 55, y: 15 },  // RW (mirrored)
    { x: 52, y: 50 },  // ST
    { x: 55, y: 85 },  // LW (mirrored)
  ];

  return positions[index] || { x: 50, y: 50 };
}

export function PitchView({
  players,
  awayPlayers = [],
  liveData,
  awayLiveData,
  formation,
  awayFormation,
  showHeatmap = false,
  selectedPlayerId,
  onPlayerClick,
  className,
  ballPosition,
  ballPossession,
}: PitchViewProps) {
  // Calculate home player positions on the pitch
  const homePlayerPositions = useMemo(() => {
    // Only show first 11 players (starting XI)
    const startingXI = players.slice(0, 11);

    return startingXI.map((player, index) => {
      const metrics = liveData?.get(player.id);

      // Use live position if available (already in percentage 0-100)
      if (metrics?.position) {
        return {
          player,
          x: metrics.position.x,
          y: metrics.position.y,
          metrics,
          isHome: true,
        };
      }

      // Use formation position based on index
      const pos = getFormationPosition(index, true);
      return { player, ...pos, metrics: undefined, isHome: true };
    });
  }, [players, liveData, formation]);

  // Calculate away player positions on the pitch
  const awayPlayerPositions = useMemo(() => {
    // Only show first 11 players (starting XI)
    const startingXI = awayPlayers.slice(0, 11);

    return startingXI.map((player, index) => {
      const metrics = awayLiveData?.get(player.id);

      // Use live position if available (already in percentage 0-100)
      if (metrics?.position) {
        return {
          player,
          x: metrics.position.x,
          y: metrics.position.y,
          metrics,
          isHome: false,
        };
      }

      // Use formation position based on index
      const pos = getFormationPosition(index, false);
      return { player, ...pos, metrics: undefined, isHome: false };
    });
  }, [awayPlayers, awayLiveData, awayFormation]);

  // Combine all players
  const allPlayerPositions = [...homePlayerPositions, ...awayPlayerPositions];

  return (
    <div className={cn('relative w-full aspect-[105/68] bg-green-600 rounded-lg overflow-hidden', className)}>
      {/* Pitch markings */}
      <svg
        viewBox="0 0 105 68"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grass pattern */}
        <defs>
          <pattern id="grassPattern" patternUnits="userSpaceOnUse" width="10.5" height="68">
            <rect x="0" y="0" width="5.25" height="68" fill="#4ade80" />
            <rect x="5.25" y="0" width="5.25" height="68" fill="#22c55e" />
          </pattern>
        </defs>
        <rect width="105" height="68" fill="url(#grassPattern)" />

        {/* Field outline */}
        <rect
          x="0.5"
          y="0.5"
          width="104"
          height="67"
          fill="none"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="0.4"
        />

        {/* Center line */}
        <line
          x1="52.5"
          y1="0.5"
          x2="52.5"
          y2="67.5"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="0.4"
        />

        {/* Center circle */}
        <circle
          cx="52.5"
          cy="34"
          r="9.15"
          fill="none"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="0.4"
        />

        {/* Center spot */}
        <circle cx="52.5" cy="34" r="0.6" fill="rgba(255,255,255,0.9)" />

        {/* Left penalty area */}
        <rect
          x="0.5"
          y="13.84"
          width="16.5"
          height="40.32"
          fill="none"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="0.4"
        />

        {/* Left goal area */}
        <rect
          x="0.5"
          y="24.84"
          width="5.5"
          height="18.32"
          fill="none"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="0.4"
        />

        {/* Left penalty spot */}
        <circle cx="11" cy="34" r="0.4" fill="rgba(255,255,255,0.9)" />

        {/* Left penalty arc */}
        <path
          d="M 16.5 27.5 A 9.15 9.15 0 0 1 16.5 40.5"
          fill="none"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="0.4"
        />

        {/* Right penalty area */}
        <rect
          x="88"
          y="13.84"
          width="16.5"
          height="40.32"
          fill="none"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="0.4"
        />

        {/* Right goal area */}
        <rect
          x="99"
          y="24.84"
          width="5.5"
          height="18.32"
          fill="none"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="0.4"
        />

        {/* Right penalty spot */}
        <circle cx="94" cy="34" r="0.4" fill="rgba(255,255,255,0.9)" />

        {/* Right penalty arc */}
        <path
          d="M 88.5 27.5 A 9.15 9.15 0 0 0 88.5 40.5"
          fill="none"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="0.4"
        />

        {/* Corner arcs */}
        <path d="M 0.5 1.5 A 1 1 0 0 0 1.5 0.5" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="0.4" />
        <path d="M 103.5 0.5 A 1 1 0 0 0 104.5 1.5" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="0.4" />
        <path d="M 104.5 66.5 A 1 1 0 0 0 103.5 67.5" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="0.4" />
        <path d="M 1.5 67.5 A 1 1 0 0 0 0.5 66.5" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="0.4" />

        {/* Goals */}
        <rect
          x="-2"
          y="30.34"
          width="2.5"
          height="7.32"
          fill="none"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="0.5"
        />
        <rect
          x="104.5"
          y="30.34"
          width="2.5"
          height="7.32"
          fill="none"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="0.5"
        />
      </svg>

      {/* Heatmap overlay */}
      {showHeatmap && liveData && (
        <div className="absolute inset-0 opacity-40">
          {/* Render heatmap cells */}
        </div>
      )}

      {/* Team Labels */}
      <div className="absolute top-2 left-4 px-2 py-1 bg-sky-600 text-white text-xs font-bold rounded shadow">
        MCI
      </div>
      <div className="absolute top-2 right-4 px-2 py-1 bg-red-600 text-white text-xs font-bold rounded shadow">
        MUN
      </div>

      {/* Players */}
      {allPlayerPositions.map(({ player, x, y, metrics, isHome }) => (
        <div
          key={player.id}
          className={cn(
            'absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300',
            selectedPlayerId === player.id && 'z-20'
          )}
          style={{
            left: `${x}%`,
            top: `${y}%`,
          }}
          onClick={() => onPlayerClick?.(player.id)}
        >
          {/* Player marker - smaller size */}
          <div
            className={cn(
              'relative w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-white text-[8px] md:text-[9px] font-bold shadow-md border',
              selectedPlayerId === player.id
                ? 'ring-2 ring-yellow-300 ring-offset-1 scale-125'
                : '',
              isHome
                ? 'bg-sky-500 border-sky-300'
                : 'bg-red-600 border-red-400',
              metrics && metrics.currentSpeed > 18 && 'animate-pulse'
            )}
          >
            {player.number}
          </div>

          {/* Player name tooltip */}
          <div className={cn(
            'absolute left-1/2 transform -translate-x-1/2 mt-1 px-2 py-1 text-white text-[10px] rounded whitespace-nowrap transition-opacity z-30',
            selectedPlayerId === player.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            isHome ? 'bg-sky-700/90' : 'bg-red-700/90'
          )}
          style={{ top: '100%' }}
          >
            <div className="font-semibold">{player.name.split(' ').pop()}</div>
            {metrics && (
              <div className="text-gray-200">
                {metrics.currentSpeed.toFixed(1)} km/h
              </div>
            )}
          </div>

          {/* Speed indicator - smaller */}
          {metrics && metrics.currentSpeed > 14 && (
            <div
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-white"
              style={{
                backgroundColor:
                  metrics.currentSpeed > 22
                    ? '#ef4444'
                    : metrics.currentSpeed > 17
                    ? '#f59e0b'
                    : '#22c55e',
              }}
            />
          )}
        </div>
      ))}

      {/* Ball - smaller with smooth movement */}
      {ballPosition && (
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 z-30 transition-all duration-100 ease-linear"
          style={{
            left: `${ballPosition.x}%`,
            top: `${ballPosition.y}%`,
          }}
        >
          <div
            className={cn(
              'w-3 h-3 md:w-3.5 md:h-3.5 rounded-full shadow-md border',
              'bg-white border-slate-300',
              ballPossession === 'home' && 'ring-1 ring-sky-400 ring-opacity-60',
              ballPossession === 'away' && 'ring-1 ring-red-400 ring-opacity-60'
            )}
          >
            {/* Simple ball pattern */}
            <svg viewBox="0 0 20 20" className="w-full h-full">
              <circle cx="10" cy="10" r="9" fill="white" stroke="#cbd5e1" strokeWidth="1.5" />
              <circle cx="10" cy="10" r="2.5" fill="#475569" />
              <circle cx="5" cy="6" r="1.5" fill="#475569" />
              <circle cx="15" cy="6" r="1.5" fill="#475569" />
              <circle cx="5" cy="14" r="1.5" fill="#475569" />
              <circle cx="15" cy="14" r="1.5" fill="#475569" />
            </svg>
          </div>
        </div>
      )}

      {/* Player count indicator */}
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-black/60 text-white text-xs rounded-full">
        {homePlayerPositions.length} vs {awayPlayerPositions.length}
      </div>
    </div>
  );
}
