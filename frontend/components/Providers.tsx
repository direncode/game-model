"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { getQueryClient } from "@/lib/query";
import { useEffect } from "react";
import { useAppStore } from "@/stores/app";

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const hydrate = useAppStore((s) => s.hydrate);

  // Hydrate auth state on mount (restore token if one exists in localStorage)
  useEffect(() => {
    hydrate();
  }, [hydrate]);

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
            background: "#0f0f0f",
            color: "#ffffff",
            border: "1px solid #222222",
          },
        }}
      />
    </QueryClientProvider>
  );
}
