import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { ReductionCinematic } from "@/components/landing/ReductionCinematic";
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

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main>
        <Hero />
        <PrimitiveInStack />
        <UniversalProof />
        <ReductionCinematic />
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
