'use client';

import { cn, formatDistance, formatSpeed } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Player, TrackingMetrics, DigitalTwin } from '@/types';
import { Activity, Zap, Heart, MapPin, TrendingUp, Battery } from 'lucide-react';

interface PlayerStatsCardProps {
  player: Player;
  metrics?: TrackingMetrics;
  twin?: DigitalTwin;
  coherenceScore?: number;
  className?: string;
  onClick?: () => void;
}

export function PlayerStatsCard({
  player,
  metrics,
  twin,
  coherenceScore,
  className,
  onClick,
}: PlayerStatsCardProps) {
  const fatigueLevel = twin?.currentState.fatigue ?? 0;
  const workRate = twin?.currentState.currentWorkRate ?? 100;

  return (
    <Card className={cn('hover:shadow-lg transition-shadow', className)} onClick={onClick}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
              {player.number}
            </div>
            <div>
              <CardTitle className="text-base">{player.name}</CardTitle>
              <span className="text-xs text-gray-500">{player.position}</span>
            </div>
          </div>
          {coherenceScore !== undefined && (
            <div
              className={cn(
                'px-2 py-1 rounded-full text-xs font-bold',
                coherenceScore >= 80
                  ? 'bg-green-100 text-green-700'
                  : coherenceScore >= 60
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
              )}
            >
              {Math.round(coherenceScore)}%
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {metrics ? (
          <div className="grid grid-cols-2 gap-3">
            <StatItem
              icon={<Activity className="w-4 h-4" />}
              label="Distance"
              value={formatDistance(metrics.totalDistance)}
            />
            <StatItem
              icon={<Zap className="w-4 h-4" />}
              label="Speed"
              value={formatSpeed(metrics.currentSpeed)}
            />
            <StatItem
              icon={<TrendingUp className="w-4 h-4" />}
              label="Sprints"
              value={metrics.accelerations.high.toString()}
            />
            <StatItem
              icon={<MapPin className="w-4 h-4" />}
              label="Zone"
              value={metrics.position.zone.replace('_', ' ')}
            />
            {metrics.heartRate && (
              <StatItem
                icon={<Heart className="w-4 h-4 text-red-500" />}
                label="HR"
                value={`${metrics.heartRate.current} bpm`}
              />
            )}
            <StatItem
              icon={<Battery className="w-4 h-4" />}
              label="Fatigue"
              value={`${Math.round(fatigueLevel)}%`}
              color={fatigueLevel > 70 ? 'text-red-600' : fatigueLevel > 50 ? 'text-yellow-600' : 'text-green-600'}
            />
          </div>
        ) : (
          <div className="text-sm text-gray-500 text-center py-4">
            No live data available
          </div>
        )}

        {twin && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Work Rate</span>
              <span className={cn('font-medium', workRate < 80 ? 'text-orange-600' : 'text-green-600')}>
                {Math.round(workRate)}%
              </span>
            </div>
            <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  workRate >= 80 ? 'bg-green-500' : workRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                )}
                style={{ width: `${Math.min(100, workRate)}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}

function StatItem({ icon, label, value, color }: StatItemProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-gray-400">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 truncate">{label}</div>
        <div className={cn('text-sm font-semibold truncate', color || 'text-gray-900')}>
          {value}
        </div>
      </div>
    </div>
  );
}

interface PlayerListProps {
  players: Player[];
  liveData?: Map<string, TrackingMetrics>;
  twins?: Map<string, DigitalTwin>;
  coherenceScores?: Map<string, number>;
  selectedPlayerId?: string | null;
  onPlayerSelect?: (playerId: string) => void;
  className?: string;
}

export function PlayerList({
  players,
  liveData,
  twins,
  coherenceScores,
  selectedPlayerId,
  onPlayerSelect,
  className,
}: PlayerListProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {players.map((player) => (
        <PlayerStatsCard
          key={player.id}
          player={player}
          metrics={liveData?.get(player.id)}
          twin={twins?.get(player.id)}
          coherenceScore={coherenceScores?.get(player.id)}
          className={cn(
            selectedPlayerId === player.id && 'ring-2 ring-blue-500'
          )}
          onClick={() => onPlayerSelect?.(player.id)}
        />
      ))}
    </div>
  );
}
