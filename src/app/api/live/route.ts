// Live Match Data Processing API Route

import { NextRequest, NextResponse } from 'next/server';
import {
  calculateTrackingMetrics,
  calculateTeamCompactness,
  calculateFormationShape,
  aggregateSessionMetrics,
} from '@/lib/wearable-analytics';
import { updateTwinState, predictFatigueCurve, predictPerformanceDecline } from '@/lib/digital-twin';
import { calculateCoherence, generateCoherenceAlerts, updateCoherenceInRealTime } from '@/lib/coherence-analysis';
import type {
  WearableData,
  TrackingMetrics,
  GameModel,
  GameApproach,
  DigitalTwin,
  LivePlayerData,
  CoherenceReport,
} from '@/types';

// Simulated data storage for demo purposes
// In production, this would connect to a real-time database
const liveDataStore = new Map<string, TrackingMetrics>();
const digitalTwinStore = new Map<string, DigitalTwin>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'process-wearable-data': {
        const { playerId, positions, accelerometer, heartRate, maxHR } = data as {
          playerId: string;
          positions: { x: number; y: number; timestamp: number }[];
          accelerometer?: { x: number; y: number; z: number; timestamp: number }[];
          heartRate?: { value: number; timestamp: number }[];
          maxHR?: number;
        };

        const metrics = calculateTrackingMetrics(
          positions,
          accelerometer,
          heartRate,
          maxHR
        );

        // Store in live data
        liveDataStore.set(playerId, metrics);

        return NextResponse.json({
          success: true,
          metrics,
        });
      }

      case 'update-twin': {
        const { playerId, twin, currentMetrics, matchMinute, gameModel, expectedPosition } = data as {
          playerId: string;
          twin: DigitalTwin;
          currentMetrics: TrackingMetrics;
          matchMinute: number;
          gameModel?: GameModel;
          expectedPosition?: { x: number; y: number };
        };

        const updatedTwin = updateTwinState(
          twin,
          currentMetrics,
          matchMinute,
          gameModel,
          expectedPosition
        );

        digitalTwinStore.set(playerId, updatedTwin);

        // Get predictions
        const fatigueCurve = predictFatigueCurve(updatedTwin, 90 - matchMinute);
        const performanceDecline = predictPerformanceDecline(updatedTwin, matchMinute);

        return NextResponse.json({
          success: true,
          twin: updatedTwin,
          predictions: {
            fatigueCurve,
            performanceDecline,
          },
        });
      }

      case 'calculate-coherence': {
        const { gameModel, gameApproach, playerData, matchMinute, gamePhase } = data as {
          gameModel: GameModel;
          gameApproach: GameApproach | null;
          playerData: [string, LivePlayerData][];
          matchMinute: number;
          gamePhase: string;
        };

        // Convert player data array back to Map
        const playerDataMap = new Map<string, LivePlayerData>(playerData);

        const report = calculateCoherence(
          gameModel,
          gameApproach,
          playerDataMap,
          digitalTwinStore,
          matchMinute,
          gamePhase
        );

        const alerts = generateCoherenceAlerts(report);

        return NextResponse.json({
          success: true,
          report,
          alerts,
        });
      }

      case 'get-team-metrics': {
        const { playerPositions } = data as {
          playerPositions: [string, { x: number; y: number }][];
        };

        const positionsMap = new Map<string, { x: number; y: number }>(playerPositions);
        const compactness = calculateTeamCompactness(positionsMap);

        const positionsWithRole = new Map<string, { x: number; y: number; role: string }>();
        for (const [id, pos] of positionsMap) {
          positionsWithRole.set(id, { ...pos, role: 'unknown' });
        }
        const shape = calculateFormationShape(positionsWithRole);

        return NextResponse.json({
          success: true,
          compactness,
          shape,
        });
      }

      case 'get-live-data': {
        const entries = Array.from(liveDataStore.entries());
        return NextResponse.json({
          success: true,
          data: entries,
        });
      }

      case 'clear-live-data': {
        liveDataStore.clear();
        return NextResponse.json({
          success: true,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Live API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return current live data snapshot
  const entries = Array.from(liveDataStore.entries());
  return NextResponse.json({
    success: true,
    data: entries,
    timestamp: new Date().toISOString(),
  });
}
