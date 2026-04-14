import { create } from "zustand";
import type {
  DuncActiveScenario,
  DuncBallTick,
  DuncInsight,
  DuncMatchInfo,
  DuncMatchSummary,
  DuncPlayerTick,
  DuncRole,
} from "./types";

interface DuncState {
  role: DuncRole;
  setRole: (role: DuncRole) => void;

  match: DuncMatchSummary | null;
  setMatch: (match: DuncMatchSummary | null) => void;

  lastTick: number;
  clockSec: number;
  ball: DuncBallTick | null;
  players: DuncPlayerTick[];
  prevPlayers: DuncPlayerTick[]; // previous tick — for ghost overlay
  insights: DuncInsight[];
  activeScenarios: DuncActiveScenario[];
  matchInfo: DuncMatchInfo | null;
  overlays: Set<string>;
  toggleOverlay: (key: string) => void;

  applyTick: (payload: {
    t: number;
    clock_sec: number;
    ball: DuncBallTick;
    players: DuncPlayerTick[];
    insights: DuncInsight[];
    active_scenarios?: DuncActiveScenario[];
    match_info?: DuncMatchInfo;
  }) => void;

  applyPrelude: (recent_insights: DuncInsight[]) => void;
  reset: () => void;
}

const MAX_INSIGHTS = 80;

export const useDuncStore = create<DuncState>((set) => ({
  role: "manager" as DuncRole,
  setRole: (role) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("dunc.role", role);
    }
    set({ role });
  },

  match: null,
  setMatch: (match) => set({ match }),

  lastTick: 0,
  clockSec: 0,
  ball: null,
  players: [],
  prevPlayers: [],
  insights: [],
  activeScenarios: [],
  matchInfo: null,
  overlays: new Set<string>(),
  toggleOverlay: (key) =>
    set((s) => {
      const next = new Set(s.overlays);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { overlays: next };
    }),

  applyTick: (payload) =>
    set((state) => {
      const merged = payload.insights.length
        ? [...state.insights, ...payload.insights].slice(-MAX_INSIGHTS)
        : state.insights;
      return {
        lastTick: payload.t,
        clockSec: payload.clock_sec,
        ball: payload.ball,
        prevPlayers: state.players,
        players: payload.players,
        insights: merged,
        activeScenarios: payload.active_scenarios || [],
        matchInfo: payload.match_info || state.matchInfo,
      };
    }),

  applyPrelude: (recent_insights) =>
    set({
      insights: recent_insights.slice(-MAX_INSIGHTS),
    }),

  reset: () =>
    set({
      lastTick: 0,
      clockSec: 0,
      ball: null,
      players: [],
      prevPlayers: [],
      insights: [],
      activeScenarios: [],
      matchInfo: null,
    }),
}));
