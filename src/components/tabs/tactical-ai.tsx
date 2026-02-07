'use client';

import { useState, useCallback } from 'react';
import { ManagerConsole } from '@/components/dashboard/manager-console';
import { TacticControls } from '@/components/dashboard/tactic-controls';
import { TacticsLibrary } from '@/components/dashboard/tactics-library';
import type { GameModelManager, ManagerSession, StaffMember } from '@/lib/game-model-manager';
import type { TacticalPreset } from '@/lib/tactics-library';

interface TacticalAIProps {
  manager: GameModelManager | null;
  session: ManagerSession | null;
  onSessionStart: (manager: StaffMember, staff: StaffMember[]) => void;
  currentMinute: number;
  isLive: boolean;
  selectedPreset: TacticalPreset | null;
  onPresetSelect: (preset: TacticalPreset) => void;
}

export function TacticalAI({
  manager,
  session,
  onSessionStart,
  currentMinute,
  isLive,
  selectedPreset,
  onPresetSelect,
}: TacticalAIProps) {
  const [intensityProfile, setIntensityProfile] = useState({
    pressing: selectedPreset?.intensityProfile.pressing ?? 60,
    possession: selectedPreset?.intensityProfile.possession ?? 55,
    directness: selectedPreset?.intensityProfile.directness ?? 50,
    tempo: selectedPreset?.intensityProfile.tempo ?? 60,
  });

  const handlePresetSelect = useCallback(
    (preset: TacticalPreset) => {
      setIntensityProfile(preset.intensityProfile);
      onPresetSelect(preset);
    },
    [onPresetSelect]
  );

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left: Manager Console */}
      <div className="flex-1 flex flex-col border-r border-[#2F343C]">
        {manager ? (
          <ManagerConsole
            manager={manager}
            session={session}
            onSessionStart={onSessionStart}
            currentMinute={currentMinute}
            isLive={isLive}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#5F6B7C] text-sm">
            Start the match to enable Manager AI
          </div>
        )}
      </div>

      {/* Right: Controls + Library */}
      <div className="w-80 flex flex-col overflow-hidden">
        {/* Tactic Controls */}
        <div className="flex-shrink-0 p-3 border-b border-[#2F343C]">
          <TacticControls
            preset={selectedPreset}
            intensityProfile={intensityProfile}
            onIntensityChange={setIntensityProfile}
          />
        </div>

        {/* Tactics Library */}
        <div className="flex-1 overflow-y-auto p-3">
          <TacticsLibrary
            onPresetSelect={handlePresetSelect}
            selectedPreset={selectedPreset?.id}
          />
        </div>
      </div>
    </div>
  );
}
