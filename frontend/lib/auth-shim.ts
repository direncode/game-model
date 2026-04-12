// Thin auth hook for components that need token/auth status.
// Used by Engine and Franklin components. No Clerk dependency.

import { useAppStore } from "@/stores/app";

export function useAuth() {
  const { token, user } = useAppStore();
  return {
    isSignedIn: true,
    isLoaded: true,
    getToken: async () => token,
    userId: user?.id ?? null,
  };
}
