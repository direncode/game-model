// Live Match Data API
// Returns real-time match state, events, and tracking data

import { NextRequest, NextResponse } from 'next/server';
import { getLiveDataService } from '@/lib/live-data-service';
import { getPLSquadData } from '@/lib/premier-league-api';

export const dynamic = 'force-dynamic';

// GET - Get current live match data
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

    // Convert Map to object for JSON serialization
    const playerTrackingObj: Record<string, unknown> = {};
    matchData.playerTracking.forEach((data, playerId) => {
      playerTrackingObj[playerId] = data;
    });

    return NextResponse.json({
      success: true,
      data: {
        matchId: matchData.matchId,
        state: matchData.state,
        stats: matchData.stats,
        events: matchData.events.slice(0, 20),
        teamMetrics: matchData.teamMetrics,
        lastUpdate: matchData.lastUpdate,
        playerTracking: playerTrackingObj,
      },
    });
  } catch (error) {
    console.error('Error fetching live match data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch live match data' },
      { status: 500 }
    );
  }
}

// POST - Control match (start, stop, pause)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const service = getLiveDataService();

    switch (action) {
      case 'start':
        // Initialize player tracking
        const citySquad = getPLSquadData('MCI');
        citySquad.forEach((player) => {
          service.generatePlayerTracking(player, 0);
        });
        service.start();
        return NextResponse.json({
          success: true,
          message: 'Match started',
        });

      case 'stop':
        service.stop();
        return NextResponse.json({
          success: true,
          message: 'Match stopped',
        });

      case 'pause':
        service.pause();
        return NextResponse.json({
          success: true,
          message: 'Match paused',
        });

      case 'resume':
        service.resume();
        return NextResponse.json({
          success: true,
          message: 'Match resumed',
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error controlling match:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to control match' },
      { status: 500 }
    );
  }
}
