import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";

// ─── Auth Slice ──────────────────────────────────────────────────────────────
// Auth state + app-specific user data and UI state.

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
  hydrated: boolean;
}

interface AuthActions {
  setToken: (token: string, refreshToken?: string) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  hydrate: () => Promise<void>;
  setUser: (userData: { id: string; email: string; name: string; imageUrl?: string }) => void;
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
      hydrated: false,

      setToken: (token: string, refreshToken?: string) => {
        api.setToken(token);
        if (refreshToken) api.setRefreshToken(refreshToken);
        set({
          token,
          refreshToken: refreshToken ?? get().refreshToken,
          isAuthenticated: true,
        });
      },

      login: async (email: string, password: string) => {
        const data = await api.login({ email, password });
        api.setToken(data.access_token);
        api.setRefreshToken(data.refresh_token);
        set({
          token: data.access_token,
          refreshToken: data.refresh_token,
          isAuthenticated: true,
        });
        // Fetch user profile
        try {
          const user = await api.getMe() as User;
          set({ user });
        } catch {
          // Token works but profile fetch failed — still authenticated
        }
      },

      logout: async () => {
        const { refreshToken } = get();
        if (refreshToken) {
          await api.logout(refreshToken);
        }
        api.setToken(null);
        api.setRefreshToken(null);
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
          const user = await api.getMe() as User;
          set({ user });
        } catch {
          await get().logout();
        }
      },

      hydrate: async () => {
        const { token, refreshToken } = get();
        if (token) {
          api.setToken(token);
          if (refreshToken) api.setRefreshToken(refreshToken);
        }
        // Auth validation deferred — backend may not be running.
        // When a backend is available, fetchUser() can be called to validate.
        set({ hydrated: true });
      },

      setUser: (userData) => {
        set({
          user: {
            id: userData.id,
            email: userData.email,
            name: userData.name,
            role: "operator",
            avatar_url: userData.imageUrl,
            email_verified: true,
          },
          isAuthenticated: true,
        });
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

// Listen for token refresh events from the API client
if (typeof window !== "undefined") {
  window.addEventListener("token-refreshed", ((e: CustomEvent) => {
    const { access_token, refresh_token } = e.detail;
    useAppStore.setState({ token: access_token, refreshToken: refresh_token });
  }) as EventListener);

  api.setOnLogout(() => {
    useAppStore.getState().logout();
  });
}

// Re-export for backward compatibility during migration
export const useAuthStore = useAppStore;
