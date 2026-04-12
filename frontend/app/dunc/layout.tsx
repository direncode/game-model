"use client";

// D-U-N-C vertical layout — dark enterprise shell.
// Hydrates the role from localStorage on mount to avoid SSR mismatch.

import { useEffect } from "react";
import { useDuncStore } from "@/lib/dunc/store";
import type { DuncRole } from "@/lib/dunc/types";

export default function DuncLayout({ children }: { children: React.ReactNode }) {
  const setRole = useDuncStore((s) => s.setRole);

  useEffect(() => {
    const stored = window.localStorage.getItem("dunc.role");
    if (stored === "technical_staff") {
      setRole("technical_staff");
    }
  }, [setRole]);

  return (
    <div className="min-h-screen bg-li-black text-li-white flex flex-col">
      {children}
    </div>
  );
}
