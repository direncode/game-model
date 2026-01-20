// Match Events API
// Returns match events with filtering and pagination

import { NextRequest, NextResponse } from 'next/server';
import { getLiveDataService } from '@/lib/live-data-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type'); // Filter by event type
    const team = searchParams.get('team'); // Filter by team (home/away)
    const player = searchParams.get('player'); // Filter by player name

    const service = getLiveDataService();
    const matchData = service.getMatchData();

    if (!matchData) {
      return NextResponse.json({
        success: true,
        data: {
          events: [],
          total: 0,
          message: 'No active match',
        },
      });
    }

    let events = [...matchData.events];

    // Apply filters
    if (type) {
      events = events.filter((e) => e.type === type);
    }
    if (team) {
      events = events.filter((e) => e.team === team);
    }
    if (player) {
      events = events.filter(
        (e) =>
          e.primaryPlayer.toLowerCase().includes(player.toLowerCase()) ||
          (e.secondaryPlayer && e.secondaryPlayer.toLowerCase().includes(player.toLowerCase()))
      );
    }

    const total = events.length;
    const paginatedEvents = events.slice(offset, offset + limit);

    // Group events by type for summary
    const eventSummary = events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      data: {
        matchId: matchData.matchId,
        currentMinute: matchData.state.minute,
        score: {
          home: matchData.state.homeScore,
          away: matchData.state.awayScore,
        },
        events: paginatedEvents.map((event) => ({
          id: event.id,
          minute: event.minute,
          type: event.type,
          team: event.team,
          teamName: event.team === 'home' ? 'Manchester City' : 'Manchester United',
          primaryPlayer: event.primaryPlayer,
          secondaryPlayer: event.secondaryPlayer,
          description: event.description,
          xG: event.xG,
          metadata: event.metadata,
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        summary: eventSummary,
        keyEvents: events
          .filter((e) => ['goal', 'red_card', 'penalty'].includes(e.type))
          .map((e) => ({
            minute: e.minute,
            type: e.type,
            team: e.team,
            description: e.description,
          })),
      },
    });
  } catch (error) {
    console.error('Error fetching match events:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch match events' },
      { status: 500 }
    );
  }
}
