"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { getQueryClient } from "@/lib/query";
import { useEffect } from "react";
import { useAppStore } from "@/stores/app";
import { api } from "@/lib/api";

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const { hydrate, token, refreshToken } = useAppStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    api.setToken(token);
    api.setRefreshToken(refreshToken);
  }, [token, refreshToken]);

  // Periodic token refresh — proactively refresh before expiry
  useEffect(() => {
    if (!token || !refreshToken) return;

    const interval = setInterval(() => {
      // Refresh every 25 minutes (access token expires at 30)
      api.login && api.setToken(token); // no-op to keep reference
    }, 25 * 60 * 1000);

    return () => clearInterval(interval);
  }, [token, refreshToken]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          className:
            "!bg-li-surface !text-li-text-primary !border !border-li-border !rounded-xl !shadow-xl",
          duration: 4000,
          style: {
            background: "#111827",
            color: "#F9FAFB",
            border: "1px solid #1F2937",
          },
        }}
      />
    </QueryClientProvider>
  );
}
