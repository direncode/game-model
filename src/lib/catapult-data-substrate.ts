/**
 * BigDunc Catapult Data Substrate
 *
 * Adapter layer that normalizes GPS/IMU/load data into kernel-ready frames.
 * Supports placeholder Catapult streams, CSV, and JSON ingestion.
 */

import { PlayerPhase, clamp } from './resonance-kernel';

// ======================== Types ========================

export interface RawPlayerFrame {
  playerId: string;
  x: number;          // meters on pitch
  y: number;
  speed: number;       // m/s
  acceleration: number; // m/s²
  heartRate?: number;
  distance: number;    // cumulative meters
  hsr: number;         // high-speed running meters
  sprint: number;      // sprint meters
  load: number;        // player load AU
}

export interface NormalizedFrame {
  timestamp: number;
  players: NormalizedPlayerData[];
  ballPosition?: { x: number; y: number };
}

export interface NormalizedPlayerData {
  id: string;
  x: number;
  y: number;
  velocity: { x: number; y: number };
  load: number;       // 0–100 normalized
  state: PlayerPhase; // inferred from movement
}

export interface PlayerBaseline {
  playerId: string;
  avgDistance: number;
  avgHsr: number;
  avgSprint: number;
  avgLoad: number;
  injuryThreshold: number; // load AU above which risk increases
}

// ======================== Sample Data ========================

const SAMPLE_PLAYERS: RawPlayerFrame[] = [
  { playerId: 'p1',  x: 15, y: 34, speed: 1.2, acceleration: 0.3, distance: 8200, hsr: 620, sprint: 180, load: 340 },
  { playerId: 'p2',  x: 25, y: 15, speed: 2.8, acceleration: 1.1, distance: 9100, hsr: 810, sprint: 290, load: 420 },
  { playerId: 'p3',  x: 22, y: 52, speed: 2.1, acceleration: 0.8, distance: 8800, hsr: 720, sprint: 210, load: 380 },
  { playerId: 'p4',  x: 35, y: 20, speed: 3.5, acceleration: 1.5, distance: 10200, hsr: 1100, sprint: 410, load: 510 },
  { playerId: 'p5',  x: 40, y: 34, speed: 3.2, acceleration: 1.2, distance: 10500, hsr: 1050, sprint: 380, load: 490 },
  { playerId: 'p6',  x: 38, y: 50, speed: 3.8, acceleration: 1.8, distance: 10800, hsr: 1200, sprint: 450, load: 530 },
  { playerId: 'p7',  x: 55, y: 10, speed: 4.2, acceleration: 2.0, distance: 9800, hsr: 980, sprint: 350, load: 470 },
  { playerId: 'p8',  x: 60, y: 34, speed: 4.5, acceleration: 2.2, distance: 11000, hsr: 1350, sprint: 520, load: 580 },
  { playerId: 'p9',  x: 58, y: 55, speed: 4.0, acceleration: 1.9, distance: 9500, hsr: 920, sprint: 330, load: 460 },
  { playerId: 'p10', x: 75, y: 25, speed: 5.2, acceleration: 2.8, distance: 10000, hsr: 1400, sprint: 600, load: 610 },
  { playerId: 'p11', x: 80, y: 40, speed: 5.8, acceleration: 3.1, distance: 9200, hsr: 1500, sprint: 680, load: 640 },
];

// ======================== DataSubstrate ========================

export class DataSubstrate {
  private apiKey: string = '';
  private teamId: string = '';
  private baselines: Map<string, PlayerBaseline> = new Map();

  /** Placeholder configuration for Catapult API. */
  configure(apiKey: string, teamId: string): void {
    this.apiKey = apiKey;
    this.teamId = teamId;
  }

  /** Ingest a raw data frame and normalize to kernel-ready format. */
  ingestFrame(rawData: RawPlayerFrame[], ballX?: number, ballY?: number): NormalizedFrame {
    const players: NormalizedPlayerData[] = rawData.map(raw => {
      const maxLoad = 800; // typical match max load AU
      const normalizedLoad = clamp((raw.load / maxLoad) * 100, 0, 100);
      const state = this.inferState(raw);
      const angle = Math.atan2(raw.acceleration, raw.speed || 0.01);
      return {
        id: raw.playerId,
        x: raw.x,
        y: raw.y,
        velocity: { x: raw.speed * Math.cos(angle), y: raw.speed * Math.sin(angle) },
        load: normalizedLoad,
        state,
      };
    });

    return {
      timestamp: Date.now(),
      players,
      ballPosition: ballX !== undefined && ballY !== undefined ? { x: ballX, y: ballY } : undefined,
    };
  }

  /** Build baselines from historical sample data. */
  getBaselines(): PlayerBaseline[] {
    if (this.baselines.size === 0) this.computeBaselines(SAMPLE_PLAYERS);
    return Array.from(this.baselines.values());
  }

  /** Get sample data for testing. */
  getSampleFrame(): NormalizedFrame {
    return this.ingestFrame(SAMPLE_PLAYERS, 52, 34);
  }

  /** Adapt CSV text (header row + data rows) to raw frames. */
  static adaptCSV(csvText: string): RawPlayerFrame[] {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim());
      const get = (key: string) => {
        const idx = headers.indexOf(key);
        return idx >= 0 ? parseFloat(vals[idx]) || 0 : 0;
      };
      const getStr = (key: string) => {
        const idx = headers.indexOf(key);
        return idx >= 0 ? vals[idx] : '';
      };
      return {
        playerId: getStr('playerid') || getStr('player_id') || getStr('id'),
        x: get('x'), y: get('y'),
        speed: get('speed'), acceleration: get('acceleration') || get('acc'),
        distance: get('distance'), hsr: get('hsr'), sprint: get('sprint'), load: get('load'),
      };
    });
  }

  /** Adapt a JSON array to raw frames. */
  static adaptJSON(json: unknown[]): RawPlayerFrame[] {
    return json.map((raw: unknown) => {
      const item = raw as Record<string, unknown>;
      return {
      playerId: String(item.playerId ?? item.player_id ?? item.id ?? ''),
      x: Number(item.x ?? 0), y: Number(item.y ?? 0),
      speed: Number(item.speed ?? 0), acceleration: Number(item.acceleration ?? item.acc ?? 0),
      distance: Number(item.distance ?? 0), hsr: Number(item.hsr ?? 0),
      sprint: Number(item.sprint ?? 0), load: Number(item.load ?? 0),
    };
    });
  }

  // ———— Private ————

  private inferState(raw: RawPlayerFrame): PlayerPhase {
    if (raw.speed > 6) return 'attacking';
    if (raw.speed > 4) return 'pressing';
    if (raw.speed > 2.5) return 'building';
    if (raw.acceleration > 1.5) return 'transitioning';
    return 'defending';
  }

  private computeBaselines(frames: RawPlayerFrame[]): void {
    for (const f of frames) {
      this.baselines.set(f.playerId, {
        playerId: f.playerId,
        avgDistance: f.distance,
        avgHsr: f.hsr,
        avgSprint: f.sprint,
        avgLoad: f.load,
        injuryThreshold: f.load * 1.3,
      });
    }
  }
}
