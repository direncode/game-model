"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { getQueryClient } from "@/lib/query";
import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const { hydrate, token } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    api.setToken(token);
  }, [token]);

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
