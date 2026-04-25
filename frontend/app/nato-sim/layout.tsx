import type { Metadata } from "next";
import { ClassificationBanner } from "./_components/ClassificationBanner";
import { TrafficColumn } from "./_components/TrafficColumn";
import { LiveQueryDock } from "./_components/LiveQueryDock";
import { ApprovalsTray } from "./_components/ApprovalsTray";
import { ProductNav } from "./_components/ProductNav";

export const metadata: Metadata = {
  title: "INR / NATO Sim · State Department",
  description:
    "All-source warning intelligence workstation, AWIS 24-25 April 2026.",
};

/**
 * /nato-sim layout — JWICS-terminal flavor.
 *
 *   ┌─ classification ────────────────────────────────────────┐
 *   │ Traffic │ Active product canvas                         │
 *   │  (live) │ + Live Query dock                             │
 *   │         │ + Approvals tray (only when items pending)    │
 *   │         │ + Product nav strip                           │
 *   └─ classification ────────────────────────────────────────┘
 *
 * No PinnedRail in the chrome — pinned items live inside the active
 * product when relevant. No big seal. The page is information-dense
 * by design.
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
          <div className="flex-1 overflow-auto">{children}</div>
          <ApprovalsTray />
          <ProductNav />
          <LiveQueryDock />
        </div>
      </div>
      <ClassificationBanner position="bottom" />
    </div>
  );
}
