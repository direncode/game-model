'use client';

import { useState, useEffect } from 'react';
import {
  Database,
  Radio,
  Wifi,
  Activity,
  CheckCircle2,
  AlertCircle,
  ArrowDownRight,
  BarChart3,
  Clock,
  Zap,
  ChevronRight,
} from 'lucide-react';

const BP = {
  bg: '#1C2127',
  bgAlt: '#252A31',
  border: '#2F343C',
  text: '#F6F7F9',
  textMuted: '#8F99A8',
  textDim: '#5F6B7C',
  blue: '#2D72D2',
  green: '#238551',
  orange: '#C87619',
  red: '#CD4246',
  purple: '#7C3AED',
  cyan: '#0EA5E9',
};

interface IngestorModule {
  id: string;
  name: string;
  description: string;
  type: 'api' | 'gps' | 'wearable' | 'tracking';
  icon: React.ReactNode;
  color: string;
  status: 'connected' | 'syncing' | 'idle' | 'error';
  dataPoints: string[];
  throughput: string;
  lastSync: string;
  records: number;
  sourceFile: string;
}

const INGESTORS: IngestorModule[] = [
  {
    id: 'football-data',
    name: 'Football Data API',
    description: 'Real-world player stats from Football-Data.org, API-Football, Understat, and FBref data models',
    type: 'api',
    icon: <Database className="w-5 h-5" />,
    color: BP.blue,
    status: 'connected',
    dataPoints: [
      'Player physical attributes (speed, acceleration, sprint capacity)',
      'Team tactical metrics (PPDA, build-up speed, width)',
      'Progressive carries per 90',
      'Average position coordinates',
      'Touchline affinity / heatmap data',
    ],
    throughput: '120 rec/s',
    lastSync: '2s ago',
    records: 48_250,
    sourceFile: 'src/lib/football-data-api.ts',
  },
  {
    id: 'premier-league',
    name: 'Premier League API',
    description: 'Squad data, player profiles, starting XI selection for all PL clubs',
    type: 'api',
    icon: <BarChart3 className="w-5 h-5" />,
    color: BP.purple,
    status: 'connected',
    dataPoints: [
      'Full squad rosters for 20 PL clubs',
      'Player physical profiles (maxSpeed, acceleration)',
      'Position and preferred foot data',
      'Sprint capacity metrics',
      'Starting XI generation',
    ],
    throughput: '85 rec/s',
    lastSync: '5s ago',
    records: 12_800,
    sourceFile: 'src/lib/premier-league-api.ts',
  },
  {
    id: 'catapult',
    name: 'Catapult GPS/IMU',
    description: 'Wearable device integration — Catapult Vector/Core/Pro with 10Hz GPS + 100Hz IMU',
    type: 'gps',
    icon: <Radio className="w-5 h-5" />,
    color: BP.green,
    status: 'syncing',
    dataPoints: [
      'GPS position data (10Hz sampling)',
      'IMU accelerometer / gyroscope (100Hz)',
      'Player load (acute/chronic ratio)',
      'Fatigue modeling + injury risk prediction',
      'Metabolic power and high-intensity distance',
    ],
    throughput: '1,000 rec/s',
    lastSync: 'live',
    records: 2_340_000,
    sourceFile: 'src/lib/catapult-integration.ts',
  },
  {
    id: 'wearable-analytics',
    name: 'Wearable Analytics',
    description: 'GPS/wearable data processing — metric transformation, speed zones, heart rate analysis',
    type: 'wearable',
    icon: <Activity className="w-5 h-5" />,
    color: BP.orange,
    status: 'connected',
    dataPoints: [
      'Speed zone classification (6 zones)',
      'Acceleration/deceleration thresholds',
      'Heart rate zone analysis (5 zones)',
      'Digital twin state calculation',
      'Session comparison analytics',
    ],
    throughput: '450 rec/s',
    lastSync: '1s ago',
    records: 890_000,
    sourceFile: 'src/lib/wearable-analytics.ts',
  },
];

function StatusBadge({ status }: { status: IngestorModule['status'] }) {
  const config = {
    connected: { color: BP.green, label: 'Connected', icon: <CheckCircle2 className="w-3 h-3" /> },
    syncing: { color: BP.cyan, label: 'Syncing', icon: <Wifi className="w-3 h-3 animate-pulse" /> },
    idle: { color: BP.textDim, label: 'Idle', icon: <Clock className="w-3 h-3" /> },
    error: { color: BP.red, label: 'Error', icon: <AlertCircle className="w-3 h-3" /> },
  }[status];

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ background: `${config.color}22`, color: config.color }}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

export function IngestorPanel() {
  const [selectedIngestor, setSelectedIngestor] = useState<string | null>(null);
  const [counters, setCounters] = useState<Record<string, number>>({});

  // Simulate live record counts incrementing
  useEffect(() => {
    const initial: Record<string, number> = {};
    INGESTORS.forEach((i) => (initial[i.id] = i.records));
    setCounters(initial);

    const interval = setInterval(() => {
      setCounters((prev) => {
        const next = { ...prev };
        INGESTORS.forEach((i) => {
          if (i.status === 'connected' || i.status === 'syncing') {
            next[i.id] = (next[i.id] || i.records) + Math.floor(Math.random() * 50);
          }
        });
        return next;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const selected = INGESTORS.find((i) => i.id === selectedIngestor);

  return (
    <div className="h-full flex" style={{ background: BP.bg }}>
      {/* Ingestor List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: BP.text }}>
                Data Ingestor Modules
              </h2>
              <p className="text-xs mt-0.5" style={{ color: BP.textDim }}>
                Seamless data pipelines feeding algorithm modules
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="px-2 py-1 rounded text-xs font-medium"
                style={{ background: `${BP.green}22`, color: BP.green }}
              >
                {INGESTORS.filter((i) => i.status !== 'error').length}/{INGESTORS.length} online
              </span>
            </div>
          </div>

          <div className="grid gap-4">
            {INGESTORS.map((ingestor) => (
              <div
                key={ingestor.id}
                className="rounded-lg border p-4 cursor-pointer transition-all duration-200 hover:border-opacity-100"
                style={{
                  background: selectedIngestor === ingestor.id ? `${ingestor.color}08` : BP.bgAlt,
                  borderColor: selectedIngestor === ingestor.id ? ingestor.color : BP.border,
                }}
                onClick={() =>
                  setSelectedIngestor(selectedIngestor === ingestor.id ? null : ingestor.id)
                }
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${ingestor.color}18` }}
                    >
                      <div style={{ color: ingestor.color }}>{ingestor.icon}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3
                          className="text-xs font-semibold"
                          style={{ color: BP.text }}
                        >
                          {ingestor.name}
                        </h3>
                        <StatusBadge status={ingestor.status} />
                      </div>
                      <p
                        className="text-[11px] mt-0.5 leading-relaxed max-w-lg"
                        style={{ color: BP.textMuted }}
                      >
                        {ingestor.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider" style={{ color: BP.textDim }}>
                        Records
                      </div>
                      <div className="text-sm font-mono font-semibold tabular-nums" style={{ color: BP.text }}>
                        {(counters[ingestor.id] || ingestor.records).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider" style={{ color: BP.textDim }}>
                        Throughput
                      </div>
                      <div className="text-xs font-mono" style={{ color: ingestor.color }}>
                        {ingestor.throughput}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider" style={{ color: BP.textDim }}>
                        Last Sync
                      </div>
                      <div className="text-xs font-mono" style={{ color: BP.textMuted }}>
                        {ingestor.lastSync}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Data points - shown when selected */}
                {selectedIngestor === ingestor.id && (
                  <div className="mt-4 pt-3 border-t" style={{ borderColor: BP.border }}>
                    <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: BP.textDim }}>
                      Data Points
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ingestor.dataPoints.map((point, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 px-2 py-1.5 rounded text-[11px]"
                          style={{ background: `${ingestor.color}0A`, color: BP.text }}
                        >
                          <ArrowDownRight
                            className="w-3 h-3 mt-0.5 flex-shrink-0"
                            style={{ color: ingestor.color }}
                          />
                          {point}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-[10px] font-mono" style={{ color: BP.textDim }}>
                      {ingestor.sourceFile}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pipeline summary */}
          <div
            className="mt-6 rounded-lg border p-4"
            style={{ background: BP.bgAlt, borderColor: BP.border }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4" style={{ color: BP.cyan }} />
              <span className="text-xs font-semibold" style={{ color: BP.text }}>
                Pipeline Flow
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px]" style={{ color: BP.textMuted }}>
              <span className="px-2 py-1 rounded" style={{ background: `${BP.blue}18`, color: BP.blue }}>
                Ingestors
              </span>
              <ChevronRight className="w-3 h-3" style={{ color: BP.textDim }} />
              <span className="px-2 py-1 rounded" style={{ background: `${BP.cyan}18`, color: BP.cyan }}>
                Data Normalization
              </span>
              <ChevronRight className="w-3 h-3" style={{ color: BP.textDim }} />
              <span className="px-2 py-1 rounded" style={{ background: `${BP.purple}18`, color: BP.purple }}>
                Algorithm Modules
              </span>
              <ChevronRight className="w-3 h-3" style={{ color: BP.textDim }} />
              <span className="px-2 py-1 rounded" style={{ background: `${BP.green}18`, color: BP.green }}>
                Analysis Output
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
