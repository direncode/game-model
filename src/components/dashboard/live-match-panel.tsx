'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CoherenceGauge, CoherenceBar } from './coherence-gauge';
import { PitchView } from './pitch-view';
import { cn } from '@/lib/utils';
import type {
  Player,
  GameModel,
  TrackingMetrics,
  CoherenceReport,
  PlayerAlert,
  TacticalDeviation,
} from '@/types';
import {
  Play,
  Pause,
  Square,
  AlertTriangle,
  Clock,
  Users,
  Activity,
  TrendingUp,
} from 'lucide-react';

interface LiveMatchPanelProps {
  players: Player[];
  gameModel: GameModel | null;
  liveData: Map<string, TrackingMetrics>;
  coherenceReport: CoherenceReport | null;
  alerts: PlayerAlert[];
  deviations: TacticalDeviation[];
  isLive: boolean;
  matchMinute: number;
  onStartMatch?: () => void;
  onPauseMatch?: () => void;
  onEndMatch?: () => void;
  selectedPlayerId: string | null;
  onPlayerSelect: (playerId: string | null) => void;
  className?: string;
}

export function LiveMatchPanel({
  players,
  gameModel,
  liveData,
  coherenceReport,
  alerts,
  deviations,
  isLive,
  matchMinute,
  onStartMatch,
  onPauseMatch,
  onEndMatch,
  selectedPlayerId,
  onPlayerSelect,
  className,
}: LiveMatchPanelProps) {
  const [isPaused, setIsPaused] = useState(false);

  // Calculate team averages
  const teamStats = useCallback(() => {
    const metricsArray = Array.from(liveData.values());
    if (metricsArray.length === 0) {
      return {
        avgDistance: 0,
        avgSpeed: 0,
        totalSprints: 0,
        avgCoherence: coherenceReport?.overallScore ?? 100,
      };
    }

    return {
      avgDistance: metricsArray.reduce((sum, m) => sum + m.totalDistance, 0) / metricsArray.length,
      avgSpeed: metricsArray.reduce((sum, m) => sum + m.averageSpeed, 0) / metricsArray.length,
      totalSprints: metricsArray.reduce((sum, m) => sum + m.accelerations.high, 0),
      avgCoherence: coherenceReport?.overallScore ?? 100,
    };
  }, [liveData, coherenceReport]);

  const stats = teamStats();

  const recentAlerts = alerts.slice(-5).reverse();
  const criticalDeviations = deviations.filter((d) => d.severity === 'major').slice(-3);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Match Controls */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <span>Live Match</span>
              {isLive && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  LIVE
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {!isLive ? (
                <Button onClick={onStartMatch} size="sm">
                  <Play className="w-4 h-4 mr-1" />
                  Start Match
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => {
                      setIsPaused(!isPaused);
                      onPauseMatch?.();
                    }}
                    variant="secondary"
                    size="sm"
                  >
                    {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </Button>
                  <Button onClick={onEndMatch} variant="danger" size="sm">
                    <Square className="w-4 h-4 mr-1" />
                    End
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Match Timer */}
          <div className="text-center mb-4">
            <span className="text-4xl font-bold text-gray-900">
              {Math.floor(matchMinute)}'
            </span>
            <span className="text-lg text-gray-500 ml-1">
              {matchMinute < 45 ? '1H' : matchMinute < 90 ? '2H' : 'ET'}
            </span>
          </div>

          {/* Team Stats Grid */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <StatBox
              icon={<Activity className="w-4 h-4" />}
              label="Avg Distance"
              value={`${(stats.avgDistance / 1000).toFixed(2)} km`}
            />
            <StatBox
              icon={<TrendingUp className="w-4 h-4" />}
              label="Avg Speed"
              value={`${stats.avgSpeed.toFixed(1)} km/h`}
            />
            <StatBox
              icon={<Users className="w-4 h-4" />}
              label="Total Sprints"
              value={stats.totalSprints.toString()}
            />
            <StatBox
              icon={<Activity className="w-4 h-4" />}
              label="Coherence"
              value={`${Math.round(stats.avgCoherence)}%`}
              valueColor={stats.avgCoherence >= 70 ? 'text-green-600' : 'text-yellow-600'}
            />
          </div>
        </CardContent>
      </Card>

      {/* Pitch View */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Field Position</CardTitle>
        </CardHeader>
        <CardContent>
          <PitchView
            players={players}
            liveData={liveData}
            formation={gameModel?.formation.shape}
            selectedPlayerId={selectedPlayerId}
            onPlayerClick={onPlayerSelect}
          />
        </CardContent>
      </Card>

      {/* Coherence Overview */}
      {coherenceReport && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Tactical Coherence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center mb-4">
              <CoherenceGauge
                score={coherenceReport.overallScore}
                label="Overall Coherence"
                size="lg"
              />
            </div>

            {/* Phase Coherence */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">By Phase</h4>
              {Array.from(coherenceReport.byPhase.entries()).slice(0, 4).map(([phase, score]) => (
                <CoherenceBar
                  key={phase}
                  label={phase.replace(/([A-Z])/g, ' $1').trim()}
                  score={score}
                />
              ))}
            </div>

            {/* Recommendations */}
            {coherenceReport.recommendations.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Recommendations</h4>
                <ul className="space-y-1">
                  {coherenceReport.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-sm text-blue-700 flex items-start gap-2">
                      <span className="text-blue-400">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {recentAlerts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              Recent Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentAlerts.map((alert, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'p-2 rounded-lg flex items-start gap-2',
                    alert.severity === 'high'
                      ? 'bg-red-50 text-red-700'
                      : alert.severity === 'medium'
                      ? 'bg-yellow-50 text-yellow-700'
                      : 'bg-blue-50 text-blue-700'
                  )}
                >
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{alert.message}</p>
                    <p className="text-xs opacity-75">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Critical Deviations */}
      {criticalDeviations.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-2 bg-red-50">
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Critical Deviations
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-red-50">
            <div className="space-y-2">
              {criticalDeviations.map((deviation) => (
                <div key={deviation.id} className="p-2 bg-white rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-red-600">
                      {deviation.minute}' - {deviation.type}
                    </span>
                    <span className="text-xs text-gray-500">{deviation.severity}</span>
                  </div>
                  <p className="text-sm text-gray-800">
                    Expected: {deviation.expected}
                  </p>
                  <p className="text-sm text-red-600">
                    Actual: {deviation.actual}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface StatBoxProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}

function StatBox({ icon, label, value, valueColor }: StatBoxProps) {
  return (
    <div className="text-center p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center justify-center text-gray-400 mb-1">
        {icon}
      </div>
      <div className={cn('text-lg font-bold', valueColor || 'text-gray-900')}>
        {value}
      </div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
