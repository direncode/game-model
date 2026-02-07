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
            <div className="w-10 h-10 rounded-full bg-[#2D72D2] flex items-center justify-center text-white font-bold">
              {player.number}
            </div>
            <div>
              <CardTitle className="text-base">{player.name}</CardTitle>
              <span className="text-xs text-[#8F99A8]">{player.position}</span>
            </div>
          </div>
          {coherenceScore !== undefined && (
            <div
              className={cn(
                'px-2 py-1 rounded-full text-xs font-bold',
                coherenceScore >= 80
                  ? 'bg-green-500/20 text-green-400'
                  : coherenceScore >= 60
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-red-500/20 text-red-400'
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
              color={fatigueLevel > 70 ? 'text-red-400' : fatigueLevel > 50 ? 'text-yellow-400' : 'text-green-400'}
            />
          </div>
        ) : (
          <div className="text-sm text-[#8F99A8] text-center py-4">
            No live data available
          </div>
        )}

        {twin && (
          <div className="mt-3 pt-3 border-t border-[#2F343C]">
            <div className="flex justify-between text-xs">
              <span className="text-[#8F99A8]">Work Rate</span>
              <span className={cn('font-medium', workRate < 80 ? 'text-orange-400' : 'text-green-400')}>
                {Math.round(workRate)}%
              </span>
            </div>
            <div className="mt-1 h-1.5 bg-[#2F343C] rounded-full overflow-hidden">
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
      <div className="text-[#5F6B7C]">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-[#8F99A8] truncate">{label}</div>
        <div className={cn('text-sm font-semibold truncate', color || 'text-[#F6F7F9]')}>
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
