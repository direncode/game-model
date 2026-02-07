'use client';

import { useState, useEffect } from 'react';
import {
  Database, Radio, Activity, BarChart3,
  CheckCircle2, Wifi, ArrowDownRight, Zap,
  ChevronRight, Server, Cable, Cpu,
} from 'lucide-react';

interface Ingestor {
  id: string;
  name: string;
  description: string;
  type: string;
  icon: React.ReactNode;
  color: string;
  status: 'live' | 'connected' | 'idle';
  sourceFile: string;
  samplingRate: string;
  dataPoints: { name: string; detail: string }[];
  outputSchema: string[];
  protocols: string[];
  recordsPerSession: string;
}

const INGESTORS: Ingestor[] = [
  {
    id: 'football-data',
    name: 'Football Data API',
    description: 'Comprehensive player and team statistics from Football-Data.org, API-Football, Understat, and FBref data models. Provides real-world 2024/25 season metrics for every Premier League player.',
    type: 'REST API',
    icon: <Database className="w-6 h-6" />,
    color: '#2D72D2',
    status: 'connected',
    sourceFile: 'src/lib/football-data-api.ts',
    samplingRate: 'On-demand + 60min cache',
    dataPoints: [
      { name: 'Player Physical Attributes', detail: 'Top speed (km/h), avg sprint speed, acceleration (m/s²), distance per game (km), sprints per game' },
      { name: 'Team Tactical Metrics', detail: 'Average possession %, PPDA, build-up speed, width metrics, compactness, defensive line height' },
      { name: 'Progressive Actions', detail: 'Progressive carries per 90, progressive passes per 90, key passes' },
      { name: 'Positional Data', detail: 'Average position coordinates, touchline affinity, heatmap data, zone occupancy' },
      { name: 'Pressing Metrics', detail: 'Pressing intensity, PPDA (passes per defensive action), successful press rate' },
    ],
    outputSchema: ['RealPlayerStats', 'RealTeamData', 'FootballAPIConfig'],
    protocols: ['REST', 'JSON', 'Rate-limited', 'Cached'],
    recordsPerSession: '~48,000',
  },
  {
    id: 'premier-league',
    name: 'Premier League API',
    description: 'Full squad rosters, player profiles, and physical attributes for all 20 Premier League clubs. Generates starting XI selections and provides the foundational player data layer.',
    type: 'REST API',
    icon: <BarChart3 className="w-6 h-6" />,
    color: '#7961DB',
    status: 'connected',
    sourceFile: 'src/lib/premier-league-api.ts',
    samplingRate: 'On-demand + daily sync',
    dataPoints: [
      { name: 'Squad Rosters', detail: 'Full 25-man squad data for all 20 PL clubs with positions and shirt numbers' },
      { name: 'Physical Profiles', detail: 'maxSpeed (km/h), acceleration (m/s²), sprintCapacity (m), thresholds' },
      { name: 'Player Metadata', detail: 'Preferred foot, position, nationality, age, contract status' },
      { name: 'Starting XI Generation', detail: 'Automatic best-XI selection based on position requirements and player ratings' },
    ],
    outputSchema: ['Player', 'PhysicalProfile', 'PlayerPosition'],
    protocols: ['REST', 'JSON', 'Mock fallback'],
    recordsPerSession: '~12,800',
  },
  {
    id: 'catapult',
    name: 'Catapult GPS/IMU',
    description: 'Wearable device integration for Catapult Vector, Core, and Pro units. 10Hz GPS positioning combined with 100Hz IMU (accelerometer, gyroscope, magnetometer) for submeter positional accuracy and biomechanical load tracking.',
    type: 'Streaming',
    icon: <Radio className="w-6 h-6" />,
    color: '#238551',
    status: 'live',
    sourceFile: 'src/lib/catapult-integration.ts',
    samplingRate: 'GPS: 10Hz | IMU: 100Hz',
    dataPoints: [
      { name: 'GPS Metrics', detail: 'Total distance, distance/min, max speed, avg speed, speed zones (6 bands), time-series positions' },
      { name: 'IMU Metrics', detail: 'Accelerometer, gyroscope, magnetometer at 100Hz — player load, impacts, body orientation' },
      { name: 'Fatigue Modeling', detail: 'Acute:chronic workload ratio, metabolic power (W/kg), high metabolic load distance' },
      { name: 'Injury Risk', detail: 'Fatigue threshold alerts, asymmetry detection, load spike warnings, recovery status' },
      { name: 'Heart Rate Integration', detail: 'Polar/Garmin via Catapult OpenField — 5-zone HR analysis, recovery rate, cardiac load' },
    ],
    outputSchema: ['CatapultPlayerSession', 'SpeedZoneData', 'GPSPosition', 'IMUMetrics'],
    protocols: ['WebSocket', 'Binary', 'Real-time', 'Encrypted'],
    recordsPerSession: '~2,340,000',
  },
  {
    id: 'wearable-analytics',
    name: 'Wearable Analytics',
    description: 'Data processing and transformation layer for all wearable/GPS inputs. Classifies speed zones, acceleration bands, and heart rate zones. Computes digital twin states and session comparison metrics.',
    type: 'Processing Pipeline',
    icon: <Activity className="w-6 h-6" />,
    color: '#C87619',
    status: 'connected',
    sourceFile: 'src/lib/wearable-analytics.ts',
    samplingRate: 'Event-driven (per ingest)',
    dataPoints: [
      { name: 'Speed Zone Classification', detail: '6 zones: Walking (0-6), Jogging (6-12), Running (12-18), HSR (18-21), Sprinting (21-24), Max (24+) km/h' },
      { name: 'Acceleration Analysis', detail: '3 bands: Low (1-2 m/s²), Medium (2-3 m/s²), High (3+ m/s²) — accelerations and decelerations' },
      { name: 'Heart Rate Zones', detail: '5 zones from 50-100% max HR — time distribution, avg HR, max HR, recovery metrics' },
      { name: 'Digital Twin State', detail: 'Computed fatigue, readiness, position adherence, work rate, tactical compliance, confidence' },
      { name: 'Session Comparison', detail: 'Metric-by-metric comparison against performance baselines with significance scoring' },
    ],
    outputSchema: ['TrackingMetrics', 'TwinState', 'SpeedZoneData', 'HeartRateZones'],
    protocols: ['Internal pipeline', 'Event-driven', 'Batch + stream'],
    recordsPerSession: '~890,000',
  },
];

function StatusIndicator({ status }: { status: Ingestor['status'] }) {
  const config = {
    live: { color: '#238551', label: 'Live', pulse: true },
    connected: { color: '#2D72D2', label: 'Connected', pulse: false },
    idle: { color: '#5F6B7C', label: 'Idle', pulse: false },
  }[status];

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: `${config.color}18`, color: config.color }}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.pulse ? 'animate-data-pulse' : ''}`} style={{ background: config.color }} />
      {config.label}
    </span>
  );
}

export function IngestorSection() {
  const [selectedId, setSelectedId] = useState<string | null>('catapult');

  const selected = INGESTORS.find((i) => i.id === selectedId);

  return (
    <section id="ingestors" className="section-full section-alt">
      <div className="section-container">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="text-overline mb-3 text-[#238551]">Ingestors</div>
          <h2 className="text-heading-1 text-[#F6F7F9] mb-4">
            Seamless data. Every source.
          </h2>
          <p className="text-body-large">
            Four ingestor modules connect to your existing infrastructure — GPS units,
            wearable devices, and performance APIs — with zero configuration overhead.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-6 max-w-6xl mx-auto">
          {/* Ingestor list */}
          <div className="lg:col-span-2 space-y-3">
            {INGESTORS.map((ingestor) => (
              <button
                key={ingestor.id}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                  selectedId === ingestor.id ? 'border-opacity-100' : 'hover:border-[#404854]'
                }`}
                style={{
                  background: selectedId === ingestor.id ? `${ingestor.color}08` : 'var(--surface)',
                  borderColor: selectedId === ingestor.id ? ingestor.color : 'var(--border)',
                }}
                onClick={() => setSelectedId(ingestor.id)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${ingestor.color}15` }}
                  >
                    <div style={{ color: ingestor.color }}>{ingestor.icon}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-[#F6F7F9] truncate">{ingestor.name}</h4>
                      <StatusIndicator status={ingestor.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-[#5F6B7C]">{ingestor.type}</span>
                      <span className="text-[11px] text-[#5F6B7C]">{ingestor.samplingRate}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#5F6B7C] flex-shrink-0" />
                </div>
              </button>
            ))}

            {/* Pipeline graphic */}
            <div className="mt-4 p-4 rounded-xl border border-[#2F343C] bg-[#1C2127]">
              <div className="flex items-center gap-2 mb-3">
                <Cable className="w-4 h-4 text-[#0EA5E9]" />
                <span className="text-xs font-semibold text-[#F6F7F9]">Pipeline Flow</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                <span className="px-2 py-1 rounded bg-[#2D72D2]/10 text-[#4C90F0]">Ingestors</span>
                <ChevronRight className="w-3 h-3 text-[#404854]" />
                <span className="px-2 py-1 rounded bg-[#0EA5E9]/10 text-[#0EA5E9]">Normalize</span>
                <ChevronRight className="w-3 h-3 text-[#404854]" />
                <span className="px-2 py-1 rounded bg-[#7961DB]/10 text-[#7961DB]">Algorithms</span>
                <ChevronRight className="w-3 h-3 text-[#404854]" />
                <span className="px-2 py-1 rounded bg-[#238551]/10 text-[#32A467]">Output</span>
              </div>
            </div>
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-3">
            {selected ? (
              <div className="rounded-xl border p-6 h-full" style={{ background: `${selected.color}04`, borderColor: selected.color }}>
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <div className="text-overline mb-1" style={{ color: selected.color }}>{selected.type}</div>
                    <h3 className="text-heading-2 text-[#F6F7F9]">{selected.name}</h3>
                  </div>
                  <StatusIndicator status={selected.status} />
                </div>

                <p className="text-body mb-6">{selected.description}</p>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-3 rounded-lg bg-[#1C2127] border border-[#2F343C]">
                    <div className="text-overline mb-1">Sampling</div>
                    <div className="text-sm font-semibold text-[#F6F7F9]">{selected.samplingRate}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#1C2127] border border-[#2F343C]">
                    <div className="text-overline mb-1">Records / Session</div>
                    <div className="text-sm font-semibold text-[#F6F7F9]">{selected.recordsPerSession}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#1C2127] border border-[#2F343C]">
                    <div className="text-overline mb-1">Protocols</div>
                    <div className="text-sm font-semibold text-[#F6F7F9]">{selected.protocols[0]}</div>
                  </div>
                </div>

                {/* Data points */}
                <div className="text-overline mb-3" style={{ color: selected.color }}>Data Points</div>
                <div className="space-y-2.5 mb-6">
                  {selected.dataPoints.map((dp) => (
                    <div key={dp.name} className="p-3 rounded-lg bg-[#1C2127]/80 border border-[#2F343C]/50">
                      <div className="flex items-center gap-2 mb-1">
                        <ArrowDownRight className="w-3.5 h-3.5" style={{ color: selected.color }} />
                        <span className="text-sm font-semibold text-[#F6F7F9]">{dp.name}</span>
                      </div>
                      <p className="text-xs text-[#8F99A8] leading-relaxed pl-5">{dp.detail}</p>
                    </div>
                  ))}
                </div>

                {/* Output schema + protocols */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-overline mb-2">Output Schema</div>
                    <div className="space-y-1">
                      {selected.outputSchema.map((s) => (
                        <div key={s} className="text-xs font-mono px-2 py-1 rounded bg-[#2F343C]/50" style={{ color: selected.color }}>
                          {s}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-overline mb-2">Protocols</div>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.protocols.map((p) => (
                        <span key={p} className="text-xs px-2 py-1 rounded bg-[#2F343C]/50 text-[#8F99A8]">
                          {p}
                        </span>
                      ))}
                    </div>
                    <div className="text-[11px] font-mono text-[#5F6B7C] mt-3">{selected.sourceFile}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-[#2F343C] bg-[#252A31] p-12 h-full flex items-center justify-center text-center">
                <div>
                  <Server className="w-10 h-10 text-[#5F6B7C] mx-auto mb-3" />
                  <p className="text-sm text-[#8F99A8]">Select an ingestor to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
