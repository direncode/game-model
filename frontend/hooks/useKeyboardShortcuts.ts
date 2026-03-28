"use client";

import { useEffect } from "react";
import { useAppStore } from "@/stores/app";

export function useKeyboardShortcuts() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl+K: toggle command palette
      if (mod && e.key === "k") {
        e.preventDefault();
        useAppStore.getState().toggleCommandPalette();
        return;
      }

      // Cmd/Ctrl+/: toggle sidebar
      if (mod && e.key === "/") {
        e.preventDefault();
        useAppStore.getState().toggleSidebar();
        return;
      }

      // Escape: close any open modal/palette
      if (e.key === "Escape") {
        const state = useAppStore.getState();
        if (state.commandPaletteOpen) {
          e.preventDefault();
          state.setCommandPaletteOpen(false);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
