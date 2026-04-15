"use client";

import { clsx } from "clsx";

interface HealthGaugeProps {
  score: number; // 0-100
  size?: "sm" | "md" | "lg";
  label?: string;
}

function getColor(score: number): string {
  if (score >= 80) return "#3fb950";
  if (score >= 50) return "#d29922";
  return "#f85149";
}

function getLabel(score: number): string {
  if (score >= 80) return "Healthy";
  if (score >= 50) return "Degraded";
  return "Critical";
}

const sizes = {
  sm: { width: 64, stroke: 5, font: "text-sm" },
  md: { width: 96, stroke: 6, font: "text-lg" },
  lg: { width: 128, stroke: 8, font: "text-2xl" },
};

export function HealthGauge({ score, size = "md", label }: HealthGaugeProps) {
  const { width, stroke, font } = sizes[size];
  const radius = (width - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getColor(score);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width, height: width }}>
        <svg width={width} height={width} className="-rotate-90">
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            fill="none"
            stroke="#1e1e2e"
            strokeWidth={stroke}
          />
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={clsx("font-mono font-semibold", font)} style={{ color }}>
            {score}
          </span>
        </div>
      </div>
      <span className="text-xs text-cp-gray-500">
        {label || getLabel(score)}
      </span>
    </div>
  );
}
