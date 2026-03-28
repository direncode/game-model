import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Auth Slice ──────────────────────────────────────────────────────────────
// Auth is now handled by Clerk. This store keeps app-specific user data and UI state.

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
  setClerkUser: (clerkUser: { id: string; email: string; name: string; imageUrl?: string }) => void;
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
        set({
          token,
          refreshToken: refreshToken ?? get().refreshToken,
          isAuthenticated: true,
        });
      },

      // Legacy login — kept for backward compatibility but Clerk handles this now
      login: async (_email: string, _password: string) => {
        // No-op: Clerk handles login via useSignIn hook
        throw new Error("Use Clerk sign-in instead");
      },

      logout: async () => {
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          activeDatasetId: null,
        });
      },

      fetchUser: async () => {
        // No-op: User data comes from Clerk
      },

      hydrate: () => {
        // No-op: Clerk handles session hydration
      },

      // Set user from Clerk session data
      setClerkUser: (clerkUser) => {
        set({
          user: {
            id: clerkUser.id,
            email: clerkUser.email,
            name: clerkUser.name,
            role: "operator", // Default role — backend can override
            avatar_url: clerkUser.imageUrl,
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
        sidebarOpen: state.sidebarOpen,
        activeDatasetId: state.activeDatasetId,
      }),
    }
  )
);

// Re-export for backward compatibility during migration
export const useAuthStore = useAppStore;
