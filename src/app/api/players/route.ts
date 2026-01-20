// Players List API
// Returns all players with summary tracking data

import { NextRequest, NextResponse } from 'next/server';
import { getLiveDataService } from '@/lib/live-data-service';
import { getPLSquadData } from '@/lib/premier-league-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const team = searchParams.get('team') || 'MCI';
    const includeTracking = searchParams.get('tracking') === 'true';

    const squad = getPLSquadData(team);
    const service = getLiveDataService();
    const matchData = service.getMatchData();
    const minute = matchData?.state.minute || 0;

    const players = squad.map((player) => {
      let trackingSummary = null;

      if (includeTracking && minute > 0) {
        let tracking = service.getPlayerTracking(player.id);
        if (!tracking) {
          tracking = service.generatePlayerTracking(player, minute);
        }

        trackingSummary = {
          currentSpeed: tracking.instantaneous.speed,
          totalDistance: tracking.cumulative.totalDistance,
          playerLoad: tracking.cumulative.totalPlayerLoad,
          fatigueIndex: tracking.physicalLoad.fatigueIndex,
          recoveryStatus: tracking.physicalLoad.recoveryStatus,
          injuryRisk: tracking.physicalLoad.injuryRisk,
          position: tracking.instantaneous.position,
        };
      }

      return {
        id: player.id,
        name: player.name,
        number: player.number,
        position: player.position,
        preferredFoot: player.preferredFoot,
        currentStatus: player.currentStatus,
        physicalProfile: {
          maxSpeed: player.physicalProfile.maxSpeed,
          accelerationPeak: player.physicalProfile.accelerationPeak,
          sprintCapacity: player.physicalProfile.sprintCapacity,
        },
        tracking: trackingSummary,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        team,
        playerCount: players.length,
        isLive: !!matchData && matchData.state.phase !== 'full_time' && matchData.state.phase !== 'pre_match',
        currentMinute: minute,
        players,
      },
    });
  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch players' },
      { status: 500 }
    );
  }
}
