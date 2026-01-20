// Player Advanced Stats API
// Returns comprehensive individual player statistics and metrics

import { NextRequest, NextResponse } from 'next/server';
import { getLiveDataService } from '@/lib/live-data-service';
import { getPLSquadData } from '@/lib/premier-league-api';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: playerId } = await params;

    // Find player in squad data
    const allSquads = ['MCI', 'MUN', 'ARS', 'LIV'];
    let player = null;

    for (const teamTla of allSquads) {
      const squad = getPLSquadData(teamTla);
      player = squad.find((p) => p.id === playerId);
      if (player) break;
    }

    if (!player) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    const service = getLiveDataService();
    const matchData = service.getMatchData();
    const minute = matchData?.state.minute || 0;

    // Get advanced stats
    const advancedStats = service.getPlayerAdvancedStats(player, minute);

    // Get live tracking if available
    const liveTracking = service.getPlayerTracking(playerId);

    return NextResponse.json({
      success: true,
      data: {
        player: {
          id: player.id,
          name: player.name,
          number: player.number,
          position: player.position,
          preferredFoot: player.preferredFoot,
          currentStatus: player.currentStatus,
          physicalProfile: player.physicalProfile,
        },
        advancedStats,
        liveTracking: liveTracking ? {
          timestamp: liveTracking.timestamp,
          instantaneous: liveTracking.instantaneous,
          cumulative: liveTracking.cumulative,
          physicalLoad: liveTracking.physicalLoad,
        } : null,
        isLive: !!matchData && matchData.state.phase !== 'full_time' && matchData.state.phase !== 'pre_match',
      },
    });
  } catch (error) {
    console.error('Error fetching player stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch player stats' },
      { status: 500 }
    );
  }
}
