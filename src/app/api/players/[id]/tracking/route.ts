// Player Live Tracking API
// Returns real-time GPS/wearable tracking data for individual players

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

    // Find player
    const allSquads = ['MCI', 'MUN', 'ARS', 'LIV'];
    let player = null;
    let teamTla = '';

    for (const tla of allSquads) {
      const squad = getPLSquadData(tla);
      player = squad.find((p) => p.id === playerId);
      if (player) {
        teamTla = tla;
        break;
      }
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

    // Generate or get tracking data
    let tracking = service.getPlayerTracking(playerId);
    if (!tracking && minute > 0) {
      tracking = service.generatePlayerTracking(player, minute);
    }

    if (!tracking) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No tracking data available - match not started',
      });
    }

    // Calculate additional derived metrics
    const derivedMetrics = {
      distancePerMinute: minute > 0 ? tracking.cumulative.totalDistance / minute : 0,
      highIntensityPercentage: tracking.cumulative.totalDistance > 0
        ? ((tracking.cumulative.highSpeedDistance + tracking.cumulative.sprintDistance) / tracking.cumulative.totalDistance) * 100
        : 0,
      workRate: tracking.cumulative.totalPlayerLoad / Math.max(1, minute),
      speedEfficiency: tracking.instantaneous.speed / player.physicalProfile.maxSpeed * 100,
      fatigueProjection: calculateFatigueProjection(tracking, minute),
      optimalSubstitutionMinute: calculateOptimalSubMinute(tracking, minute),
    };

    return NextResponse.json({
      success: true,
      data: {
        playerId: player.id,
        playerName: player.name,
        team: teamTla,
        position: player.position,
        timestamp: tracking.timestamp,
        minutesPlayed: minute,

        // Instantaneous (current moment)
        current: {
          speed: tracking.instantaneous.speed,
          acceleration: tracking.instantaneous.acceleration,
          heartRate: tracking.instantaneous.heartRate,
          metabolicPower: tracking.instantaneous.metabolicPower,
          bodyLoad: tracking.instantaneous.bodyLoad,
          position: tracking.instantaneous.position,
          direction: tracking.instantaneous.direction,
        },

        // Cumulative (match totals)
        totals: {
          distance: tracking.cumulative.totalDistance,
          highSpeedDistance: tracking.cumulative.highSpeedDistance,
          sprintDistance: tracking.cumulative.sprintDistance,
          accelerations: tracking.cumulative.accelerationCount,
          decelerations: tracking.cumulative.decelerationCount,
          playerLoad: tracking.cumulative.totalPlayerLoad,
          metabolicWork: tracking.cumulative.metabolicWork,
        },

        // Speed zones breakdown
        speedZones: {
          walking: { time: tracking.zones.speedZones.zone1Time, percentage: zonePercentage(tracking.zones.speedZones.zone1Time, minute) },
          jogging: { time: tracking.zones.speedZones.zone2Time, percentage: zonePercentage(tracking.zones.speedZones.zone2Time, minute) },
          running: { time: tracking.zones.speedZones.zone3Time, percentage: zonePercentage(tracking.zones.speedZones.zone3Time, minute) },
          highSpeed: { time: tracking.zones.speedZones.zone4Time, percentage: zonePercentage(tracking.zones.speedZones.zone4Time, minute) },
          sprinting: { time: tracking.zones.speedZones.zone5Time, percentage: zonePercentage(tracking.zones.speedZones.zone5Time, minute) },
          maxSprint: { time: tracking.zones.speedZones.zone6Time, percentage: zonePercentage(tracking.zones.speedZones.zone6Time, minute) },
        },

        // Heart rate zones
        heartRateZones: tracking.zones.heartRateZones,

        // Physical load assessment
        physicalLoad: {
          acute: tracking.physicalLoad.acute,
          chronic: tracking.physicalLoad.chronic,
          acuteChronicRatio: tracking.physicalLoad.acwr,
          fatigueIndex: tracking.physicalLoad.fatigueIndex,
          recoveryStatus: tracking.physicalLoad.recoveryStatus,
          injuryRisk: tracking.physicalLoad.injuryRisk,
        },

        // Derived metrics
        derived: derivedMetrics,

        // Position heatmap
        heatmap: tracking.zones.positionHeatmap,

        // Physical benchmarks
        benchmarks: {
          maxSpeed: tracking.metrics.maxSpeed,
          maxSpeedCapability: player.physicalProfile.maxSpeed,
          maxSpeedUtilization: (tracking.metrics.maxSpeed / player.physicalProfile.maxSpeed) * 100,
          maxAcceleration: tracking.metrics.maxAcceleration,
          maxDeceleration: tracking.metrics.maxDeceleration,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching player tracking:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch player tracking data' },
      { status: 500 }
    );
  }
}

// Helper functions need to be standalone since this is a route handler
function zonePercentage(zoneTime: number, totalMinutes: number): number {
  if (totalMinutes <= 0) return 0;
  return Math.round((zoneTime / (totalMinutes * 60)) * 100 * 10) / 10;
}

function calculateFatigueProjection(tracking: { physicalLoad: { fatigueIndex: number } }, currentMinute: number): {
  minute75: number;
  minute90: number;
  recommendation: string;
} {
  const currentFatigue = tracking.physicalLoad.fatigueIndex;
  const fatigueRate = currentMinute > 0 ? currentFatigue / currentMinute : 0;

  return {
    minute75: Math.min(100, currentFatigue + fatigueRate * (75 - currentMinute)),
    minute90: Math.min(100, currentFatigue + fatigueRate * (90 - currentMinute)),
    recommendation: currentFatigue > 70
      ? 'Consider substitution'
      : currentFatigue > 50
        ? 'Monitor closely'
        : 'Good condition',
  };
}

function calculateOptimalSubMinute(tracking: { physicalLoad: { fatigueIndex: number } }, currentMinute: number): number {
  const currentFatigue = tracking.physicalLoad.fatigueIndex;
  const fatigueRate = currentMinute > 0 ? currentFatigue / currentMinute : 1;
  const targetFatigue = 75;

  if (currentFatigue >= targetFatigue) return currentMinute;
  return Math.min(90, currentMinute + (targetFatigue - currentFatigue) / fatigueRate);
}
