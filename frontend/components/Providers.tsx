"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { getQueryClient } from "@/lib/query";
import { useEffect } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import { useAppStore } from "@/stores/app";
import { api } from "@/lib/api";

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const { user: clerkUser, isLoaded: userLoaded } = useUser();
  const { getToken, isSignedIn } = useAuth();

  // Sync Clerk user to app store
  useEffect(() => {
    if (userLoaded && clerkUser && isSignedIn) {
      useAppStore.getState().setClerkUser({
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress || "",
        name: clerkUser.fullName || clerkUser.firstName || "User",
        imageUrl: clerkUser.imageUrl,
      });
    } else if (userLoaded && !isSignedIn) {
      useAppStore.getState().logout();
    }
  }, [clerkUser, userLoaded, isSignedIn]);

  // Set up API client with Clerk token
  useEffect(() => {
    if (!isSignedIn) {
      api.setToken(null);
      return;
    }

    // Get initial token
    getToken().then((token) => {
      if (token) api.setToken(token);
    });

    // Refresh token periodically (Clerk tokens expire in ~60s)
    const interval = setInterval(async () => {
      const token = await getToken();
      if (token) api.setToken(token);
    }, 50_000); // Refresh every 50 seconds

    return () => clearInterval(interval);
  }, [isSignedIn, getToken]);

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
