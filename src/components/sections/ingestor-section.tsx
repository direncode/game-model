'use client';

import { useState } from 'react';

interface Ingestor {
  id: string;
  num: string;
  name: string;
  type: string;
  tagline: string;
  body: string;
  sampling: string;
  records: string;
  dataPoints: { name: string; detail: string }[];
  outputTypes: string[];
  sourceFile: string;
}

const INGESTORS: Ingestor[] = [
  {
    id: 'football-data',
    num: '01',
    name: 'Football Data API',
    type: 'REST API',
    tagline: 'Real-world player and team statistics from multiple data providers',
    body: 'Comprehensive integration with Football-Data.org, API-Football, Understat, and FBref data models. Provides real-world 2024/25 season metrics for every Premier League player. Configurable provider switching with mock fallback for development. Built-in caching at 60-minute intervals to minimize API calls.',
    sampling: 'On-demand with 60-minute cache',
    records: '~48,000 per session',
    dataPoints: [
      { name: 'Player Physical Attributes', detail: 'Top speed, average sprint speed, acceleration, distance per game, sprints per game' },
      { name: 'Team Tactical Metrics', detail: 'Average possession percentage, PPDA, build-up speed, width metrics, compactness, defensive line height' },
      { name: 'Progressive Actions', detail: 'Progressive carries per 90, progressive passes per 90, key passes, final third entries' },
      { name: 'Positional Data', detail: 'Average position coordinates, touchline affinity percentage, heatmap data, zone occupancy rates' },
      { name: 'Pressing Metrics', detail: 'Pressing intensity, passes per defensive action, successful press rate, press trigger zones' },
    ],
    outputTypes: ['RealPlayerStats', 'RealTeamData', 'FootballAPIConfig'],
    sourceFile: 'src/lib/football-data-api.ts',
  },
  {
    id: 'premier-league',
    num: '02',
    name: 'Premier League API',
    type: 'REST API',
    tagline: 'Full squad rosters and physical profiles for all twenty Premier League clubs',
    body: 'Provides squad data, player profiles, and physical attributes for all twenty Premier League clubs. Generates starting XI selections based on position requirements and player ratings. Serves as the foundational player data layer that other modules reference.',
    sampling: 'On-demand with daily synchronization',
    records: '~12,800 per session',
    dataPoints: [
      { name: 'Squad Rosters', detail: 'Full 25-player squad data for all 20 clubs with positions and shirt numbers' },
      { name: 'Physical Profiles', detail: 'Maximum speed, acceleration, sprint capacity, high-intensity threshold, aerobic and anaerobic thresholds' },
      { name: 'Player Metadata', detail: 'Preferred foot, position, nationality, contract status, squad role' },
      { name: 'Starting XI Generation', detail: 'Automatic best-eleven selection based on position requirements and available player ratings' },
    ],
    outputTypes: ['Player', 'PhysicalProfile', 'PlayerPosition'],
    sourceFile: 'src/lib/premier-league-api.ts',
  },
  {
    id: 'catapult',
    num: '03',
    name: 'Catapult GPS/IMU',
    type: 'Streaming',
    tagline: '10Hz GPS and 100Hz IMU wearable device integration',
    body: 'Direct integration with Catapult Vector, Core, and Pro hardware units. GPS positioning at 10Hz sampling combined with 100Hz inertial measurement unit data from accelerometer, gyroscope, and magnetometer for sub-metre positional accuracy and biomechanical load tracking. Includes Polar and Garmin heart rate integration via Catapult OpenField.',
    sampling: 'GPS at 10Hz, IMU at 100Hz',
    records: '~2,340,000 per session',
    dataPoints: [
      { name: 'GPS Metrics', detail: 'Total distance, distance per minute, maximum speed, average speed, six-band speed zone classification, time-series position coordinates' },
      { name: 'IMU Metrics', detail: 'Three-axis accelerometer, gyroscope, and magnetometer at 100Hz — player load, impact detection, body orientation tracking' },
      { name: 'Fatigue Modeling', detail: 'Acute-to-chronic workload ratio, metabolic power in watts per kilogram, high metabolic load distance, fatigue threshold computation' },
      { name: 'Injury Risk', detail: 'Fatigue threshold alerts, load asymmetry detection, workload spike warnings, recovery status tracking' },
      { name: 'Heart Rate', detail: 'Five-zone heart rate analysis, recovery rate computation, cardiac load monitoring via Polar and Garmin integration' },
    ],
    outputTypes: ['CatapultPlayerSession', 'SpeedZoneData', 'GPSPosition', 'IMUMetrics'],
    sourceFile: 'src/lib/catapult-integration.ts',
  },
  {
    id: 'wearable-analytics',
    num: '04',
    name: 'Wearable Analytics',
    type: 'Processing Pipeline',
    tagline: 'Data transformation layer for speed zones, acceleration bands, and digital twin state',
    body: 'The processing and transformation layer for all wearable and GPS inputs. Classifies raw speed data into six zones from walking to maximum sprinting. Segments acceleration events into three intensity bands. Computes heart rate zone distributions. Generates digital twin state vectors and session comparison analytics against performance baselines.',
    sampling: 'Event-driven per ingest cycle',
    records: '~890,000 per session',
    dataPoints: [
      { name: 'Speed Zone Classification', detail: 'Six zones — walking (0-6 km/h), jogging (6-12), running (12-18), high-speed running (18-21), sprinting (21-24), maximum sprinting (24+)' },
      { name: 'Acceleration Analysis', detail: 'Three bands — low (1-2 m/s squared), medium (2-3), high (3+) — tracked for both accelerations and decelerations' },
      { name: 'Heart Rate Zones', detail: 'Five zones from 50 to 100 percent of maximum heart rate with time distribution, average, maximum, and recovery metrics' },
      { name: 'Digital Twin State', detail: 'Computed fatigue, readiness, position adherence, work rate, tactical compliance, and confidence level' },
      { name: 'Session Comparison', detail: 'Metric-by-metric comparison against performance baselines with significance scoring at normal, notable, or concerning levels' },
    ],
    outputTypes: ['TrackingMetrics', 'TwinState', 'SpeedZoneData', 'HeartRateZones'],
    sourceFile: 'src/lib/wearable-analytics.ts',
  },
];

export function IngestorSection() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <section id="ingestors" className="py-32 border-t border-[#2F343C]/40 bg-[#1C2127]">
      <div className="max-w-[1200px] mx-auto px-8">
        <p className="text-[13px] text-[#5F6B7C] tracking-[0.15em] uppercase mb-6">
          Ingestors
        </p>

        <h2
          className="text-[#F6F7F9] font-semibold leading-[1.08] tracking-tight max-w-[700px]"
          style={{ fontSize: 'clamp(2rem, 3.5vw, 3rem)', letterSpacing: '-0.025em' }}
        >
          Seamless data. Every source.
        </h2>

        <p className="text-[#8F99A8] text-base leading-relaxed max-w-[600px] mt-6 mb-20">
          Four ingestor modules connect to your existing infrastructure — GPS units,
          wearable devices, and performance APIs — with zero configuration overhead.
          There is no charge for getting your data into the platform or for getting it out.
        </p>

        {/* Ingestor blocks */}
        <div className="space-y-0">
          {INGESTORS.map((ing) => {
            const isOpen = expandedId === ing.id;
            return (
              <div key={ing.id} className="border-t border-[#2F343C]/40">
                <button
                  className="w-full text-left py-8 flex items-start gap-8 group"
                  onClick={() => setExpandedId(isOpen ? null : ing.id)}
                >
                  <span className="text-[13px] text-[#5F6B7C] font-mono pt-1 flex-shrink-0 w-8">
                    {ing.num}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-3">
                      <h3 className="text-[#F6F7F9] text-xl font-semibold group-hover:text-[#ABB3BF] transition-colors">
                        {ing.name}
                      </h3>
                      <span className="text-[12px] text-[#5F6B7C]">{ing.type}</span>
                    </div>
                    <p className="text-[#8F99A8] text-sm mt-1">{ing.tagline}</p>
                  </div>
                  <span className="text-[#5F6B7C] text-sm pt-1 flex-shrink-0">
                    {isOpen ? '\u2212' : '+'}
                  </span>
                </button>

                {isOpen && (
                  <div className="pb-12 pl-16 pr-8">
                    <p className="text-[#8F99A8] text-[15px] leading-relaxed max-w-[700px] mb-10">
                      {ing.body}
                    </p>

                    {/* Stats */}
                    <div className="flex items-center gap-10 mb-10">
                      <div>
                        <span className="text-[#F6F7F9] text-lg font-semibold">{ing.sampling}</span>
                        <span className="block text-[12px] text-[#5F6B7C] mt-1">Sampling Rate</span>
                      </div>
                      <div>
                        <span className="text-[#F6F7F9] text-lg font-semibold">{ing.records}</span>
                        <span className="block text-[12px] text-[#5F6B7C] mt-1">Records per Session</span>
                      </div>
                    </div>

                    {/* Data Points */}
                    <h4 className="text-[12px] text-[#5F6B7C] tracking-[0.15em] uppercase mb-4">
                      Data Points
                    </h4>
                    <div className="space-y-4 mb-8">
                      {ing.dataPoints.map((dp) => (
                        <div key={dp.name} className="pl-4 border-l border-[#2F343C]">
                          <span className="text-[#F6F7F9] text-sm font-medium">{dp.name}</span>
                          <p className="text-[#8F99A8] text-sm leading-relaxed mt-0.5">{dp.detail}</p>
                        </div>
                      ))}
                    </div>

                    {/* Output + source */}
                    <div className="flex items-start gap-12">
                      <div>
                        <h4 className="text-[12px] text-[#5F6B7C] tracking-[0.15em] uppercase mb-2">Output Types</h4>
                        <p className="text-[#8F99A8] text-sm font-mono">{ing.outputTypes.join(', ')}</p>
                      </div>
                      <div>
                        <h4 className="text-[12px] text-[#5F6B7C] tracking-[0.15em] uppercase mb-2">Source</h4>
                        <p className="text-[#5F6B7C] text-sm font-mono">{ing.sourceFile}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div className="border-t border-[#2F343C]/40" />
        </div>
      </div>
    </section>
  );
}
