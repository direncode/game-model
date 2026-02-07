'use client';

import { useMemo } from 'react';
import { PitchView } from '@/components/dashboard/pitch-view';
import { CoherenceGauge } from '@/components/dashboard/coherence-gauge';
import type { Player, TrackingMetrics, MatchEvent, PlayerAlert, TeamMetrics } from '@/types';
import type { SimpleTwin } from '@/data/generate-tracking';
import { AlertTriangle, Clock, Zap, TrendingUp } from 'lucide-react';

interface MatchDashboardProps {
  homePlayers: Player[];
  awayPlayers: Player[];
  homeLiveData: Map<string, TrackingMetrics>;
  awayLiveData: Map<string, TrackingMetrics>;
  ballPosition?: { x: number; y: number };
  ballPossession?: 'home' | 'away';
  matchEvents: MatchEvent[];
  alerts: PlayerAlert[];
  homeMetrics: TeamMetrics;
  awayMetrics: TeamMetrics;
  coherenceScore: number;
  twins: Map<string, SimpleTwin>;
  minute: number;
  isLive: boolean;
}

function StatBar({
  label,
  homeValue,
  awayValue,
  format = 'number',
}: {
  label: string;
  homeValue: number;
  awayValue: number;
  format?: 'number' | 'percent';
}) {
  const total = homeValue + awayValue || 1;
  const homePercent = (homeValue / total) * 100;
  const display = format === 'percent' ? '%' : '';

  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-red-400 font-medium tabular-nums">
          {Math.round(homeValue)}{display}
        </span>
        <span className="text-[#5F6B7C] uppercase tracking-wider text-[9px]">{label}</span>
        <span className="text-[#C87619] font-medium tabular-nums">
          {Math.round(awayValue)}{display}
        </span>
      </div>
      <div className="h-1.5 bg-[#2F343C] rounded-full overflow-hidden flex">
        <div
          className="h-full bg-red-500 rounded-l-full transition-all duration-500"
          style={{ width: `${homePercent}%` }}
        />
        <div
          className="h-full bg-[#C87619] rounded-r-full transition-all duration-500"
          style={{ width: `${100 - homePercent}%` }}
        />
      </div>
    </div>
  );
}

function getEventColor(type: MatchEvent['type']): string {
  switch (type) {
    case 'goal': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'card': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'substitution': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'injury': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'tactical_change': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    default: return 'bg-[#252A31] text-[#8F99A8] border-[#2F343C]';
  }
}

export function MatchDashboard({
  homePlayers,
  awayPlayers,
  homeLiveData,
  awayLiveData,
  ballPosition,
  ballPossession,
  matchEvents,
  alerts,
  homeMetrics,
  awayMetrics,
  coherenceScore,
  twins,
  minute,
  isLive,
}: MatchDashboardProps) {
  // Recent alerts (last 5)
  const recentAlerts = useMemo(() => alerts.slice(-5).reverse(), [alerts]);

  // Substitution recommendations from twins
  const subRecommendations = useMemo(() => {
    const recs: { name: string; fatigue: number; reason: string }[] = [];
    homePlayers.slice(0, 11).forEach((p) => {
      const twin = twins.get(p.id);
      if (twin && twin.fatigue > 75) {
        const surname = p.name.split(' ').pop() || p.name;
        recs.push({
          name: surname,
          fatigue: twin.fatigue,
          reason: twin.fatigue > 85 ? 'Critical fatigue' : 'High fatigue',
        });
      }
    });
    return recs.sort((a, b) => b.fatigue - a.fatigue).slice(0, 3);
  }, [homePlayers, twins]);

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left: Team Stats */}
      <div className="w-60 flex-shrink-0 border-r border-[#2F343C] overflow-y-auto p-3">
        <div className="text-[10px] uppercase tracking-wider text-[#5F6B7C] font-medium mb-3">
          Team Statistics
        </div>
        <StatBar label="Possession" homeValue={homeMetrics.possession} awayValue={awayMetrics.possession} format="percent" />
        <StatBar label="Pass Acc." homeValue={homeMetrics.passAccuracy} awayValue={awayMetrics.passAccuracy} format="percent" />
        <StatBar label="Pressure" homeValue={homeMetrics.pressureSuccess} awayValue={awayMetrics.pressureSuccess} format="percent" />
        <StatBar label="Territory" homeValue={homeMetrics.territorialControl} awayValue={awayMetrics.territorialControl} format="percent" />
        <StatBar label="Compact." homeValue={homeMetrics.compactness} awayValue={awayMetrics.compactness} />
        <StatBar label="Form. Maint." homeValue={homeMetrics.formationMaintenance} awayValue={awayMetrics.formationMaintenance} />
      </div>

      {/* Center: Pitch */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 p-2">
          <PitchView
            players={homePlayers}
            awayPlayers={awayPlayers}
            liveData={homeLiveData}
            awayLiveData={awayLiveData}
            selectedPlayerId={null}
            onPlayerClick={() => {}}
            ballPosition={ballPosition}
            ballPossession={ballPossession}
          />
        </div>

        {/* Bottom: Event Timeline */}
        <div className="flex-shrink-0 border-t border-[#2F343C] px-3 py-2">
          <div className="flex items-center gap-2 mb-1.5">
            <Clock className="w-3 h-3 text-[#5F6B7C]" />
            <span className="text-[9px] uppercase tracking-wider text-[#5F6B7C]">Match Events</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {matchEvents.map((evt) => (
              <div
                key={evt.id}
                className={`flex-shrink-0 px-2 py-1 rounded border text-[10px] ${getEventColor(evt.type)}`}
              >
                <span className="font-medium">{evt.minute}&apos;</span>{' '}
                <span className="opacity-80">{evt.description.split('—')[0].trim()}</span>
              </div>
            ))}
            {matchEvents.length === 0 && (
              <span className="text-[10px] text-[#5F6B7C]">Events will appear as the match progresses</span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Coherence + Alerts */}
      <div className="w-72 flex-shrink-0 border-l border-[#2F343C] overflow-y-auto flex flex-col">
        {/* Coherence Gauge */}
        <div className="flex-shrink-0 p-4 border-b border-[#2F343C] flex justify-center">
          <CoherenceGauge score={coherenceScore} label="Tactical Coherence" size="md" />
        </div>

        {/* Substitution Intelligence */}
        {subRecommendations.length > 0 && (
          <div className="flex-shrink-0 p-3 border-b border-[#2F343C]">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-3 h-3 text-orange-400" />
              <span className="text-[10px] uppercase tracking-wider text-orange-400 font-medium">
                Sub Intelligence
              </span>
            </div>
            {subRecommendations.map((rec, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-2 py-1.5 mb-1 rounded bg-orange-500/10 text-[11px]"
              >
                <span className="text-orange-300">{rec.name}</span>
                <span className="text-orange-400 font-medium">{rec.fatigue}% fatigue</span>
              </div>
            ))}
          </div>
        )}

        {/* Live Alerts */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-shrink-0 px-3 py-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] uppercase tracking-wider text-[#5F6B7C] font-medium">
              Live Alerts
            </span>
            {alerts.length > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">
                {alerts.length}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-1">
            {recentAlerts.length === 0 ? (
              <div className="text-[11px] text-[#5F6B7C] text-center py-4">
                No alerts yet
              </div>
            ) : (
              recentAlerts.map((alert, i) => (
                <div
                  key={i}
                  className={`px-2 py-1.5 rounded text-[10px] ${
                    alert.severity === 'high'
                      ? 'bg-red-500/10 text-red-400'
                      : alert.severity === 'medium'
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-[#252A31] text-[#8F99A8]'
                  }`}
                >
                  {alert.message}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
