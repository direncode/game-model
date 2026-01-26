'use client';

/**
 * CoherenceSystemDashboard - Main Dashboard for Game Model Coherence System
 *
 * Displays all features of the advanced coherence scoring algorithm:
 * - Overall coherence score with confidence
 * - 15-dimensional breakdown
 * - Player-by-player analysis
 * - Temporal trends and predictions
 * - Bayesian confidence metrics
 * - Alerts and recommendations
 */

import React from 'react';
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Target,
  Zap,
  Brain,
  Gauge,
} from 'lucide-react';

// Types for the coherence result - simplified interface for UI display
export interface CoherenceDisplayData {
  overallScore: number;
  confidence: number;
  trend: 'improving' | 'stable' | 'declining';
  timestamp: Date;

  dimensions: {
    breakdown: Array<{
      name: string;
      score: number;
      weight: number;
      subComponents: Array<{ name: string; score: number }>;
    }>;
  };

  playerAnalysis: Array<{
    playerId: string;
    playerName: string;
    coherenceScore: number;
    positionDeviation: number;
    riskLevel: 'low' | 'medium' | 'high';
  }>;

  predictions: {
    shortTerm: { predicted: number; confidence: number };
    mediumTerm: { predicted: number; confidence: number };
    longTerm: { predicted: number; confidence: number };
    scenarios: Array<{ name: string; impact: number; probability: number }>;
  };

  momentum: { value: number; direction: 'positive' | 'negative' | 'neutral' };

  bayesian: {
    prior: number;
    posterior: number;
    likelihood: number;
  };

  phase: {
    current: string;
    effectiveness: number;
  };

  alerts: Array<{
    type: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    timestamp: string;
  }>;

  recommendations: Array<{
    type: string;
    priority: 'low' | 'medium' | 'high';
    action: string;
    expectedImpact: number;
  }>;
}

interface CoherenceSystemDashboardProps {
  data: CoherenceDisplayData | null;
  isLive: boolean;
  compact?: boolean;
}

// Score color helper
const getScoreColor = (score: number): string => {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
};

const getScoreBarColor = (score: number): string => {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
};

const getTrendIcon = (trend: 'improving' | 'stable' | 'declining') => {
  if (trend === 'improving') return <TrendingUp className="w-3 h-3 text-emerald-400" />;
  if (trend === 'declining') return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-white/40" />;
};

export function CoherenceSystemDashboard({ data, isLive, compact = false }: CoherenceSystemDashboardProps) {
  if (!data) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-900/50 rounded-xl">
        <div className="text-center">
          <Activity className="w-8 h-8 text-white/20 mx-auto mb-2" />
          <p className="text-xs text-white/40">Waiting for match data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-900 rounded-xl overflow-hidden">
      {/* Header - Overall Score */}
      <div className="flex-shrink-0 p-3 bg-black/40 border-b border-white/5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-sky-400" />
            <span className="text-xs uppercase tracking-wider text-sky-400 font-medium">Coherence Score</span>
            {isLive && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] text-white/40">LIVE</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {getTrendIcon(data.trend)}
          </div>
        </div>

        {/* Main Score Display */}
        <div className="flex items-end gap-3">
          <div className={`text-4xl font-bold tabular-nums ${getScoreColor(data.overallScore)}`}>
            {Math.round(data.overallScore)}
          </div>
          <div className="flex flex-col mb-1">
            <span className="text-xs text-white/40">/ 100</span>
            <span className="text-[10px] text-white/30">
              {(data.confidence * 100).toFixed(0)}% confidence
            </span>
          </div>
          <div className="flex-1 ml-4">
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full ${getScoreBarColor(data.overallScore)} transition-all duration-500`}
                style={{ width: `${data.overallScore}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Dimensions Grid */}
        <div className="p-3 border-b border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-3 h-3 text-violet-400" />
            <span className="text-[10px] uppercase tracking-wider text-violet-400">Dimensions</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {data.dimensions.breakdown.map((dim) => (
              <div key={dim.name} className="p-2 bg-white/5 rounded">
                <div className="text-[9px] text-white/50 mb-1 truncate">{dim.name}</div>
                <div className={`text-sm font-bold ${getScoreColor(dim.score)}`}>
                  {Math.round(dim.score)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Players at Risk */}
        {data.playerAnalysis.filter(p => p.riskLevel !== 'low').length > 0 && (
          <div className="p-3 border-b border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] uppercase tracking-wider text-amber-400">Players at Risk</span>
            </div>
            <div className="space-y-1">
              {data.playerAnalysis.filter(p => p.riskLevel !== 'low').map((player) => (
                <div key={player.playerId} className="flex items-center justify-between p-1.5 bg-amber-500/10 rounded">
                  <span className="text-xs text-white/80">{player.playerName}</span>
                  <span className={`text-[10px] px-1.5 rounded ${
                    player.riskLevel === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {player.coherenceScore.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Predictions */}
        <div className="p-3 border-b border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-3 h-3 text-cyan-400" />
            <span className="text-[10px] uppercase tracking-wider text-cyan-400">Predictions</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 bg-white/5 rounded text-center">
              <div className="text-[9px] text-white/40">5 min</div>
              <div className={`text-sm font-bold ${getScoreColor(data.predictions.shortTerm.predicted)}`}>
                {data.predictions.shortTerm.predicted.toFixed(0)}
              </div>
            </div>
            <div className="p-2 bg-white/5 rounded text-center">
              <div className="text-[9px] text-white/40">15 min</div>
              <div className={`text-sm font-bold ${getScoreColor(data.predictions.mediumTerm.predicted)}`}>
                {data.predictions.mediumTerm.predicted.toFixed(0)}
              </div>
            </div>
            <div className="p-2 bg-white/5 rounded text-center">
              <div className="text-[9px] text-white/40">End</div>
              <div className={`text-sm font-bold ${getScoreColor(data.predictions.longTerm.predicted)}`}>
                {data.predictions.longTerm.predicted.toFixed(0)}
              </div>
            </div>
          </div>
        </div>

        {/* Bayesian */}
        <div className="p-3 border-b border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-3 h-3 text-orange-400" />
            <span className="text-[10px] uppercase tracking-wider text-orange-400">Bayesian</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-center">
              <div className="text-[9px] text-white/40">Prior</div>
              <div className="text-sm text-white/60">{data.bayesian.prior.toFixed(0)}</div>
            </div>
            <div className="text-lg text-white/30">→</div>
            <div className="text-center">
              <div className="text-[9px] text-orange-400">Posterior</div>
              <div className="text-sm font-bold text-orange-400">{data.bayesian.posterior.toFixed(0)}</div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {data.alerts.length > 0 && (
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-3 h-3 text-red-400" />
              <span className="text-[10px] uppercase tracking-wider text-red-400">
                Alerts ({data.alerts.length})
              </span>
            </div>
            <div className="space-y-1">
              {data.alerts.map((alert, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded text-[10px] ${
                    alert.severity === 'critical' ? 'bg-red-500/10 text-red-300' :
                    alert.severity === 'warning' ? 'bg-amber-500/10 text-amber-300' :
                    'bg-blue-500/10 text-blue-300'
                  }`}
                >
                  <div className="font-medium">{alert.type}</div>
                  <div className="text-white/60">{alert.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CoherenceSystemDashboard;
