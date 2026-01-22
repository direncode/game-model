'use client';

import { cn } from '@/lib/utils';
import { useMemo, useState, useEffect } from 'react';
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

// Advanced analytics interfaces
interface AdvancedAnalytics {
  xG: { home: number; away: number };
  passingNetwork?: PassingNetworkData;
  heatmap?: HeatmapData;
  pressingTraps?: PressingTrapData[];
  phaseTransitions?: PhaseData[];
}

interface PassingNetworkData {
  nodes: { id: string; x: number; y: number; passes: number; influence: number }[];
  edges: { from: string; to: string; weight: number; progressive: number }[];
}

interface HeatmapData {
  grid: number[][];
  resolution: { x: number; y: number };
  hotspots: { x: number; y: number; intensity: number }[];
}

interface PressingTrapData {
  zone: { x: number; y: number; width: number; height: number };
  type: string;
  successRate: number;
}

interface PhaseData {
  from: string;
  to: string;
  avgTime: number;
  successRate: number;
}

interface PsychologyData {
  homeMorale: number;
  awayMorale: number;
  homeMomentum: number;
  awayMomentum: number;
  crowdVolume: number;
  crowdTension: number;
}

interface TacticalDecision {
  type: string;
  confidence: number;
  urgency: number;
  reasoning: string;
}

// Pattern Recognition Interfaces
interface TacticalPattern {
  id: string;
  type: string;
  team: 'home' | 'away';
  confidence: number;
  frequency: number;
  lastSeen: number;
  players: string[];
  zone: string;
  description: string;
  counterPattern?: string;
  synergies: string[];
}

interface CompoundingEffect {
  type: 'synergy' | 'fatigue' | 'psychological' | 'positional' | 'tactical_shift';
  description: string;
  magnitude: number;
  affectedPlayers: string[];
  duration: number;
}

interface PatternLog {
  id: string;
  timestamp: number;
  pattern: TacticalPattern;
  triggerEvent: string;
  outcome: {
    success: boolean;
    result: string;
    duration: number;
    endZone: string;
  };
  xGCreated: number;
  xGConceded: number;
  compoundingEffects: CompoundingEffect[];
}

interface TacticalCoherence {
  gameModel: string;
  coherenceScore: number;
  deviations: { pattern: string; deviation: number; reason: string }[];
  suggestions: string[];
  historicalComparison: { avgCoherence: number; trend: 'improving' | 'declining' | 'stable' };
}

interface RecurrentSequence {
  id: string;
  patterns: string[];
  team: 'home' | 'away';
  occurrences: number;
  successRate: number;
  description: string;
}

interface MarkovTransition {
  from: string;
  to: string;
  probability: number;
  successRate: number;
}

interface MarkovData {
  recurrentSequences: RecurrentSequence[];
  currentChains: { home: string; away: string };
  topTransitions: { home: MarkovTransition[]; away: MarkovTransition[] };
  predictedNext: { home: string | null; away: string | null };
}

interface PatternRecognitionData {
  activePatterns: { home: TacticalPattern[]; away: TacticalPattern[] };
  recentLogs: PatternLog[];
  compoundingEffects: CompoundingEffect[];
  coherence: { home: TacticalCoherence | null; away: TacticalCoherence | null };
  markov?: MarkovData;
}

// Fatigue/Wearable Data Interfaces (Catapult Integration)
interface FatigueModel {
  playerId: string;
  currentFatigue: number;
  muscularFatigue: number;
  cardiovascularFatigue: number;
  neuromuscularFatigue: number;
  predictedFatigueIn5Min: number;
  predictedFatigueIn15Min: number;
  optimalSubstitutionMinute: number | null;
  speedModifier: number;
  accelerationModifier: number;
  decisionModifier: number;
  coverShadowModifier: number;
}

interface InjuryRiskModel {
  playerId: string;
  overallRisk: number;
  hamstringRisk: number;
  quadRisk: number;
  ankleRisk: number;
  calfRisk: number;
  groinRisk: number;
  acuteChronicRatio: number;
  recommendations: string[];
}

interface FatigueData {
  home: Map<string, FatigueModel>;
  away: Map<string, FatigueModel>;
  injuryRisks: Map<string, InjuryRiskModel>;
  recommendations: {
    substitutionTargets: { playerId: string; priority: 'urgent' | 'soon' | 'optional'; reason: string }[];
    pressingAdjustments: { recommendation: string; affectedPlayers: string[] }[];
    formationSuggestions: string[];
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
  // Advanced features
  analytics?: AdvancedAnalytics;
  psychology?: PsychologyData;
  tacticalDecisions?: TacticalDecision[];
  showAdvancedMode?: boolean;
  // Pattern Recognition
  patternRecognition?: PatternRecognitionData;
  // Fatigue/Wearable Data (Catapult GPS Integration)
  fatigueData?: FatigueData;
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
  analytics,
  psychology,
  tacticalDecisions = [],
  showAdvancedMode = false,
  patternRecognition,
  fatigueData,
}: PitchViewProps) {
  // iPad/Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024 || /iPad|iPhone|iPod|Android/i.test(navigator.userAgent);
      setIsMobile(mobile);
      // Auto-collapse panels on mobile
      if (mobile) {
        setShowLeftPanel(false);
        setShowRightPanel(false);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Analysis toggles - ALL OFF by default for clean match view
  const [showCoverShadows, setShowCoverShadows] = useState(false);
  const [showPassingLanes, setShowPassingLanes] = useState(false);
  const [showZones, setShowZones] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<string | null>(null);
  // Advanced toggles - ALL OFF by default for clean match view
  const [showXGMap, setShowXGMap] = useState(false);
  const [showHeatmapOverlay, setShowHeatmapOverlay] = useState(false);
  const [showPassingNetwork, setShowPassingNetwork] = useState(false);
  const [showPsychology, setShowPsychology] = useState(false);
  const [showAIDecisions, setShowAIDecisions] = useState(false);
  const [showPressingTraps, setShowPressingTraps] = useState(false);
  const [showTacticalLogs, setShowTacticalLogs] = useState(false);
  const [showCoherence, setShowCoherence] = useState(false);
  const [showMarkovChains, setShowMarkovChains] = useState(false);
  const [showFatigue, setShowFatigue] = useState(false);

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

  // Calculate cover shadows for defending team (with fatigue adjustments)
  const coverShadows = useMemo(() => {
    if (!showCoverShadows || !ballPosition) return [];

    const defenders = ballPossession === 'home' ? awayPlayerPositions : homePlayerPositions;
    const attackers = ballPossession === 'home' ? homePlayerPositions : awayPlayerPositions;
    const defenderFatigueMap = ballPossession === 'home' ? fatigueData?.away : fatigueData?.home;

    const shadows: {
      from: { x: number; y: number };
      angle: number;
      strength: number;
      name: string;
      fatigueModifier: number;
      fatigue: number;
    }[] = [];

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

      // Get fatigue modifier for this defender (from Catapult data)
      const playerFatigue = defenderFatigueMap?.get(def.player.id);
      const fatigueModifier = playerFatigue?.coverShadowModifier ?? 1.0;
      const currentFatigue = playerFatigue?.currentFatigue ?? 0;

      // Apply fatigue modifier to shadow strength
      const adjustedStrength = shadow.strength * fatigueModifier;

      if (adjustedStrength > 0.15) {
        shadows.push({
          from: { x: def.x, y: def.y },
          angle: shadow.angle,
          strength: adjustedStrength,
          name: getSurname(def.player.name),
          fatigueModifier,
          fatigue: currentFatigue,
        });
      }
    });

    return shadows;
  }, [showCoverShadows, ballPosition, ballPossession, homePlayerPositions, awayPlayerPositions, fatigueData]);

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

      {/* xG Map Overlay - Expected Goals zones */}
      {showXGMap && (
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
          <defs>
            <radialGradient id="xgGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(239, 68, 68, 0.6)" />
              <stop offset="50%" stopColor="rgba(251, 191, 36, 0.3)" />
              <stop offset="100%" stopColor="rgba(34, 197, 94, 0.1)" />
            </radialGradient>
          </defs>
          {/* High xG zones near goals */}
          <ellipse cx="5" cy="50" rx="12" ry="20" fill="url(#xgGradient)" opacity="0.5" />
          <ellipse cx="95" cy="50" rx="12" ry="20" fill="url(#xgGradient)" opacity="0.5" />
          {/* 6-yard box - highest xG */}
          <rect x="0" y="36" width="6" height="28" fill="rgba(239, 68, 68, 0.4)" />
          <rect x="94" y="36" width="6" height="28" fill="rgba(239, 68, 68, 0.4)" />
          {/* Penalty spot markers */}
          <circle cx="11" cy="50" r="1.5" fill="rgba(255, 255, 255, 0.3)" />
          <circle cx="89" cy="50" r="1.5" fill="rgba(255, 255, 255, 0.3)" />
          {/* xG labels */}
          <text x="5" y="48" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="2.5" fontWeight="bold">HIGH xG</text>
          <text x="95" y="48" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="2.5" fontWeight="bold">HIGH xG</text>
        </svg>
      )}

      {/* Heatmap Overlay */}
      {showHeatmapOverlay && analytics?.heatmap && (
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
          <defs>
            <linearGradient id="heatGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(59, 130, 246, 0.5)" />
              <stop offset="50%" stopColor="rgba(251, 191, 36, 0.5)" />
              <stop offset="100%" stopColor="rgba(239, 68, 68, 0.7)" />
            </linearGradient>
          </defs>
          {/* Render hotspots */}
          {analytics.heatmap.hotspots.map((spot, idx) => (
            <circle
              key={idx}
              cx={spot.x}
              cy={spot.y}
              r={3 + spot.intensity * 4}
              fill={`rgba(239, 68, 68, ${0.2 + spot.intensity * 0.4})`}
            />
          ))}
        </svg>
      )}

      {/* Passing Network Visualization */}
      {showPassingNetwork && analytics?.passingNetwork && (
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
          {/* Network edges (passes between players) */}
          {analytics.passingNetwork.edges.map((edge, idx) => {
            const fromNode = analytics.passingNetwork!.nodes.find(n => n.id === edge.from);
            const toNode = analytics.passingNetwork!.nodes.find(n => n.id === edge.to);
            if (!fromNode || !toNode) return null;
            const strokeWidth = Math.min(0.8, edge.weight / 15);
            const isProgressive = edge.progressive > edge.weight * 0.3;
            return (
              <line
                key={idx}
                x1={fromNode.x}
                y1={fromNode.y}
                x2={toNode.x}
                y2={toNode.y}
                stroke={isProgressive ? 'rgba(34, 197, 94, 0.6)' : 'rgba(56, 189, 248, 0.4)'}
                strokeWidth={strokeWidth}
              />
            );
          })}
          {/* Network nodes (players) */}
          {analytics.passingNetwork.nodes.map((node, idx) => (
            <g key={idx}>
              <circle
                cx={node.x}
                cy={node.y}
                r={1.5 + node.influence * 3}
                fill="rgba(56, 189, 248, 0.3)"
                stroke="rgba(56, 189, 248, 0.8)"
                strokeWidth="0.3"
              />
              <text
                x={node.x}
                y={node.y + 0.5}
                textAnchor="middle"
                fill="white"
                fontSize="1.8"
                fontWeight="bold"
              >
                {node.passes}
              </text>
            </g>
          ))}
        </svg>
      )}

      {/* Pressing Traps Visualization */}
      {showPressingTraps && analytics?.pressingTraps && (
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
          {analytics.pressingTraps.map((trap, idx) => (
            <g key={idx}>
              <rect
                x={trap.zone.x}
                y={trap.zone.y}
                width={trap.zone.width}
                height={trap.zone.height}
                fill={trap.successRate > 0.6 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(251, 191, 36, 0.2)'}
                stroke={trap.successRate > 0.6 ? 'rgba(34, 197, 94, 0.6)' : 'rgba(251, 191, 36, 0.6)'}
                strokeWidth="0.3"
                strokeDasharray="2,1"
              />
              <text
                x={trap.zone.x + trap.zone.width / 2}
                y={trap.zone.y + trap.zone.height / 2}
                textAnchor="middle"
                fill="rgba(255,255,255,0.7)"
                fontSize="2"
              >
                TRAP {(trap.successRate * 100).toFixed(0)}%
              </text>
            </g>
          ))}
        </svg>
      )}

      {/* Cover Shadows Visualization (Fatigue-Adjusted) */}
      {showCoverShadows && coverShadows.length > 0 && (
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
          <defs>
            <linearGradient id="shadowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(0,0,0,0.4)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </linearGradient>
          </defs>
          {coverShadows.map((shadow, idx) => {
            // Fatigue-adjusted length: fatigued players have shorter shadows
            const baseLength = 12 + shadow.strength * 8;
            const length = baseLength * shadow.fatigueModifier;
            const rad = shadow.angle * (Math.PI / 180);
            const endX = shadow.from.x + Math.cos(rad) * length;
            const endY = shadow.from.y + Math.sin(rad) * length;

            // Fatigue-adjusted cone angle: fatigued players have narrower cones
            const baseConeAngle = 15;
            const coneAngle = baseConeAngle * shadow.fatigueModifier;
            const rad1 = (shadow.angle - coneAngle) * (Math.PI / 180);
            const rad2 = (shadow.angle + coneAngle) * (Math.PI / 180);
            const end1X = shadow.from.x + Math.cos(rad1) * length;
            const end1Y = shadow.from.y + Math.sin(rad1) * length;
            const end2X = shadow.from.x + Math.cos(rad2) * length;
            const end2Y = shadow.from.y + Math.sin(rad2) * length;

            // Color based on fatigue level: green (fresh) -> yellow -> orange -> red (fatigued)
            const getFatigueColor = (fatigue: number, opacity: number) => {
              if (fatigue > 70) return `rgba(239, 68, 68, ${opacity})`; // Red - critical
              if (fatigue > 50) return `rgba(251, 146, 60, ${opacity})`; // Orange - high
              if (fatigue > 30) return `rgba(251, 191, 36, ${opacity})`; // Yellow - moderate
              return `rgba(34, 197, 94, ${opacity})`; // Green - fresh
            };

            const shadowColor = showFatigue
              ? getFatigueColor(shadow.fatigue, 0.2)
              : ballPossession === 'home' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)';
            const lineColor = showFatigue
              ? getFatigueColor(shadow.fatigue, 0.5)
              : ballPossession === 'home' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.4)';

            return (
              <g key={idx}>
                {/* Shadow cone */}
                <polygon
                  points={`${shadow.from.x},${shadow.from.y} ${end1X},${end1Y} ${end2X},${end2Y}`}
                  fill={shadowColor}
                />
                {/* Shadow line */}
                <line
                  x1={shadow.from.x}
                  y1={shadow.from.y}
                  x2={endX}
                  y2={endY}
                  stroke={lineColor}
                  strokeWidth="0.3"
                  strokeDasharray="1,0.5"
                />
                {/* Fatigue indicator at shadow tip (when fatigue mode on) */}
                {showFatigue && shadow.fatigue > 40 && (
                  <text
                    x={endX}
                    y={endY - 1}
                    textAnchor="middle"
                    fill={getFatigueColor(shadow.fatigue, 0.9)}
                    fontSize="1.8"
                    fontWeight="bold"
                  >
                    {shadow.fatigue.toFixed(0)}%
                  </text>
                )}
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

      {/* HOME Players */}
      {homePlayerPositions.map(({ player, x, y, metrics, index }) => {
        return (
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

            {/* Player name */}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-4 whitespace-nowrap">
              <span className="px-1 py-0.5 text-white text-[8px] font-medium rounded shadow bg-sky-900/90">
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
        );
      })}

      {/* AWAY Players */}
      {awayPlayerPositions.map(({ player, x, y, metrics, index }) => {
        return (
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

            {/* Player name */}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-4 whitespace-nowrap">
              <span className="px-1 py-0.5 text-white text-[8px] font-medium rounded shadow bg-red-900/90">
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
        );
      })}

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

      {/* Clean pitch view - no overlays, buttons, or panels */}
    </div>
  );
}
