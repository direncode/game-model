import type { Metadata } from "next";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { LiveDemo } from "@/components/landing/LiveDemo";
import { Architecture } from "@/components/landing/Architecture";
import { UniversalConnect } from "@/components/landing/UniversalConnect";
import { UniversalProof } from "@/components/landing/UniversalProof";
import { PrimitiveInStack } from "@/components/landing/PrimitiveInStack";
import { Materialized } from "@/components/landing/Materialized";
import { Verticals } from "@/components/landing/Verticals";
import { Enterprise } from "@/components/landing/Enterprise";
import { Pricing } from "@/components/landing/Pricing";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "About · Latent Ocean",
  description: "The deterministic primitive underneath. How Latent Ocean turns any row of any database into a 48-bit structural fingerprint, and the engine that runs across every vertical.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main>
        <Hero />
        <PrimitiveInStack />
        <UniversalProof />
        <LiveDemo />
        <Architecture />
        <UniversalConnect />
        <Materialized />
        <Verticals />
        <Enterprise />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
