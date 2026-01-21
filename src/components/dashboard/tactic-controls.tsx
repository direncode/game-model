'use client';

import React from 'react';
import { TacticalPreset } from '@/lib/tactics-library';

interface IntensityProfile {
  pressing: number;
  possession: number;
  directness: number;
  tempo: number;
}

interface TacticControlsProps {
  preset?: TacticalPreset | null;
  intensityProfile: IntensityProfile;
  onIntensityChange: (profile: IntensityProfile) => void;
  className?: string;
}

export function TacticControls({
  preset,
  intensityProfile,
  onIntensityChange,
  className = '',
}: TacticControlsProps) {
  const handleSliderChange = (key: keyof IntensityProfile, value: number) => {
    onIntensityChange({
      ...intensityProfile,
      [key]: value,
    });
  };

  const getSliderColor = (value: number) => {
    if (value >= 80) return 'from-red-500 to-red-600';
    if (value >= 60) return 'from-yellow-500 to-yellow-600';
    if (value >= 40) return 'from-green-500 to-green-600';
    return 'from-blue-500 to-blue-600';
  };

  const getValueLabel = (key: string, value: number) => {
    if (key === 'pressing') {
      if (value >= 90) return 'Gegenpress';
      if (value >= 70) return 'High Press';
      if (value >= 50) return 'Mid Block';
      return 'Low Block';
    }
    if (key === 'possession') {
      if (value >= 80) return 'Tiki-Taka';
      if (value >= 60) return 'Control';
      if (value >= 40) return 'Balanced';
      return 'Direct';
    }
    if (key === 'directness') {
      if (value >= 80) return 'Route One';
      if (value >= 60) return 'Vertical';
      if (value >= 40) return 'Balanced';
      return 'Patient';
    }
    if (key === 'tempo') {
      if (value >= 80) return 'Blitz';
      if (value >= 60) return 'High';
      if (value >= 40) return 'Medium';
      return 'Slow';
    }
    return '';
  };

  const sliderConfig = [
    { key: 'pressing' as const, label: 'Pressing', icon: '⬆️', lowLabel: 'Low Block', highLabel: 'Gegenpress' },
    { key: 'possession' as const, label: 'Possession', icon: '🔄', lowLabel: 'Direct', highLabel: 'Tiki-Taka' },
    { key: 'directness' as const, label: 'Directness', icon: '⚡', lowLabel: 'Patient', highLabel: 'Route One' },
    { key: 'tempo' as const, label: 'Tempo', icon: '🏃', lowLabel: 'Slow', highLabel: 'Blitz' },
  ];

  return (
    <div className={`bg-gray-900 rounded-lg border border-gray-700 p-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Tactical Controls</h3>
        {preset && (
          <span className="px-2 py-0.5 text-xs bg-blue-600/20 text-blue-400 rounded border border-blue-500/30">
            {preset.name}
          </span>
        )}
      </div>

      {/* Sliders */}
      <div className="space-y-3">
        {sliderConfig.map(({ key, label, lowLabel, highLabel }) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">{label}</span>
              <span className={`text-xs font-medium ${
                intensityProfile[key] >= 80 ? 'text-red-400' :
                intensityProfile[key] >= 60 ? 'text-yellow-400' :
                intensityProfile[key] >= 40 ? 'text-green-400' : 'text-blue-400'
              }`}>
                {getValueLabel(key, intensityProfile[key])} ({intensityProfile[key]})
              </span>
            </div>

            <div className="relative">
              {/* Track */}
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${getSliderColor(intensityProfile[key])} transition-all`}
                  style={{ width: `${intensityProfile[key]}%` }}
                />
              </div>

              {/* Slider Input */}
              <input
                type="range"
                min="0"
                max="100"
                value={intensityProfile[key]}
                onChange={(e) => handleSliderChange(key, parseInt(e.target.value))}
                className="absolute inset-0 w-full h-2 opacity-0 cursor-pointer"
              />
            </div>

            {/* Labels */}
            <div className="flex justify-between mt-0.5">
              <span className="text-xs text-gray-600">{lowLabel}</span>
              <span className="text-xs text-gray-600">{highLabel}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Presets */}
      <div className="mt-4 pt-3 border-t border-gray-700">
        <div className="text-xs text-gray-400 mb-2">Quick Adjustments</div>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => onIntensityChange({ pressing: 95, possession: 90, directness: 30, tempo: 70 })}
            className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 transition-colors"
          >
            Total Football
          </button>
          <button
            onClick={() => onIntensityChange({ pressing: 98, possession: 55, directness: 70, tempo: 95 })}
            className="px-2 py-1 text-xs bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 transition-colors"
          >
            Heavy Metal
          </button>
          <button
            onClick={() => onIntensityChange({ pressing: 40, possession: 35, directness: 80, tempo: 50 })}
            className="px-2 py-1 text-xs bg-gray-600/20 text-gray-400 rounded hover:bg-gray-600/30 transition-colors"
          >
            Park the Bus
          </button>
          <button
            onClick={() => onIntensityChange({ pressing: 60, possession: 55, directness: 50, tempo: 60 })}
            className="px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded hover:bg-green-600/30 transition-colors"
          >
            Balanced
          </button>
        </div>
      </div>

      {/* Current Tactics Summary */}
      {preset && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="text-xs text-gray-400 mb-2">Active Tactics</div>
          <div className="space-y-1">
            <div className="flex flex-wrap gap-1">
              {preset.attackingTactics.slice(0, 4).map((t) => (
                <span key={t} className="px-1.5 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">
                  {t.replace(/_/g, ' ')}
                </span>
              ))}
              {preset.attackingTactics.length > 4 && (
                <span className="px-1.5 py-0.5 text-xs bg-green-500/10 text-green-500 rounded">
                  +{preset.attackingTactics.length - 4}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {preset.defensiveTactics.slice(0, 3).map((t) => (
                <span key={t} className="px-1.5 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">
                  {t.replace(/_/g, ' ')}
                </span>
              ))}
              {preset.defensiveTactics.length > 3 && (
                <span className="px-1.5 py-0.5 text-xs bg-red-500/10 text-red-500 rounded">
                  +{preset.defensiveTactics.length - 3}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TacticControls;
