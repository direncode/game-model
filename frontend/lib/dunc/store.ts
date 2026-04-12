// Zustand store for D-U-N-C live match state.
//
// One store holds everything the UI cares about for a live match: the last
// tick, recent insights, and the user's selected role. The WS client hook
// writes into this store — components read selectors.

import { create } from "zustand";
import type {
  DuncBallTick,
  DuncInsight,
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
  insights: DuncInsight[];

  applyTick: (payload: {
    t: number;
    clock_sec: number;
    ball: DuncBallTick;
    players: DuncPlayerTick[];
    insights: DuncInsight[];
  }) => void;

  applyPrelude: (recent_insights: DuncInsight[]) => void;
  reset: () => void;
}

const MAX_INSIGHTS = 80;

// localStorage persistence for role — cheap and works without middleware.
function loadRole(): DuncRole {
  if (typeof window === "undefined") return "manager";
  const v = window.localStorage.getItem("dunc.role");
  return v === "technical_staff" ? "technical_staff" : "manager";
}

export const useDuncStore = create<DuncState>((set) => ({
  role: loadRole(),
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
  insights: [],

  applyTick: (payload) =>
    set((state) => {
      const merged = payload.insights.length
        ? [...state.insights, ...payload.insights].slice(-MAX_INSIGHTS)
        : state.insights;
      return {
        lastTick: payload.t,
        clockSec: payload.clock_sec,
        ball: payload.ball,
        players: payload.players,
        insights: merged,
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
      insights: [],
    }),
}));
