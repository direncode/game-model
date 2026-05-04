import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { OceanWorkbench } from "./OceanWorkbench";

export const metadata: Metadata = {
  title: "Console · OCEAN Workbench · Latent Ocean",
  description:
    "The OCEAN workbench. Write a substrate-clustering pipeline, run it, see the same program rendered as MCP / Postgres / HTTP invocations. One language, three protocols, identical semantics.",
};

export default function ConsolePage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-32">
        {/* Hero */}
        <section className="px-6 pb-12 border-b border-white/5">
          <div className="max-w-[1480px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-6">
              CONSOLE · OCEAN WORKBENCH
            </p>
            <h1 className="text-[clamp(2.4rem,5vw,4.2rem)] font-bold tracking-[-0.025em] leading-[1.05] mb-8 max-w-[20ch]">
              Write a pipeline. Run it. Pick which protocol it ships through.
            </h1>
            <p className="text-[16.5px] leading-[1.65] text-white/65 max-w-[60ch]">
              The same OCEAN program is reachable through three protocols. Below: an editor for the program, a runner that executes it deterministically, and side-by-side rendering of the same program as it would be invoked through the MCP server, the Postgres extension, and the HTTP API.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/language" className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/85 hover:text-white border border-white/30 hover:border-white px-4 py-2 rounded-full">
                Language Spec →
              </Link>
              <Link href="/protocols" className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/85 hover:text-white border border-white/30 hover:border-white px-4 py-2 rounded-full">
                Protocols →
              </Link>
              <Link href="/console/legacy" className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 hover:text-white border border-white/15 hover:border-white/30 px-4 py-2 rounded-full">
                Legacy formation runner
              </Link>
            </div>
          </div>
        </section>

        {/* The workbench itself */}
        <OceanWorkbench />

        {/* Footer link strip */}
        <section className="px-6 py-16 border-t border-white/5">
          <div className="max-w-[1480px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
              WHERE TO GO NEXT
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/protocols" className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/85 hover:text-white border border-white/30 hover:border-white px-4 py-2 rounded-full">
                Layer 1 — Protocols
              </Link>
              <Link href="/build" className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/85 hover:text-white border border-white/30 hover:border-white px-4 py-2 rounded-full">
                Layer 2 — Build
              </Link>
              <Link href="/silicon" className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/85 hover:text-white border border-white/30 hover:border-white px-4 py-2 rounded-full">
                Layer 3 — Silicon
              </Link>
              <Link href="/gallery" className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/85 hover:text-white border border-white/30 hover:border-white px-4 py-2 rounded-full">
                Gallery
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
