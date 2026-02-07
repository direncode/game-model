'use client';

import { useMemo } from 'react';

// ── Types ──────────────────────────────────────────────────────────

export interface KernelData {
  id: string;
  name: string;
  color: string;
  positions: number[]; // y-positions along pitch depth (0–100)
  logs: KernelLogEntry[];
}

export interface KernelLogEntry {
  id: string;
  minute: number;
  message: string;
  type: 'shift' | 'compress' | 'expand' | 'break' | 'hold';
}

interface KernelWaveVizProps {
  kernels: KernelData[];
}

// ── Kernel Density Estimation ──────────────────────────────────────

function gaussianKDE(
  positions: number[],
  numPoints: number = 100,
  bandwidth: number = 5,
): number[] {
  if (positions.length === 0) {
    return new Array(numPoints + 1).fill(0);
  }
  const values: number[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const x = (i / numPoints) * 100;
    let density = 0;
    for (const pos of positions) {
      density += Math.exp(-((x - pos) ** 2) / (2 * bandwidth ** 2));
    }
    density /= positions.length;
    values.push(density);
  }
  return values;
}

// ── SVG path helpers ───────────────────────────────────────────────

function valuesToFillPath(
  values: number[],
  w: number,
  h: number,
  maxVal: number,
): string {
  const ceiling = maxVal || 0.01;
  const step = w / (values.length - 1);
  let d = `M 0 ${h}`;
  values.forEach((v, i) => {
    d += ` L ${(i * step).toFixed(1)} ${(h - (v / ceiling) * h * 0.85).toFixed(1)}`;
  });
  d += ` L ${w} ${h} Z`;
  return d;
}

function valuesToLinePath(
  values: number[],
  w: number,
  h: number,
  maxVal: number,
): string {
  const ceiling = maxVal || 0.01;
  const step = w / (values.length - 1);
  let d = '';
  values.forEach((v, i) => {
    const x = (i * step).toFixed(1);
    const y = (h - (v / ceiling) * h * 0.85).toFixed(1);
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });
  return d;
}

// ── Individual Kernel Card ─────────────────────────────────────────

function KernelCard({
  kernel,
  maxGlobalVal,
}: {
  kernel: KernelData;
  maxGlobalVal: number;
}) {
  const kde = useMemo(
    () => gaussianKDE(kernel.positions),
    [kernel.positions],
  );

  const mean =
    kernel.positions.length > 0
      ? kernel.positions.reduce((a, b) => a + b, 0) / kernel.positions.length
      : 0;

  const stdDev =
    kernel.positions.length > 1
      ? Math.sqrt(
          kernel.positions.reduce((s, p) => s + (p - mean) ** 2, 0) /
            kernel.positions.length,
        )
      : 0;

  const W = 200;
  const H = 60;

  return (
    <div className="bg-zinc-900/80 rounded-lg border border-white/5 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-2.5 py-1.5 flex items-center justify-between bg-black/30">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: kernel.color }}
          />
          <span className="text-[10px] font-medium text-white/80">
            {kernel.name}
          </span>
        </div>
        <span className="text-[9px] text-white/40 tabular-nums">
          {'\u03bc'}={mean.toFixed(0)} {'\u03c3'}={stdDev.toFixed(1)}
        </span>
      </div>

      {/* Wave function chart */}
      <div className="px-1 py-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-16"
          preserveAspectRatio="none"
        >
          {/* Subtle grid lines at 25%, 50%, 75% */}
          {[25, 50, 75].map((p) => (
            <line
              key={p}
              x1={(p * W) / 100}
              y1="0"
              x2={(p * W) / 100}
              y2={H}
              stroke="white"
              strokeOpacity="0.05"
              strokeWidth="0.5"
            />
          ))}
          {/* Filled area under curve */}
          <path
            d={valuesToFillPath(kde, W, H, maxGlobalVal)}
            fill={kernel.color}
            fillOpacity="0.15"
          />
          {/* Curve line */}
          <path
            d={valuesToLinePath(kde, W, H, maxGlobalVal)}
            fill="none"
            stroke={kernel.color}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Mean indicator */}
          <line
            x1={(mean * W) / 100}
            y1="0"
            x2={(mean * W) / 100}
            y2={H}
            stroke={kernel.color}
            strokeWidth="0.5"
            strokeDasharray="2 2"
            strokeOpacity="0.5"
          />
          {/* Player position dots on baseline */}
          {kernel.positions.map((pos, i) => (
            <circle
              key={i}
              cx={(pos * W) / 100}
              cy={H - 3}
              r="2"
              fill={kernel.color}
              fillOpacity="0.8"
            />
          ))}
        </svg>
      </div>

      {/* Per-kernel log */}
      <div className="px-2 py-1 border-t border-white/5 flex-1 overflow-y-auto min-h-[40px] max-h-24">
        {kernel.logs.length === 0 ? (
          <div className="text-[9px] text-white/20 text-center py-1">
            Awaiting events
          </div>
        ) : (
          kernel.logs.slice(0, 8).map((log) => (
            <div
              key={log.id}
              className="flex items-center gap-1.5 py-0.5 text-[9px]"
            >
              <span className="text-white/30 tabular-nums w-5 text-right shrink-0">
                {log.minute}&apos;
              </span>
              <span
                className={
                  log.type === 'shift'
                    ? 'text-amber-300'
                    : log.type === 'compress'
                      ? 'text-sky-300'
                      : log.type === 'expand'
                        ? 'text-orange-300'
                        : log.type === 'break'
                          ? 'text-red-300'
                          : 'text-white/50'
                }
              >
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Composite Wave Function ────────────────────────────────────────

function CompositeWave({
  kernels,
}: {
  kernels: KernelData[];
}) {
  const kdes = useMemo(
    () => kernels.map((k) => ({ ...k, kde: gaussianKDE(k.positions) })),
    [kernels],
  );

  const composite = useMemo(() => {
    const n = 101;
    const values = new Array(n).fill(0);
    kdes.forEach((k) => {
      k.kde.forEach((v, i) => {
        values[i] += v;
      });
    });
    return values as number[];
  }, [kdes]);

  const compositeMax = Math.max(...composite, 0.01);

  const W = 400;
  const H = 80;

  return (
    <div className="bg-zinc-900/80 rounded-lg border border-white/5 overflow-hidden">
      <div className="px-2.5 py-1.5 flex items-center justify-between bg-black/30">
        <span className="text-[10px] font-medium text-white/80">
          Composite Wave Function
        </span>
        <div className="flex items-center gap-3">
          {kernels.map((k) => (
            <div key={k.id} className="flex items-center gap-1">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: k.color }}
              />
              <span className="text-[8px] text-white/40">
                {k.name.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-1 py-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-28"
          preserveAspectRatio="none"
        >
          {/* Grid */}
          {[25, 50, 75].map((p) => (
            <line
              key={p}
              x1={(p * W) / 100}
              y1="0"
              x2={(p * W) / 100}
              y2={H}
              stroke="white"
              strokeOpacity="0.05"
              strokeWidth="0.5"
            />
          ))}
          {/* Pitch zone labels */}
          <text x="4" y={H - 3} fontSize="5" fill="white" fillOpacity="0.15">
            Own Goal
          </text>
          <text
            x={W - 4}
            y={H - 3}
            fontSize="5"
            fill="white"
            fillOpacity="0.15"
            textAnchor="end"
          >
            Opp Goal
          </text>

          {/* Individual kernel lines (behind composite) */}
          {kdes.map((k) => (
            <path
              key={k.id}
              d={valuesToLinePath(k.kde, W, H, compositeMax)}
              fill="none"
              stroke={k.color}
              strokeWidth="1"
              strokeOpacity="0.4"
              strokeDasharray="3 2"
            />
          ))}

          {/* Composite filled area */}
          <path
            d={valuesToFillPath(composite, W, H, compositeMax)}
            fill="white"
            fillOpacity="0.04"
          />
          {/* Composite line */}
          <path
            d={valuesToLinePath(composite, W, H, compositeMax)}
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeOpacity="0.6"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

// ── Blank Pitch SVG ────────────────────────────────────────────────

export function BlankPitch({ kernels }: { kernels: KernelData[] }) {
  return (
    <svg
      viewBox="0 0 68 105"
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* Grass stripe pattern */}
        <pattern id="grass" width="68" height="6" patternUnits="userSpaceOnUse">
          <rect width="68" height="3" fill="#14532d" opacity="0.15" />
          <rect y="3" width="68" height="3" fill="#15803d" opacity="0.08" />
        </pattern>
      </defs>

      {/* Background */}
      <rect width="68" height="105" fill="#0a1a0a" />
      <rect width="68" height="105" fill="url(#grass)" />

      {/* Kernel density zones (horizontal bands showing where each line sits) */}
      {kernels.map((kernel) => {
        const mean =
          kernel.positions.length > 0
            ? kernel.positions.reduce((a, b) => a + b, 0) /
              kernel.positions.length
            : 50;
        const stdDev =
          kernel.positions.length > 1
            ? Math.sqrt(
                kernel.positions.reduce((s, p) => s + (p - mean) ** 2, 0) /
                  kernel.positions.length,
              )
            : 5;
        // Map 0-100 to 0-105 (pitch length along y-axis)
        const cy = (mean / 100) * 105;
        const spread = Math.max((stdDev / 100) * 105 * 2, 4);
        return (
          <rect
            key={kernel.id}
            x="0"
            y={cy - spread / 2}
            width="68"
            height={spread}
            fill={kernel.color}
            fillOpacity="0.06"
            rx="1"
          />
        );
      })}

      {/* Pitch outline */}
      <rect
        x="1"
        y="1"
        width="66"
        height="103"
        fill="none"
        stroke="#2d5a2d"
        strokeWidth="0.4"
      />

      {/* Halfway line */}
      <line
        x1="1"
        y1="52.5"
        x2="67"
        y2="52.5"
        stroke="#2d5a2d"
        strokeWidth="0.3"
      />
      {/* Center circle */}
      <circle
        cx="34"
        cy="52.5"
        r="9.15"
        fill="none"
        stroke="#2d5a2d"
        strokeWidth="0.3"
      />
      <circle cx="34" cy="52.5" r="0.5" fill="#2d5a2d" />

      {/* Bottom goal area (own goal, y near 0) */}
      <rect
        x="13.85"
        y="1"
        width="40.3"
        height="16.5"
        fill="none"
        stroke="#2d5a2d"
        strokeWidth="0.3"
      />
      <rect
        x="22.15"
        y="1"
        width="23.7"
        height="5.5"
        fill="none"
        stroke="#2d5a2d"
        strokeWidth="0.3"
      />
      {/* Penalty spot */}
      <circle cx="34" cy="12" r="0.4" fill="#2d5a2d" />
      {/* Penalty arc */}
      <path
        d="M 26.5 16.5 A 9.15 9.15 0 0 0 41.5 16.5"
        fill="none"
        stroke="#2d5a2d"
        strokeWidth="0.3"
      />

      {/* Top goal area (opp goal, y near 105) */}
      <rect
        x="13.85"
        y="87.5"
        width="40.3"
        height="16.5"
        fill="none"
        stroke="#2d5a2d"
        strokeWidth="0.3"
      />
      <rect
        x="22.15"
        y="98.5"
        width="23.7"
        height="5.5"
        fill="none"
        stroke="#2d5a2d"
        strokeWidth="0.3"
      />
      <circle cx="34" cy="93" r="0.4" fill="#2d5a2d" />
      <path
        d="M 26.5 87.5 A 9.15 9.15 0 0 1 41.5 87.5"
        fill="none"
        stroke="#2d5a2d"
        strokeWidth="0.3"
      />

      {/* Corner arcs */}
      <path
        d="M 1 2 A 1 1 0 0 0 2 1"
        fill="none"
        stroke="#2d5a2d"
        strokeWidth="0.3"
      />
      <path
        d="M 66 1 A 1 1 0 0 0 67 2"
        fill="none"
        stroke="#2d5a2d"
        strokeWidth="0.3"
      />
      <path
        d="M 1 103 A 1 1 0 0 1 2 104"
        fill="none"
        stroke="#2d5a2d"
        strokeWidth="0.3"
      />
      <path
        d="M 66 104 A 1 1 0 0 1 67 103"
        fill="none"
        stroke="#2d5a2d"
        strokeWidth="0.3"
      />

      {/* Kernel mean position indicators (horizontal dashed lines) */}
      {kernels.map((kernel) => {
        const mean =
          kernel.positions.length > 0
            ? kernel.positions.reduce((a, b) => a + b, 0) /
              kernel.positions.length
            : 50;
        const cy = (mean / 100) * 105;
        return (
          <line
            key={`mean-${kernel.id}`}
            x1="3"
            x2="65"
            y1={cy}
            y2={cy}
            stroke={kernel.color}
            strokeWidth="0.3"
            strokeDasharray="1.5 1"
            strokeOpacity="0.4"
          />
        );
      })}

      {/* Kernel position dots */}
      {kernels.map((kernel) =>
        kernel.positions.map((pos, i) => {
          const cy = (pos / 100) * 105;
          // Spread dots across pitch width
          const cx =
            kernel.positions.length === 1
              ? 34
              : 10 + (i / (kernel.positions.length - 1)) * 48;
          return (
            <circle
              key={`dot-${kernel.id}-${i}`}
              cx={cx}
              cy={cy}
              r="1.2"
              fill={kernel.color}
              fillOpacity="0.5"
              stroke={kernel.color}
              strokeWidth="0.3"
              strokeOpacity="0.8"
            />
          );
        }),
      )}
    </svg>
  );
}

// ── Main Export ─────────────────────────────────────────────────────

export function KernelWaveViz({ kernels }: KernelWaveVizProps) {
  const maxGlobalVal = useMemo(() => {
    let max = 0;
    kernels.forEach((k) => {
      const kde = gaussianKDE(k.positions);
      const localMax = Math.max(...kde);
      if (localMax > max) max = localMax;
    });
    return max || 0.01;
  }, [kernels]);

  return (
    <div className="flex flex-col gap-2 h-full overflow-auto p-2">
      {/* Individual kernel cards */}
      <div className="grid grid-cols-3 gap-2">
        {kernels.map((k) => (
          <KernelCard key={k.id} kernel={k} maxGlobalVal={maxGlobalVal} />
        ))}
      </div>

      {/* Composite wave function */}
      <CompositeWave kernels={kernels} />
    </div>
  );
}
