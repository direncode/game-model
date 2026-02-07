// Zustand Store — Algorithm & Ingestor Focused State

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Player, GameModel } from '@/types';

// ==================== Store Types ====================

interface AlgorithmState {
  // Active algorithm modules
  activeModules: Set<string>;
  toggleModule: (moduleId: string) => void;

  // Ingestor status
  ingestorStatus: Map<string, IngestorStatus>;
  updateIngestorStatus: (id: string, status: IngestorStatus) => void;
}

interface DataState {
  // Player data from ingestors
  players: Player[];
  setPlayers: (players: Player[]) => void;

  // Game models
  gameModels: GameModel[];
  activeGameModel: GameModel | null;
  setActiveGameModel: (id: string | null) => void;
}

interface UIState {
  selectedTab: 'algorithms' | 'ingestors' | 'pipeline';
  setSelectedTab: (tab: UIState['selectedTab']) => void;
  selectedModule: string | null;
  setSelectedModule: (id: string | null) => void;
}

export interface IngestorStatus {
  id: string;
  name: string;
  type: 'api' | 'gps' | 'wearable' | 'tracking';
  connected: boolean;
  lastSync: Date | null;
  recordsIngested: number;
  errorCount: number;
  throughput: number; // records/sec
}

type GameStore = AlgorithmState & DataState & UIState;

export const useGameStore = create<GameStore>()(
  devtools(
    (set, get) => ({
      // ==================== Algorithm State ====================
      activeModules: new Set([
        'tactical-ai',
        'pattern-recognition',
        'multi-agent',
        'analytics-engine',
        'coherence-analysis',
        'digital-twin',
      ]),

      toggleModule: (moduleId) =>
        set((state) => {
          const next = new Set(state.activeModules);
          if (next.has(moduleId)) next.delete(moduleId);
          else next.add(moduleId);
          return { activeModules: next };
        }),

      // ==================== Ingestor Status ====================
      ingestorStatus: new Map(),

      updateIngestorStatus: (id, status) =>
        set((state) => {
          const next = new Map(state.ingestorStatus);
          next.set(id, status);
          return { ingestorStatus: next };
        }),

      // ==================== Data ====================
      players: [],
      setPlayers: (players) => set({ players }),

      gameModels: [],
      activeGameModel: null,

      setActiveGameModel: (id) =>
        set((state) => ({
          activeGameModel: id
            ? state.gameModels.find((m) => m.id === id) || null
            : null,
        })),

      // ==================== UI ====================
      selectedTab: 'pipeline',
      setSelectedTab: (tab) => set({ selectedTab: tab }),
      selectedModule: null,
      setSelectedModule: (id) => set({ selectedModule: id }),
    }),
    { name: 'GameStore' }
  )
);
