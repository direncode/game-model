'use client';

import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface CoherenceGaugeProps {
  score: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function CoherenceGauge({
  score,
  label = 'Coherence',
  size = 'md',
  showLabel = true,
  className,
}: CoherenceGaugeProps) {
  const { color, bgColor, textColor } = useMemo(() => {
    if (score >= 80) {
      return {
        color: '#22c55e',
        bgColor: 'bg-green-100',
        textColor: 'text-green-600',
      };
    }
    if (score >= 60) {
      return {
        color: '#eab308',
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-600',
      };
    }
    if (score >= 40) {
      return {
        color: '#f97316',
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-600',
      };
    }
    return {
      color: '#ef4444',
      bgColor: 'bg-red-100',
      textColor: 'text-red-600',
    };
  }, [score]);

  const sizes = {
    sm: { width: 80, stroke: 6, fontSize: 'text-lg' },
    md: { width: 120, stroke: 8, fontSize: 'text-2xl' },
    lg: { width: 160, stroke: 10, fontSize: 'text-3xl' },
  };

  const { width, stroke, fontSize } = sizes[size];
  const radius = (width - stroke) / 2;
  const circumference = radius * Math.PI; // Semi-circle
  const progress = (score / 100) * circumference;

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative" style={{ width, height: width / 2 + 20 }}>
        <svg
          width={width}
          height={width / 2 + 10}
          className="transform -rotate-0"
        >
          {/* Background arc */}
          <path
            d={`M ${stroke / 2} ${width / 2} A ${radius} ${radius} 0 0 1 ${
              width - stroke / 2
            } ${width / 2}`}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <path
            d={`M ${stroke / 2} ${width / 2} A ${radius} ${radius} 0 0 1 ${
              width - stroke / 2
            } ${width / 2}`}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${progress} ${circumference}`}
            className="transition-all duration-500 ease-out"
          />
        </svg>

        {/* Score display */}
        <div
          className="absolute inset-0 flex items-end justify-center pb-2"
          style={{ height: width / 2 + 10 }}
        >
          <span className={cn('font-bold', fontSize, textColor)}>
            {Math.round(score)}%
          </span>
        </div>
      </div>

      {showLabel && (
        <span className="mt-1 text-sm font-medium text-gray-600">{label}</span>
      )}
    </div>
  );
}

interface CoherenceBarProps {
  score: number;
  label: string;
  className?: string;
}

export function CoherenceBar({ score, label, className }: CoherenceBarProps) {
  const color = useMemo(() => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  }, [score]);

  return (
    <div className={cn('w-full', className)}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-bold text-gray-900">{Math.round(score)}%</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

interface CoherenceGridProps {
  data: Map<string, number>;
  title: string;
  className?: string;
}

export function CoherenceGrid({ data, title, className }: CoherenceGridProps) {
  const entries = Array.from(data.entries());

  return (
    <div className={cn('w-full', className)}>
      <h4 className="text-sm font-semibold text-gray-900 mb-3">{title}</h4>
      <div className="grid grid-cols-2 gap-2">
        {entries.map(([key, value]) => (
          <CoherenceBar key={key} label={key} score={value} />
        ))}
      </div>
    </div>
  );
}
