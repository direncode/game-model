"use client";

// Re-export from the consolidated app store for backward compatibility.
// All components should migrate to importing from @/stores/app directly.
export { useAppStore as useAuthStore } from "@/stores/app";
