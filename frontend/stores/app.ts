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
  avatar_url?: string;
  organization_id?: string;
  email_verified?: boolean;
  created_at?: string;
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
  logout: () => Promise<void>;
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
        api.setRefreshToken(refreshToken ?? get().refreshToken);
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
          api.setRefreshToken(res.refresh_token);
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

      logout: async () => {
        const { refreshToken } = get();

        // Server-side logout (best-effort)
        if (refreshToken) {
          try {
            await api.logout(refreshToken);
          } catch {
            // Don't block logout if server call fails
          }
        }

        api.setToken(null);
        api.setRefreshToken(null);
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
          set({ user: null, isAuthenticated: false, token: null, refreshToken: null });
        }
      },

      hydrate: () => {
        const { token, refreshToken } = get();
        if (token) {
          api.setToken(token);
          api.setRefreshToken(refreshToken);

          // Set up logout callback for auto-refresh failures
          api.setOnLogout(() => {
            const store = get();
            api.setToken(null);
            api.setRefreshToken(null);
            ws.disconnect();
            set({
              user: null,
              token: null,
              refreshToken: null,
              isAuthenticated: false,
              activeDatasetId: null,
            });
            if (typeof window !== "undefined") {
              window.location.href = "/login";
            }
          });

          // Listen for token refresh events from the API client
          if (typeof window !== "undefined") {
            window.addEventListener("token-refreshed", ((e: CustomEvent) => {
              set({
                token: e.detail.accessToken,
                refreshToken: e.detail.refreshToken,
              });
              api.setToken(e.detail.accessToken);
              api.setRefreshToken(e.detail.refreshToken);
            }) as EventListener);
          }

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
        user: state.user,
        sidebarOpen: state.sidebarOpen,
        activeDatasetId: state.activeDatasetId,
      }),
    }
  )
);

// Re-export for backward compatibility during migration
export const useAuthStore = useAppStore;
