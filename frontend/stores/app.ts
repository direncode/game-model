import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";
import { ws } from "@/lib/websocket";

// ─── Auth Slice ──────────────────────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthActions {
  setToken: (token: string, refreshToken?: string) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  hydrate: () => void;
}

// ─── UI Slice ────────────────────────────────────────────────────────────────

interface UIState {
  sidebarOpen: boolean;
  commandPaletteOpen: boolean;
  activeDatasetId: string | null;
  activeView: string;
}

interface UIActions {
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setActiveDatasetId: (id: string | null) => void;
  setActiveView: (view: string) => void;
}

// ─── Combined Store ──────────────────────────────────────────────────────────

type AppStore = AuthState & AuthActions & UIState & UIActions;

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // ── Auth State ───────────────────────────────────────────────────────
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      setToken: (token: string, refreshToken?: string) => {
        api.setToken(token);
        ws.connect(token);
        set({
          token,
          refreshToken: refreshToken ?? get().refreshToken,
          isAuthenticated: true,
        });
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const res = await api.login({ email, password });
          api.setToken(res.access_token);
          ws.connect(res.access_token);
          const user = (await api.getMe()) as User;
          set({
            token: res.access_token,
            refreshToken: res.refresh_token,
            user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        api.setToken(null);
        ws.disconnect();
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          activeDatasetId: null,
        });
      },

      fetchUser: async () => {
        try {
          const user = (await api.getMe()) as User;
          set({ user, isAuthenticated: true });
        } catch {
          set({ user: null, isAuthenticated: false, token: null });
        }
      },

      hydrate: () => {
        const { token } = get();
        if (token) {
          api.setToken(token);
          ws.connect(token);
          get().fetchUser();
        }
      },

      // ── UI State ─────────────────────────────────────────────────────────
      sidebarOpen: true,
      commandPaletteOpen: false,
      activeDatasetId: null,
      activeView: "dashboard",

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
      toggleCommandPalette: () =>
        set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
      setCommandPaletteOpen: (open: boolean) =>
        set({ commandPaletteOpen: open }),
      setActiveDatasetId: (id: string | null) =>
        set({ activeDatasetId: id }),
      setActiveView: (view: string) => set({ activeView: view }),
    }),
    {
      name: "li-app-store",
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        sidebarOpen: state.sidebarOpen,
        activeDatasetId: state.activeDatasetId,
      }),
    }
  )
);
