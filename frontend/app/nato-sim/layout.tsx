import type { Metadata } from "next";
import { ClassificationBanner } from "./_components/ClassificationBanner";
import { TrafficColumn } from "./_components/TrafficColumn";
import { LiveQueryDock } from "./_components/LiveQueryDock";
import { PinnedRail } from "./_components/PinnedRail";
import { ApprovalsTray } from "./_components/ApprovalsTray";

export const metadata: Metadata = {
  title: "NATO Simulation — INR Station | Latent Ocean",
  description:
    "All-source warning intelligence workstation for the AWIS simulation (24–25 April 2026).",
};

/**
 * /nato-sim layout — wraps every page in this vertical with:
 *   - classification banners (top + bottom)
 *   - live Traffic column (left edge)
 *   - main canvas (children + Live Query dock + Approvals tray docked below)
 *   - Pinned rail (right edge)
 *
 * The LO sidebar/navbar come from the parent ``app/layout.tsx``.
 */
export default function NatoSimLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-li-bg text-li-text-primary">
      <ClassificationBanner position="top" />

      <div className="flex flex-1 min-h-0">
        <TrafficColumn />

        <div className="flex-1 min-w-0 flex flex-col">
          {children}
          <ApprovalsTray />
          <LiveQueryDock />
        </div>

        <PinnedRail />
      </div>

      <ClassificationBanner position="bottom" />
    </div>
  );
}
