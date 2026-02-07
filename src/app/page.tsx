import { NavBar } from '@/components/sections/nav-bar';
import { HeroSection } from '@/components/sections/hero-section';
import { PlatformSection } from '@/components/sections/platform-section';
import { MetricsSection } from '@/components/sections/metrics-section';
import { AlgorithmSection } from '@/components/sections/algorithm-section';
import { IngestorSection } from '@/components/sections/ingestor-section';
import { ArchitectureSection } from '@/components/sections/architecture-section';
import { CTASection } from '@/components/sections/cta-section';

export default function Home() {
  return (
    <>
      <NavBar />
      <main>
        <HeroSection />
        <PlatformSection />
        <MetricsSection />
        <AlgorithmSection />
        <IngestorSection />
        <ArchitectureSection />
        <CTASection />
      </main>
      <footer className="border-t border-[#2F343C] py-8">
        <div className="section-container flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[#2D72D2]/20 flex items-center justify-center">
              <span className="text-[10px] font-bold text-[#2D72D2]">BD</span>
            </div>
            <span className="text-xs text-[#5F6B7C]">
              BigDunc Engine — Algorithmic Football Intelligence
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#platform" className="text-xs text-[#5F6B7C] hover:text-[#8F99A8] transition-colors">Platform</a>
            <a href="#algorithms" className="text-xs text-[#5F6B7C] hover:text-[#8F99A8] transition-colors">Algorithms</a>
            <a href="#ingestors" className="text-xs text-[#5F6B7C] hover:text-[#8F99A8] transition-colors">Ingestors</a>
            <a href="#architecture" className="text-xs text-[#5F6B7C] hover:text-[#8F99A8] transition-colors">Architecture</a>
          </div>
        </div>
      </footer>
    </>
  );
}
