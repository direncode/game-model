// D-U-N-C vertical layout — dark enterprise shell.
//
// Intentionally minimal: the header is a single line with the D-U-N-C mark
// and the role switcher. Everything else is left to child pages so the
// /dunc/embed/[id] route can skip the header entirely without layout hacks.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "D-U-N-C — Tactical Football Intelligence",
  description:
    "Live digital twins, tactical insight, and AI-assisted match intelligence, powered by Latent Ocean.",
};

export default function DuncLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-li-black text-li-white flex flex-col">
      {children}
    </div>
  );
}
