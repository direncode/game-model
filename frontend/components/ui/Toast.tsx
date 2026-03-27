"use client";

import toast, { Toaster, ToastOptions } from "react-hot-toast";

export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: "#111827",
          color: "#F9FAFB",
          border: "1px solid #1F2937",
          borderRadius: "8px",
          fontSize: "14px",
        },
        success: {
          iconTheme: {
            primary: "#10B981",
            secondary: "#111827",
          },
        },
        error: {
          iconTheme: {
            primary: "#EF4444",
            secondary: "#111827",
          },
        },
      }}
    />
  );
}

export { toast };
export type { ToastOptions };
