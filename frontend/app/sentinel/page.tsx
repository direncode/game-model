import type { Metadata } from "next";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { SentinelHero } from "@/components/landing/sentinel/SentinelHero";
import { SentinelBreak } from "@/components/landing/sentinel/SentinelBreak";
import { SentinelStack } from "@/components/landing/sentinel/SentinelStack";
import { SentinelArchitecture } from "@/components/landing/sentinel/SentinelArchitecture";
import { SentinelMeridian } from "@/components/landing/sentinel/SentinelMeridian";
import { SentinelReplay } from "@/components/landing/sentinel/SentinelReplay";
import { SentinelTaxonomy } from "@/components/landing/sentinel/SentinelTaxonomy";
import { SentinelPilot } from "@/components/landing/sentinel/SentinelPilot";
import { SentinelReproduce } from "@/components/landing/sentinel/SentinelReproduce";
import { SentinelCTA } from "@/components/landing/sentinel/SentinelCTA";

export const metadata: Metadata = {
  title: "Latent Sentinel · Threat intelligence on the Latent Ocean primitive",
  description:
    "Hallucination-resistant, fully auditable, structurally-grounded threat intelligence. Bit-identical replay. Air-gap native. Built on the same deterministic primitive that powers Latent Ocean.",
};

export default function SentinelPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main>
        <SentinelHero />
        <SentinelBreak />
        <SentinelStack />
        <SentinelArchitecture />
        <SentinelMeridian />
        <SentinelReplay />
        <SentinelTaxonomy />
        <SentinelPilot />
        <SentinelReproduce />
        <SentinelCTA />
      </main>
      <Footer />
    </div>
  );
}
