'use client';

import React, { useState, useMemo } from 'react';
import {
  ALL_TACTICS,
  FORMATIONS,
  TACTICAL_PRESETS,
  Tactic,
  TacticPhase,
  Formation,
  TacticalPreset,
  searchTactics,
  calculateSynergy,
} from '@/lib/tactics-library';

interface TacticsLibraryProps {
  onTacticSelect?: (tactic: Tactic) => void;
  onFormationSelect?: (formation: Formation) => void;
  onPresetSelect?: (preset: TacticalPreset) => void;
  selectedTactics?: string[];
  selectedFormation?: string;
  selectedPreset?: string;
  className?: string;
}

type TabType = 'tactics' | 'formations' | 'presets';

export function TacticsLibrary({
  onTacticSelect,
  onFormationSelect,
  onPresetSelect,
  selectedTactics = [],
  selectedFormation,
  selectedPreset,
  className = '',
}: TacticsLibraryProps) {
  const [activeTab, setActiveTab] = useState<TabType>('presets');
  const [searchQuery, setSearchQuery] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<TacticPhase | 'all'>('all');
  const [expandedTactic, setExpandedTactic] = useState<string | null>(null);

  const filteredTactics = useMemo(() => {
    let tactics = searchQuery ? searchTactics(searchQuery) : ALL_TACTICS;
    if (phaseFilter !== 'all') {
      tactics = tactics.filter((t) => t.phase === phaseFilter);
    }
    return tactics;
  }, [searchQuery, phaseFilter]);

  const synergyBoost = useMemo(() => {
    return calculateSynergy(selectedTactics);
  }, [selectedTactics]);

  const handleDragStart = (e: React.DragEvent, tactic: Tactic) => {
    e.dataTransfer.setData('tactic', JSON.stringify(tactic));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const getPhaseColor = (phase: TacticPhase) => {
    switch (phase) {
      case 'attacking':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'defensive':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'transition':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'formation':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getIntensityColor = (intensity: number) => {
    if (intensity >= 8) return 'text-red-400';
    if (intensity >= 6) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className={`bg-gray-900 rounded-lg border border-gray-700 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-3 border-b border-gray-700 bg-gray-800">
        <h2 className="text-sm font-semibold text-white mb-2">Tactics Library</h2>

        {/* Tabs */}
        <div className="flex gap-1 mb-2">
          {(['presets', 'tactics', 'formations'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Search */}
        {activeTab === 'tactics' && (
          <input
            type="text"
            placeholder="Search tactics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        )}
      </div>

      {/* Phase Filter (Tactics tab only) */}
      {activeTab === 'tactics' && (
        <div className="px-3 py-2 border-b border-gray-700 flex gap-1 flex-wrap">
          {(['all', 'attacking', 'defensive', 'transition'] as const).map((phase) => (
            <button
              key={phase}
              onClick={() => setPhaseFilter(phase)}
              className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                phaseFilter === phase
                  ? phase === 'all'
                    ? 'bg-blue-600 text-white border-blue-500'
                    : getPhaseColor(phase as TacticPhase)
                  : 'bg-gray-800 text-gray-400 border-gray-600 hover:border-gray-500'
              }`}
            >
              {phase === 'all' ? 'All' : phase.charAt(0).toUpperCase() + phase.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Synergy Display */}
      {selectedTactics.length > 0 && activeTab === 'tactics' && (
        <div className="px-3 py-2 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Synergy Boost:</span>
            <span className={`font-medium ${synergyBoost > 50 ? 'text-green-400' : synergyBoost > 25 ? 'text-yellow-400' : 'text-gray-400'}`}>
              +{synergyBoost}%
            </span>
          </div>
          <div className="mt-1 h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all"
              style={{ width: `${Math.min(100, synergyBoost)}%` }}
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {/* Presets Tab */}
        {activeTab === 'presets' && (
          <div className="p-2 space-y-2">
            {TACTICAL_PRESETS.map((preset) => (
              <div
                key={preset.id}
                onClick={() => onPresetSelect?.(preset)}
                className={`p-2 rounded border cursor-pointer transition-all ${
                  selectedPreset === preset.id
                    ? 'bg-blue-600/20 border-blue-500'
                    : 'bg-gray-800 border-gray-700 hover:border-gray-500'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-white">{preset.name}</span>
                  <span className="text-xs text-gray-500">{preset.formation}</span>
                </div>
                {preset.manager && (
                  <div className="text-xs text-gray-400 mb-1">{preset.manager}</div>
                )}
                <p className="text-xs text-gray-500 line-clamp-2">{preset.description}</p>

                {/* Intensity Profile */}
                <div className="mt-2 grid grid-cols-4 gap-1">
                  {Object.entries(preset.intensityProfile).map(([key, value]) => (
                    <div key={key} className="text-center">
                      <div className="text-xs text-gray-500 capitalize">{key.slice(0, 4)}</div>
                      <div className={`text-xs font-medium ${
                        value >= 80 ? 'text-red-400' : value >= 50 ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tactics Tab */}
        {activeTab === 'tactics' && (
          <div className="p-2 space-y-1">
            {filteredTactics.map((tactic) => (
              <div
                key={tactic.id}
                draggable
                onDragStart={(e) => handleDragStart(e, tactic)}
                onClick={() => {
                  setExpandedTactic(expandedTactic === tactic.id ? null : tactic.id);
                  onTacticSelect?.(tactic);
                }}
                className={`p-2 rounded border cursor-pointer transition-all ${
                  selectedTactics.includes(tactic.id)
                    ? 'bg-blue-600/20 border-blue-500'
                    : 'bg-gray-800 border-gray-700 hover:border-gray-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 text-xs rounded border ${getPhaseColor(tactic.phase)}`}>
                      {tactic.phase.slice(0, 3).toUpperCase()}
                    </span>
                    <span className="text-xs font-medium text-white">{tactic.name}</span>
                  </div>
                  <span className={`text-xs font-medium ${getIntensityColor(tactic.intensity)}`}>
                    {tactic.intensity}/10
                  </span>
                </div>

                {expandedTactic === tactic.id && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-gray-400">{tactic.description}</p>

                    {tactic.synergies && tactic.synergies.length > 0 && (
                      <div>
                        <div className="text-xs text-green-400 mb-1">Synergies:</div>
                        <div className="flex flex-wrap gap-1">
                          {tactic.synergies.map((syn) => (
                            <span
                              key={syn.tactic}
                              className="px-1.5 py-0.5 text-xs bg-green-500/20 text-green-400 rounded"
                            >
                              {syn.tactic.replace(/_/g, ' ')} +{syn.boost}%
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {tactic.counters && tactic.counters.length > 0 && (
                      <div>
                        <div className="text-xs text-red-400 mb-1">Countered by:</div>
                        <div className="flex flex-wrap gap-1">
                          {tactic.counters.map((cnt) => (
                            <span
                              key={cnt.tactic}
                              className="px-1.5 py-0.5 text-xs bg-red-500/20 text-red-400 rounded"
                            >
                              {cnt.tactic.replace(/_/g, ' ')} -{cnt.reduction}%
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {tactic.triggers && tactic.triggers.length > 0 && (
                      <div>
                        <div className="text-xs text-yellow-400 mb-1">Triggers:</div>
                        <div className="flex flex-wrap gap-1">
                          {tactic.triggers.map((trig, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded"
                            >
                              {trig.event.replace(/_/g, ' ')}
                              {trig.windowSeconds && ` (${trig.windowSeconds}s)`}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {filteredTactics.length === 0 && (
              <div className="text-center py-4 text-gray-500 text-xs">
                No tactics found matching "{searchQuery}"
              </div>
            )}
          </div>
        )}

        {/* Formations Tab */}
        {activeTab === 'formations' && (
          <div className="p-2 space-y-2">
            {FORMATIONS.map((formation) => (
              <div
                key={formation.id}
                onClick={() => onFormationSelect?.(formation)}
                className={`p-2 rounded border cursor-pointer transition-all ${
                  selectedFormation === formation.id
                    ? 'bg-blue-600/20 border-blue-500'
                    : 'bg-gray-800 border-gray-700 hover:border-gray-500'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-white">{formation.shape}</span>
                  <span className="text-xs text-gray-500">{formation.name}</span>
                </div>
                <p className="text-xs text-gray-400 mb-2">{formation.description}</p>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <div className="text-xs text-green-400 mb-1">Strengths</div>
                    <div className="flex flex-wrap gap-1">
                      {formation.strengths.map((s) => (
                        <span key={s} className="px-1 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-red-400 mb-1">Weaknesses</div>
                    <div className="flex flex-wrap gap-1">
                      {formation.weaknesses.map((w) => (
                        <span key={w} className="px-1 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TacticsLibrary;
