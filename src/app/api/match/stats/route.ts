// Match Statistics API
// Returns comprehensive match statistics including tracking aggregates

import { NextRequest, NextResponse } from 'next/server';
import { getLiveDataService } from '@/lib/live-data-service';
import { getPLSquadData } from '@/lib/premier-league-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const service = getLiveDataService();
    const matchData = service.getMatchData();

    if (!matchData) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No active match',
      });
    }

    const { state, stats } = matchData;
    const minute = state.minute;

    // Get all player tracking data
    const citySquad = getPLSquadData('MCI');
    const unitedSquad = getPLSquadData('MUN');

    // Aggregate team tracking stats
    const homeTracking = aggregateTeamTracking(service, citySquad, minute);
    const awayTracking = aggregateTeamTracking(service, unitedSquad, minute);

    return NextResponse.json({
      success: true,
      data: {
        matchId: matchData.matchId,
        phase: state.phase,
        minute: Math.floor(minute),
        score: {
          home: state.homeScore,
          away: state.awayScore,
        },

        // Basic match stats
        matchStats: {
          possession: stats.possession,
          shots: stats.shots,
          shotsOnTarget: stats.shotsOnTarget,
          corners: stats.corners,
          fouls: stats.fouls,
          yellowCards: stats.yellowCards,
          redCards: stats.redCards,
          offsides: stats.offsides,
          passes: stats.passes,
          passAccuracy: stats.passAccuracy,
          tackles: stats.tackles,
          saves: stats.saves,
          xG: {
            home: Math.round(stats.xG.home * 100) / 100,
            away: Math.round(stats.xG.away * 100) / 100,
          },
        },

        // Team tracking aggregates
        tracking: {
          home: {
            team: 'Manchester City',
            tla: 'MCI',
            ...homeTracking,
          },
          away: {
            team: 'Manchester United',
            tla: 'MUN',
            ...awayTracking,
          },
        },

        // Game state
        gameState: {
          momentum: state.momentum,
          intensity: matchData.teamMetrics.pressingIntensity,
          territorialAdvantage: matchData.teamMetrics.territorialAdvantage,
          compactness: matchData.teamMetrics.compactness,
        },

        // Comparison metrics
        comparison: generateComparison(homeTracking, awayTracking),

        lastUpdate: matchData.lastUpdate,
      },
    });
  } catch (error) {
    console.error('Error fetching match stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch match statistics' },
      { status: 500 }
    );
  }
}

function aggregateTeamTracking(
  service: ReturnType<typeof getLiveDataService>,
  squad: ReturnType<typeof getPLSquadData>,
  minute: number
) {
  let totalDistance = 0;
  let totalSprints = 0;
  let totalHighSpeed = 0;
  let totalPlayerLoad = 0;
  let maxSpeed = 0;
  let avgHeartRate = 0;
  let playersTracked = 0;

  // Starting XI only (first 11)
  const startingXI = squad.slice(0, 11);

  startingXI.forEach((player) => {
    let tracking = service.getPlayerTracking(player.id);
    if (!tracking && minute > 0) {
      tracking = service.generatePlayerTracking(player, minute);
    }

    if (tracking) {
      totalDistance += tracking.cumulative.totalDistance;
      totalSprints += Math.floor(minute * 0.3);
      totalHighSpeed += tracking.cumulative.highSpeedDistance;
      totalPlayerLoad += tracking.cumulative.totalPlayerLoad;
      if (tracking.metrics.maxSpeed > maxSpeed) {
        maxSpeed = tracking.metrics.maxSpeed;
      }
      avgHeartRate += tracking.instantaneous.heartRate;
      playersTracked++;
    }
  });

  avgHeartRate = playersTracked > 0 ? avgHeartRate / playersTracked : 0;

  return {
    totalDistance: Math.round(totalDistance),
    avgDistancePerPlayer: Math.round(totalDistance / Math.max(1, playersTracked)),
    totalHighSpeedDistance: Math.round(totalHighSpeed),
    totalSprintDistance: Math.round(totalHighSpeed * 0.4),
    totalSprints,
    maxSpeedReached: Math.round(maxSpeed * 10) / 10,
    totalPlayerLoad: Math.round(totalPlayerLoad),
    avgPlayerLoad: Math.round(totalPlayerLoad / Math.max(1, playersTracked)),
    avgHeartRate: Math.round(avgHeartRate),
    playersTracked,
    intensity: minute > 0 ? Math.round((totalDistance / minute / playersTracked) * 10) / 10 : 0,
  };
}

function generateComparison(
  home: ReturnType<typeof aggregateTeamTracking>,
  away: ReturnType<typeof aggregateTeamTracking>
) {
  return {
    distance: {
      home: home.totalDistance,
      away: away.totalDistance,
      advantage: home.totalDistance > away.totalDistance ? 'home' : 'away',
      difference: Math.abs(home.totalDistance - away.totalDistance),
    },
    intensity: {
      home: home.intensity,
      away: away.intensity,
      advantage: home.intensity > away.intensity ? 'home' : 'away',
      difference: Math.round(Math.abs(home.intensity - away.intensity) * 10) / 10,
    },
    sprints: {
      home: home.totalSprints,
      away: away.totalSprints,
      advantage: home.totalSprints > away.totalSprints ? 'home' : 'away',
      difference: Math.abs(home.totalSprints - away.totalSprints),
    },
    maxSpeed: {
      home: home.maxSpeedReached,
      away: away.maxSpeedReached,
      advantage: home.maxSpeedReached > away.maxSpeedReached ? 'home' : 'away',
      difference: Math.round(Math.abs(home.maxSpeedReached - away.maxSpeedReached) * 10) / 10,
    },
  };
}
