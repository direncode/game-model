// Zustand Store for Football Analytics System State Management

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import {
  Player,
  GameModel,
  GameApproach,
  DigitalTwin,
  WearableData,
  TrackingMetrics,
  LiveMatchData,
  CoherenceReport,
  ManagerInput,
  VerificationRequest,
  TrainingSession,
  TacticalDeviation,
  PlayerAlert,
} from '@/types';

// ==================== Store Types ====================

interface PlayersState {
  players: Player[];
  addPlayer: (player: Player) => void;
  updatePlayer: (id: string, updates: Partial<Player>) => void;
  removePlayer: (id: string) => void;
  setPlayers: (players: Player[]) => void;
}

interface GameModelState {
  gameModels: GameModel[];
  activeGameModel: GameModel | null;
  createGameModel: (model: GameModel) => void;
  updateGameModel: (id: string, updates: Partial<GameModel>) => void;
  deleteGameModel: (id: string) => void;
  setActiveGameModel: (id: string | null) => void;
}

interface GameApproachState {
  gameApproaches: GameApproach[];
  activeApproach: GameApproach | null;
  createApproach: (approach: GameApproach) => void;
  updateApproach: (id: string, updates: Partial<GameApproach>) => void;
  setActiveApproach: (id: string | null) => void;
}

interface DigitalTwinsState {
  twins: Map<string, DigitalTwin>;
  setTwin: (playerId: string, twin: DigitalTwin) => void;
  updateTwinState: (playerId: string, state: Partial<DigitalTwin['currentState']>) => void;
  getTwin: (playerId: string) => DigitalTwin | undefined;
}

interface WearableDataState {
  liveData: Map<string, TrackingMetrics>;
  sessionData: Map<string, WearableData[]>;
  updateLiveData: (playerId: string, metrics: TrackingMetrics) => void;
  addSessionData: (playerId: string, data: WearableData) => void;
  clearLiveData: () => void;
}

interface LiveMatchState {
  matchData: LiveMatchData | null;
  isLive: boolean;
  coherenceReport: CoherenceReport | null;
  alerts: PlayerAlert[];
  deviations: TacticalDeviation[];
  startMatch: (data: Partial<LiveMatchData>) => void;
  updateMatch: (updates: Partial<LiveMatchData>) => void;
  endMatch: () => void;
  updateCoherence: (report: CoherenceReport) => void;
  addAlert: (alert: PlayerAlert) => void;
  addDeviation: (deviation: TacticalDeviation) => void;
  clearAlerts: () => void;
}

interface AIInputState {
  pendingInputs: ManagerInput[];
  verificationRequests: VerificationRequest[];
  processedInputs: ManagerInput[];
  addInput: (input: ManagerInput) => void;
  addVerificationRequest: (request: VerificationRequest) => void;
  completeVerification: (requestId: string, status: VerificationRequest['status']) => void;
  clearPendingInputs: () => void;
}

interface UIState {
  selectedPlayerId: string | null;
  selectedTab: 'dashboard' | 'game-model' | 'players' | 'live' | 'ai-input';
  sidebarOpen: boolean;
  viewMode: 'overview' | 'detailed' | 'analysis';
  setSelectedPlayer: (id: string | null) => void;
  setSelectedTab: (tab: UIState['selectedTab']) => void;
  toggleSidebar: () => void;
  setViewMode: (mode: UIState['viewMode']) => void;
}

// ==================== Combined Store ====================

type GameStore = PlayersState &
  GameModelState &
  GameApproachState &
  DigitalTwinsState &
  WearableDataState &
  LiveMatchState &
  AIInputState &
  UIState;

// Helper to convert Map to/from serializable format
const mapToObject = <K extends string, V>(map: Map<K, V>): Record<K, V> => {
  const obj = {} as Record<K, V>;
  map.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
};

const objectToMap = <K extends string, V>(obj: Record<K, V>): Map<K, V> => {
  return new Map(Object.entries(obj)) as Map<K, V>;
};

export const useGameStore = create<GameStore>()(
  devtools(
    persist(
      (set, get) => ({
        // ==================== Players ====================
        players: [],

        addPlayer: (player) =>
          set((state) => ({
            players: [...state.players, player],
          })),

        updatePlayer: (id, updates) =>
          set((state) => ({
            players: state.players.map((p) =>
              p.id === id ? { ...p, ...updates } : p
            ),
          })),

        removePlayer: (id) =>
          set((state) => ({
            players: state.players.filter((p) => p.id !== id),
          })),

        setPlayers: (players) => set({ players }),

        // ==================== Game Models ====================
        gameModels: [],
        activeGameModel: null,

        createGameModel: (model) =>
          set((state) => ({
            gameModels: [...state.gameModels, model],
          })),

        updateGameModel: (id, updates) =>
          set((state) => ({
            gameModels: state.gameModels.map((m) =>
              m.id === id ? { ...m, ...updates } : m
            ),
            activeGameModel:
              state.activeGameModel?.id === id
                ? { ...state.activeGameModel, ...updates }
                : state.activeGameModel,
          })),

        deleteGameModel: (id) =>
          set((state) => ({
            gameModels: state.gameModels.filter((m) => m.id !== id),
            activeGameModel:
              state.activeGameModel?.id === id ? null : state.activeGameModel,
          })),

        setActiveGameModel: (id) =>
          set((state) => ({
            activeGameModel: id
              ? state.gameModels.find((m) => m.id === id) || null
              : null,
          })),

        // ==================== Game Approaches ====================
        gameApproaches: [],
        activeApproach: null,

        createApproach: (approach) =>
          set((state) => ({
            gameApproaches: [...state.gameApproaches, approach],
          })),

        updateApproach: (id, updates) =>
          set((state) => ({
            gameApproaches: state.gameApproaches.map((a) =>
              a.id === id ? { ...a, ...updates } : a
            ),
            activeApproach:
              state.activeApproach?.id === id
                ? { ...state.activeApproach, ...updates }
                : state.activeApproach,
          })),

        setActiveApproach: (id) =>
          set((state) => ({
            activeApproach: id
              ? state.gameApproaches.find((a) => a.id === id) || null
              : null,
          })),

        // ==================== Digital Twins ====================
        twins: new Map(),

        setTwin: (playerId, twin) =>
          set((state) => {
            const newTwins = new Map(state.twins);
            newTwins.set(playerId, twin);
            return { twins: newTwins };
          }),

        updateTwinState: (playerId, stateUpdates) =>
          set((state) => {
            const twin = state.twins.get(playerId);
            if (!twin) return state;

            const newTwins = new Map(state.twins);
            newTwins.set(playerId, {
              ...twin,
              currentState: { ...twin.currentState, ...stateUpdates },
              lastUpdated: new Date(),
            });
            return { twins: newTwins };
          }),

        getTwin: (playerId) => get().twins.get(playerId),

        // ==================== Wearable Data ====================
        liveData: new Map(),
        sessionData: new Map(),

        updateLiveData: (playerId, metrics) =>
          set((state) => {
            const newLiveData = new Map(state.liveData);
            newLiveData.set(playerId, metrics);
            return { liveData: newLiveData };
          }),

        addSessionData: (playerId, data) =>
          set((state) => {
            const newSessionData = new Map(state.sessionData);
            const existing = newSessionData.get(playerId) || [];
            newSessionData.set(playerId, [...existing, data]);
            return { sessionData: newSessionData };
          }),

        clearLiveData: () => set({ liveData: new Map() }),

        // ==================== Live Match ====================
        matchData: null,
        isLive: false,
        coherenceReport: null,
        alerts: [],
        deviations: [],

        startMatch: (data) =>
          set({
            isLive: true,
            matchData: {
              matchId: data.matchId || `match-${Date.now()}`,
              gameApproach: data.gameApproach!,
              currentMinute: 0,
              phase: 'first_half',
              score: { home: 0, away: 0 },
              playerData: new Map(),
              teamMetrics: {
                possession: 50,
                passAccuracy: 0,
                pressureSuccess: 0,
                territorialControl: 50,
                compactness: 0,
                formationMaintenance: 100,
              },
              coherenceReport: {
                overallScore: 100,
                byPhase: new Map(),
                byPlayer: new Map(),
                byPrinciple: new Map(),
                criticalDeviations: [],
                recommendations: [],
              },
              events: [],
              ...data,
            } as LiveMatchData,
            alerts: [],
            deviations: [],
          }),

        updateMatch: (updates) =>
          set((state) => ({
            matchData: state.matchData
              ? { ...state.matchData, ...updates }
              : null,
          })),

        endMatch: () =>
          set({
            isLive: false,
            matchData: null,
            coherenceReport: null,
          }),

        updateCoherence: (report) => set({ coherenceReport: report }),

        addAlert: (alert) =>
          set((state) => ({
            alerts: [...state.alerts, alert].slice(-50), // Keep last 50 alerts
          })),

        addDeviation: (deviation) =>
          set((state) => ({
            deviations: [...state.deviations, deviation].slice(-100), // Keep last 100
          })),

        clearAlerts: () => set({ alerts: [] }),

        // ==================== AI Input ====================
        pendingInputs: [],
        verificationRequests: [],
        processedInputs: [],

        addInput: (input) =>
          set((state) => ({
            pendingInputs: [...state.pendingInputs, input],
          })),

        addVerificationRequest: (request) =>
          set((state) => ({
            verificationRequests: [...state.verificationRequests, request],
          })),

        completeVerification: (requestId, status) =>
          set((state) => {
            const request = state.verificationRequests.find(
              (r) => r.id === requestId
            );
            if (!request) return state;

            const updatedRequest = {
              ...request,
              status,
              verifiedAt: new Date(),
            };

            return {
              verificationRequests: state.verificationRequests.filter(
                (r) => r.id !== requestId
              ),
              processedInputs:
                status === 'verified' || status === 'modified'
                  ? [...state.processedInputs, request.originalInput]
                  : state.processedInputs,
            };
          }),

        clearPendingInputs: () => set({ pendingInputs: [] }),

        // ==================== UI State ====================
        selectedPlayerId: null,
        selectedTab: 'dashboard',
        sidebarOpen: true,
        viewMode: 'overview',

        setSelectedPlayer: (id) => set({ selectedPlayerId: id }),
        setSelectedTab: (tab) => set({ selectedTab: tab }),
        toggleSidebar: () =>
          set((state) => ({ sidebarOpen: !state.sidebarOpen })),
        setViewMode: (mode) => set({ viewMode: mode }),
      }),
      {
        name: 'game-model-storage',
        partialize: (state) => ({
          players: state.players,
          gameModels: state.gameModels,
          gameApproaches: state.gameApproaches,
          // Don't persist live data, match state, or Maps
        }),
      }
    ),
    { name: 'GameStore' }
  )
);

// ==================== Selectors ====================

export const selectPlayerById = (id: string) => (state: GameStore) =>
  state.players.find((p) => p.id === id);

export const selectActiveModel = (state: GameStore) => state.activeGameModel;

export const selectActiveApproach = (state: GameStore) => state.activeApproach;

export const selectPlayerCoherence = (playerId: string) => (state: GameStore) =>
  state.coherenceReport?.byPlayer.get(playerId);

export const selectCriticalAlerts = (state: GameStore) =>
  state.alerts.filter((a) => a.severity === 'high');

export const selectPendingVerifications = (state: GameStore) =>
  state.verificationRequests.filter((r) => r.status === 'pending');

// ==================== Actions for Complex Operations ====================

export const initializeMatch = (
  gameModelId: string,
  approachId?: string
) => {
  const state = useGameStore.getState();
  const gameModel = state.gameModels.find((m) => m.id === gameModelId);
  const approach = approachId
    ? state.gameApproaches.find((a) => a.id === approachId)
    : null;

  if (!gameModel) return;

  // Create default approach if none provided
  const matchApproach: GameApproach = approach || {
    id: `approach-${Date.now()}`,
    matchId: `match-${Date.now()}`,
    baseGameModel: gameModel.id,
    opponent: {
      teamName: 'Unknown',
      formation: '4-4-2',
      strengths: [],
      weaknesses: [],
      keyPlayers: [],
      patterns: [],
    },
    adjustments: [],
    playerSpecificInstructions: new Map(),
    priorityFocus: [],
    keyBattles: [],
    createdAt: new Date(),
    validatedBy: [],
  };

  state.startMatch({
    gameApproach: matchApproach,
    matchId: `match-${Date.now()}`,
  });

  state.setActiveGameModel(gameModelId);
  if (approachId) state.setActiveApproach(approachId);
};

export const processLiveUpdate = (
  playerId: string,
  metrics: TrackingMetrics,
  minute: number
) => {
  const state = useGameStore.getState();

  // Update live data
  state.updateLiveData(playerId, metrics);

  // Update digital twin
  const twin = state.twins.get(playerId);
  if (twin) {
    // Simple fatigue calculation
    const fatigue = Math.min(100, (minute / 90) * 60 + Math.random() * 20);
    state.updateTwinState(playerId, {
      fatigue,
      currentWorkRate: metrics.distancePerMinute / 110 * 100,
    });
  }

  // Check for alerts
  if (metrics.currentSpeed > 30) {
    state.addAlert({
      type: 'physical',
      severity: 'low',
      message: `${playerId} reached max sprint speed`,
      timestamp: new Date(),
    });
  }
};
