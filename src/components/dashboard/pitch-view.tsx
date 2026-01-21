'use client';

import { cn } from '@/lib/utils';
import { useMemo, useState } from 'react';
import type { Player, TrackingMetrics, FormationPosition } from '@/types';

interface DefensiveBlock {
  team: 'home' | 'away';
  type: 'high' | 'mid' | 'low';
  lines: {
    defensive: { x: number; players: { x: number; y: number }[] };
    midfield: { x: number; players: { x: number; y: number }[] };
    forward: { x: number; players: { x: number; y: number }[] };
  };
}

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
  defensiveBlock?: DefensiveBlock;
  pressingIntensity?: number;
}

// 4-3-3 formation assignment for starting XI
function getFormationPosition(index: number, isHome: boolean): { x: number; y: number } {
  const positions = isHome ? [
    { x: 5, y: 50 },   // GK
    { x: 20, y: 85 },  // RB
    { x: 18, y: 62 },  // CB-R
    { x: 18, y: 38 },  // CB-L
    { x: 20, y: 15 },  // LB
    { x: 35, y: 50 },  // CDM
    { x: 42, y: 72 },  // CM-R
    { x: 42, y: 28 },  // CM-L
    { x: 48, y: 88 },  // RW
    { x: 52, y: 50 },  // ST
    { x: 48, y: 12 },  // LW
  ] : [
    { x: 95, y: 50 },  // GK
    { x: 80, y: 15 },  // RB
    { x: 82, y: 38 },  // CB-L
    { x: 82, y: 62 },  // CB-R
    { x: 80, y: 85 },  // LB
    { x: 65, y: 50 },  // CDM
    { x: 60, y: 28 },  // CM-L
    { x: 60, y: 72 },  // CM-R
    { x: 52, y: 12 },  // RW
    { x: 48, y: 50 },  // ST
    { x: 52, y: 88 },  // LW
  ];

  return positions[index] || { x: 50, y: 50 };
}

// Get surname from full name
function getSurname(name: string): string {
  const parts = name.split(' ');
  return parts[parts.length - 1];
}

// Calculate cover shadow angle
function calculateCoverShadow(
  defender: { x: number; y: number },
  ball: { x: number; y: number },
  attacker: { x: number; y: number }
): { angle: number; strength: number; isBlocking: boolean } {
  const dxBall = ball.x - defender.x;
  const dyBall = ball.y - defender.y;
  const distBall = Math.sqrt(dxBall * dxBall + dyBall * dyBall);

  const dxAtt = attacker.x - defender.x;
  const dyAtt = attacker.y - defender.y;
  const distAtt = Math.sqrt(dxAtt * dxAtt + dyAtt * dyAtt);

  // Angle to ball
  const angleToBall = Math.atan2(dyBall, dxBall) * (180 / Math.PI);

  // Is defender between ball and attacker?
  const crossProduct = (ball.x - defender.x) * (attacker.y - defender.y) -
                       (ball.y - defender.y) * (attacker.x - defender.x);
  const isBlocking = Math.abs(crossProduct) < 300 && distBall < 25;

  const strength = Math.max(0, 1 - distBall / 30);

  return { angle: angleToBall, strength, isBlocking };
}

export function PitchView({
  players,
  awayPlayers = [],
  liveData,
  awayLiveData,
  showHeatmap = false,
  selectedPlayerId,
  onPlayerClick,
  className,
  ballPosition,
  ballPossession,
  defensiveBlock,
  pressingIntensity = 0,
}: PitchViewProps) {
  // Analysis toggles
  const [showCoverShadows, setShowCoverShadows] = useState(true);
  const [showPassingLanes, setShowPassingLanes] = useState(false);
  const [showZones, setShowZones] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [selectedAnalysis, setSelectedAnalysis] = useState<string | null>(null);

  // Calculate home player positions
  const homePlayerPositions = useMemo(() => {
    const startingXI = players.slice(0, 11);
    return startingXI.map((player, index) => {
      const metrics = liveData?.get(player.id);
      if (metrics?.position) {
        return { player, x: metrics.position.x, y: metrics.position.y, metrics, isHome: true, index };
      }
      const pos = getFormationPosition(index, true);
      return { player, ...pos, metrics: undefined, isHome: true, index };
    });
  }, [players, liveData]);

  // Calculate away player positions
  const awayPlayerPositions = useMemo(() => {
    const startingXI = awayPlayers.slice(0, 11);
    return startingXI.map((player, index) => {
      const metrics = awayLiveData?.get(player.id);
      if (metrics?.position) {
        return { player, x: metrics.position.x, y: metrics.position.y, metrics, isHome: false, index };
      }
      const pos = getFormationPosition(index, false);
      return { player, ...pos, metrics: undefined, isHome: false, index };
    });
  }, [awayPlayers, awayLiveData]);

  // Calculate cover shadows for defending team
  const coverShadows = useMemo(() => {
    if (!showCoverShadows || !ballPosition) return [];

    const defenders = ballPossession === 'home' ? awayPlayerPositions : homePlayerPositions;
    const attackers = ballPossession === 'home' ? homePlayerPositions : awayPlayerPositions;

    const shadows: { from: { x: number; y: number }; angle: number; strength: number; name: string }[] = [];

    defenders.forEach((def) => {
      if (def.index === 0) return; // Skip GK

      // Find nearest attacker to shadow
      let nearestDist = 1000;
      let nearestAttacker = attackers[0];

      attackers.forEach((att) => {
        const dist = Math.sqrt(Math.pow(def.x - att.x, 2) + Math.pow(def.y - att.y, 2));
        if (dist < nearestDist && att.index !== 0) {
          nearestDist = dist;
          nearestAttacker = att;
        }
      });

      const shadow = calculateCoverShadow(
        { x: def.x, y: def.y },
        ballPosition,
        { x: nearestAttacker.x, y: nearestAttacker.y }
      );

      if (shadow.strength > 0.2) {
        shadows.push({
          from: { x: def.x, y: def.y },
          angle: shadow.angle,
          strength: shadow.strength,
          name: getSurname(def.player.name),
        });
      }
    });

    return shadows;
  }, [showCoverShadows, ballPosition, ballPossession, homePlayerPositions, awayPlayerPositions]);

  // Advanced analysis calculations
  const analysis = useMemo(() => {
    const homeXAvg = homePlayerPositions.reduce((sum, p) => sum + p.x, 0) / 11;
    const awayXAvg = awayPlayerPositions.reduce((sum, p) => sum + p.x, 0) / 11;

    // Compactness (vertical distance between lines)
    const homeDefLine = homePlayerPositions.filter((_, i) => i >= 1 && i <= 4);
    const homeFwdLine = homePlayerPositions.filter((_, i) => i >= 8 && i <= 10);
    const homeCompact = Math.abs(
      (homeFwdLine.reduce((s, p) => s + p.x, 0) / 3) -
      (homeDefLine.reduce((s, p) => s + p.x, 0) / 4)
    );

    const awayDefLine = awayPlayerPositions.filter((_, i) => i >= 1 && i <= 4);
    const awayFwdLine = awayPlayerPositions.filter((_, i) => i >= 8 && i <= 10);
    const awayCompact = Math.abs(
      (awayFwdLine.reduce((s, p) => s + p.x, 0) / 3) -
      (awayDefLine.reduce((s, p) => s + p.x, 0) / 4)
    );

    // Width
    const homeYs = homePlayerPositions.map(p => p.y);
    const awayYs = awayPlayerPositions.map(p => p.y);
    const homeWidth = Math.max(...homeYs) - Math.min(...homeYs);
    const awayWidth = Math.max(...awayYs) - Math.min(...awayYs);

    // Territory
    const territory = ballPosition ? (ballPosition.x < 50 ? 'home' : 'away') : 'neutral';

    // Overload detection
    const leftOverload = homePlayerPositions.filter(p => p.y < 35).length;
    const rightOverload = homePlayerPositions.filter(p => p.y > 65).length;

    return {
      homeXAvg: homeXAvg.toFixed(0),
      awayXAvg: awayXAvg.toFixed(0),
      homeCompact: homeCompact.toFixed(0),
      awayCompact: awayCompact.toFixed(0),
      homeWidth: homeWidth.toFixed(0),
      awayWidth: awayWidth.toFixed(0),
      territory,
      leftOverload,
      rightOverload,
      defensiveShape: defensiveBlock?.type || 'balanced',
    };
  }, [homePlayerPositions, awayPlayerPositions, ballPosition, defensiveBlock]);

  return (
    <div className={cn('relative w-full aspect-[105/68] bg-emerald-700 rounded-lg overflow-hidden', className)}>
      {/* Pitch markings SVG */}
      <svg viewBox="0 0 105 68" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="grass" patternUnits="userSpaceOnUse" width="10.5" height="68">
            <rect x="0" y="0" width="5.25" height="68" fill="#059669" />
            <rect x="5.25" y="0" width="5.25" height="68" fill="#047857" />
          </pattern>
        </defs>
        <rect width="105" height="68" fill="url(#grass)" />
        <rect x="0.5" y="0.5" width="104" height="67" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.3" />
        <line x1="52.5" y1="0.5" x2="52.5" y2="67.5" stroke="rgba(255,255,255,0.7)" strokeWidth="0.3" />
        <circle cx="52.5" cy="34" r="9.15" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.3" />
        <circle cx="52.5" cy="34" r="0.5" fill="rgba(255,255,255,0.8)" />
        <rect x="0.5" y="13.84" width="16.5" height="40.32" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.3" />
        <rect x="0.5" y="24.84" width="5.5" height="18.32" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.3" />
        <rect x="88" y="13.84" width="16.5" height="40.32" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.3" />
        <rect x="99" y="24.84" width="5.5" height="18.32" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.3" />
        <circle cx="11" cy="34" r="0.35" fill="rgba(255,255,255,0.8)" />
        <circle cx="94" cy="34" r="0.35" fill="rgba(255,255,255,0.8)" />
      </svg>

      {/* Zone overlays */}
      {showZones && (
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
          {/* 5 Vertical corridors */}
          <rect x="0" y="0" width="100" height="20" fill="rgba(147, 51, 234, 0.1)" stroke="rgba(147, 51, 234, 0.3)" strokeWidth="0.2" />
          <rect x="0" y="20" width="100" height="20" fill="rgba(59, 130, 246, 0.1)" stroke="rgba(59, 130, 246, 0.3)" strokeWidth="0.2" />
          <rect x="0" y="40" width="100" height="20" fill="rgba(34, 197, 94, 0.1)" stroke="rgba(34, 197, 94, 0.3)" strokeWidth="0.2" />
          <rect x="0" y="60" width="100" height="20" fill="rgba(59, 130, 246, 0.1)" stroke="rgba(59, 130, 246, 0.3)" strokeWidth="0.2" />
          <rect x="0" y="80" width="100" height="20" fill="rgba(147, 51, 234, 0.1)" stroke="rgba(147, 51, 234, 0.3)" strokeWidth="0.2" />
          {/* Half-spaces highlighted */}
          <text x="50" y="10" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="3">LEFT FLANK</text>
          <text x="50" y="30" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="3">LEFT HALF-SPACE</text>
          <text x="50" y="50" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="3">CENTRAL</text>
          <text x="50" y="70" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="3">RIGHT HALF-SPACE</text>
          <text x="50" y="90" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="3">RIGHT FLANK</text>
        </svg>
      )}

      {/* Cover Shadows Visualization */}
      {showCoverShadows && coverShadows.length > 0 && (
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
          <defs>
            <linearGradient id="shadowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(0,0,0,0.4)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </linearGradient>
          </defs>
          {coverShadows.map((shadow, idx) => {
            const length = 12 + shadow.strength * 8;
            const rad = shadow.angle * (Math.PI / 180);
            const endX = shadow.from.x + Math.cos(rad) * length;
            const endY = shadow.from.y + Math.sin(rad) * length;

            // Create cone shape for cover shadow
            const coneAngle = 15;
            const rad1 = (shadow.angle - coneAngle) * (Math.PI / 180);
            const rad2 = (shadow.angle + coneAngle) * (Math.PI / 180);
            const end1X = shadow.from.x + Math.cos(rad1) * length;
            const end1Y = shadow.from.y + Math.sin(rad1) * length;
            const end2X = shadow.from.x + Math.cos(rad2) * length;
            const end2Y = shadow.from.y + Math.sin(rad2) * length;

            return (
              <g key={idx}>
                {/* Shadow cone */}
                <polygon
                  points={`${shadow.from.x},${shadow.from.y} ${end1X},${end1Y} ${end2X},${end2Y}`}
                  fill={ballPossession === 'home' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)'}
                />
                {/* Shadow line */}
                <line
                  x1={shadow.from.x}
                  y1={shadow.from.y}
                  x2={endX}
                  y2={endY}
                  stroke={ballPossession === 'home' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.4)'}
                  strokeWidth="0.3"
                  strokeDasharray="1,0.5"
                />
              </g>
            );
          })}
        </svg>
      )}

      {/* Defensive Block Lines */}
      {defensiveBlock && defensiveBlock.lines && (
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
          {defensiveBlock.lines.defensive.players.length >= 2 && (
            <polyline
              points={defensiveBlock.lines.defensive.players.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={defensiveBlock.type === 'high' ? 'rgba(34, 197, 94, 0.6)' :
                      defensiveBlock.type === 'mid' ? 'rgba(251, 191, 36, 0.6)' :
                      'rgba(239, 68, 68, 0.6)'}
              strokeWidth="0.6"
            />
          )}
          {defensiveBlock.lines.midfield.players.length >= 2 && (
            <polyline
              points={defensiveBlock.lines.midfield.players.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="0.4"
              strokeDasharray="2,1"
            />
          )}
        </svg>
      )}

      {/* Passing Lanes (when toggled) */}
      {showPassingLanes && ballPosition && (
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
          {(ballPossession === 'home' ? homePlayerPositions : awayPlayerPositions).map((p, idx) => {
            if (p.index === 0) return null;
            const dist = Math.sqrt(Math.pow(p.x - ballPosition.x, 2) + Math.pow(p.y - ballPosition.y, 2));
            if (dist > 35) return null;

            return (
              <line
                key={idx}
                x1={ballPosition.x}
                y1={ballPosition.y}
                x2={p.x}
                y2={p.y}
                stroke={dist < 15 ? 'rgba(34, 197, 94, 0.5)' : dist < 25 ? 'rgba(251, 191, 36, 0.4)' : 'rgba(239, 68, 68, 0.3)'}
                strokeWidth="0.4"
                strokeDasharray="1,1"
              />
            );
          })}
        </svg>
      )}

      {/* Interactive Buttons */}
      <div className="absolute top-2 right-2 flex flex-col gap-1 z-40">
        <button
          onClick={() => setShowCoverShadows(!showCoverShadows)}
          className={cn(
            'px-2 py-1 text-[9px] font-medium rounded transition-all',
            showCoverShadows ? 'bg-purple-600 text-white' : 'bg-black/50 text-white/70 hover:bg-black/70'
          )}
        >
          Shadows
        </button>
        <button
          onClick={() => setShowPassingLanes(!showPassingLanes)}
          className={cn(
            'px-2 py-1 text-[9px] font-medium rounded transition-all',
            showPassingLanes ? 'bg-green-600 text-white' : 'bg-black/50 text-white/70 hover:bg-black/70'
          )}
        >
          Lanes
        </button>
        <button
          onClick={() => setShowZones(!showZones)}
          className={cn(
            'px-2 py-1 text-[9px] font-medium rounded transition-all',
            showZones ? 'bg-blue-600 text-white' : 'bg-black/50 text-white/70 hover:bg-black/70'
          )}
        >
          Zones
        </button>
        <button
          onClick={() => setShowAnalysis(!showAnalysis)}
          className={cn(
            'px-2 py-1 text-[9px] font-medium rounded transition-all',
            showAnalysis ? 'bg-amber-600 text-white' : 'bg-black/50 text-white/70 hover:bg-black/70'
          )}
        >
          Stats
        </button>
      </div>

      {/* Team Labels */}
      <div className="absolute top-2 left-2 flex items-center gap-2 z-30">
        <span className="px-2 py-0.5 bg-sky-600 text-white text-[10px] font-bold rounded">MCI</span>
        <span className="text-white/60 text-[10px]">vs</span>
        <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded">MUN</span>
      </div>

      {/* Block Type */}
      {defensiveBlock && (
        <div className={cn(
          'absolute top-9 left-2 px-2 py-0.5 rounded text-[9px] font-bold uppercase z-30',
          defensiveBlock.type === 'high' ? 'bg-green-500/90 text-white' :
          defensiveBlock.type === 'mid' ? 'bg-amber-500/90 text-white' :
          'bg-red-500/90 text-white'
        )}>
          {defensiveBlock.team === 'home' ? 'MCI' : 'MUN'} {defensiveBlock.type} block
        </div>
      )}

      {/* Advanced Analysis Panel */}
      {showAnalysis && (
        <div className="absolute bottom-12 left-2 bg-black/80 rounded-lg p-2 text-[9px] text-white z-40 min-w-[140px]">
          <div className="font-bold text-[10px] text-amber-400 mb-1 border-b border-white/20 pb-1">LIVE ANALYSIS</div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <div className="text-white/60">Avg Line MCI</div>
            <div className="text-sky-400 font-medium">{analysis.homeXAvg}%</div>

            <div className="text-white/60">Avg Line MUN</div>
            <div className="text-red-400 font-medium">{analysis.awayXAvg}%</div>

            <div className="text-white/60">Compact MCI</div>
            <div className={cn('font-medium', Number(analysis.homeCompact) < 30 ? 'text-green-400' : 'text-amber-400')}>
              {analysis.homeCompact}m
            </div>

            <div className="text-white/60">Compact MUN</div>
            <div className={cn('font-medium', Number(analysis.awayCompact) < 30 ? 'text-green-400' : 'text-amber-400')}>
              {analysis.awayCompact}m
            </div>

            <div className="text-white/60">Width MCI</div>
            <div className="text-white font-medium">{analysis.homeWidth}%</div>

            <div className="text-white/60">Width MUN</div>
            <div className="text-white font-medium">{analysis.awayWidth}%</div>
          </div>

          <div className="mt-1 pt-1 border-t border-white/20">
            <div className="flex justify-between">
              <span className="text-white/60">Territory</span>
              <span className={cn('font-medium',
                analysis.territory === 'home' ? 'text-sky-400' :
                analysis.territory === 'away' ? 'text-red-400' : 'text-white/60'
              )}>
                {analysis.territory === 'home' ? 'MCI HALF' : analysis.territory === 'away' ? 'MUN HALF' : 'NEUTRAL'}
              </span>
            </div>
            {analysis.leftOverload > 3 && (
              <div className="text-purple-400 mt-0.5">LEFT OVERLOAD ({analysis.leftOverload})</div>
            )}
            {analysis.rightOverload > 3 && (
              <div className="text-purple-400 mt-0.5">RIGHT OVERLOAD ({analysis.rightOverload})</div>
            )}
          </div>
        </div>
      )}

      {/* HOME Players */}
      {homePlayerPositions.map(({ player, x, y, metrics, index }) => (
        <div
          key={player.id}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20 group"
          style={{ left: `${x}%`, top: `${y}%` }}
          onClick={() => onPlayerClick?.(player.id)}
        >
          {/* Player circle */}
          <div className={cn(
            'w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shadow-lg border-2 transition-transform',
            selectedPlayerId === player.id ? 'scale-125 ring-2 ring-yellow-400' : 'hover:scale-110',
            'bg-gradient-to-br from-sky-400 to-sky-600 border-sky-300 text-white'
          )}>
            {player.number}
          </div>

          {/* Player name - always visible */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-4 whitespace-nowrap">
            <span className="px-1 py-0.5 bg-sky-900/90 text-white text-[8px] font-medium rounded shadow">
              {getSurname(player.name)}
            </span>
          </div>

          {/* Speed indicator */}
          {metrics && metrics.currentSpeed > 15 && (
            <div className={cn(
              'absolute -top-1 -right-1 w-2 h-2 rounded-full border border-white',
              metrics.currentSpeed > 22 ? 'bg-red-500 animate-pulse' :
              metrics.currentSpeed > 18 ? 'bg-amber-500' : 'bg-green-500'
            )} />
          )}

          {/* Hover stats */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-6 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
            <div className="bg-black/90 text-white text-[8px] px-2 py-1 rounded shadow-lg whitespace-nowrap">
              <div className="font-bold text-sky-400">{player.name}</div>
              {metrics && (
                <>
                  <div>Speed: {metrics.currentSpeed.toFixed(1)} km/h</div>
                  <div>Distance: {(metrics.totalDistance / 1000).toFixed(2)} km</div>
                </>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* AWAY Players */}
      {awayPlayerPositions.map(({ player, x, y, metrics, index }) => (
        <div
          key={player.id}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20 group"
          style={{ left: `${x}%`, top: `${y}%` }}
          onClick={() => onPlayerClick?.(player.id)}
        >
          {/* Player circle */}
          <div className={cn(
            'w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shadow-lg border-2 transition-transform',
            selectedPlayerId === player.id ? 'scale-125 ring-2 ring-yellow-400' : 'hover:scale-110',
            'bg-gradient-to-br from-red-500 to-red-700 border-red-400 text-white'
          )}>
            {player.number}
          </div>

          {/* Player name - always visible */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-4 whitespace-nowrap">
            <span className="px-1 py-0.5 bg-red-900/90 text-white text-[8px] font-medium rounded shadow">
              {getSurname(player.name)}
            </span>
          </div>

          {/* Speed indicator */}
          {metrics && metrics.currentSpeed > 15 && (
            <div className={cn(
              'absolute -top-1 -right-1 w-2 h-2 rounded-full border border-white',
              metrics.currentSpeed > 22 ? 'bg-red-500 animate-pulse' :
              metrics.currentSpeed > 18 ? 'bg-amber-500' : 'bg-green-500'
            )} />
          )}

          {/* Hover stats */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-6 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
            <div className="bg-black/90 text-white text-[8px] px-2 py-1 rounded shadow-lg whitespace-nowrap">
              <div className="font-bold text-red-400">{player.name}</div>
              {metrics && (
                <>
                  <div>Speed: {metrics.currentSpeed.toFixed(1)} km/h</div>
                  <div>Distance: {(metrics.totalDistance / 1000).toFixed(2)} km</div>
                </>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Ball */}
      {ballPosition && (
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 z-30 transition-all duration-75"
          style={{ left: `${ballPosition.x}%`, top: `${ballPosition.y}%` }}
        >
          <div className={cn(
            'w-4 h-4 rounded-full bg-white shadow-lg border-2',
            ballPossession === 'home' ? 'border-sky-400' : 'border-red-400'
          )}>
            <svg viewBox="0 0 20 20" className="w-full h-full">
              <circle cx="10" cy="10" r="8" fill="white" />
              <circle cx="10" cy="10" r="2" fill="#1e293b" />
              <circle cx="5" cy="6" r="1.2" fill="#1e293b" />
              <circle cx="15" cy="6" r="1.2" fill="#1e293b" />
              <circle cx="5" cy="14" r="1.2" fill="#1e293b" />
              <circle cx="15" cy="14" r="1.2" fill="#1e293b" />
            </svg>
          </div>
        </div>
      )}

      {/* Pressing Intensity Bar */}
      {pressingIntensity > 0 && (
        <div className="absolute bottom-2 right-2 flex items-center gap-2 px-2 py-1 bg-black/70 rounded z-30">
          <span className="text-white/70 text-[9px]">PRESS</span>
          <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                pressingIntensity > 80 ? 'bg-red-500' :
                pressingIntensity > 50 ? 'bg-amber-500' : 'bg-green-500'
              )}
              style={{ width: `${pressingIntensity}%` }}
            />
          </div>
          <span className={cn(
            'text-[10px] font-bold',
            pressingIntensity > 80 ? 'text-red-400' :
            pressingIntensity > 50 ? 'text-amber-400' : 'text-green-400'
          )}>
            {Math.round(pressingIntensity)}%
          </span>
        </div>
      )}

      {/* Player Count */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/60 text-white text-[9px] rounded z-30">
        {homePlayerPositions.length} v {awayPlayerPositions.length}
      </div>
    </div>
  );
}
