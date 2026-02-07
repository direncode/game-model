import { NavBar } from '@/components/sections/nav-bar';
import { HeroSection } from '@/components/sections/hero-section';
import { PlatformSection } from '@/components/sections/platform-section';
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
        <AlgorithmSection />
        <IngestorSection />
        <ArchitectureSection />
        <CTASection />
      </main>
      <footer className="border-t border-[#2F343C]/40 py-10">
        <div className="max-w-[1200px] mx-auto px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <span className="text-[13px] text-[#5F6B7C]">
            BigDunc
          </span>
          <div className="flex items-center gap-8">
            <a href="#platform" className="text-[13px] text-[#5F6B7C] hover:text-[#8F99A8] transition-colors">Platform</a>
            <a href="#algorithms" className="text-[13px] text-[#5F6B7C] hover:text-[#8F99A8] transition-colors">Algorithms</a>
            <a href="#ingestors" className="text-[13px] text-[#5F6B7C] hover:text-[#8F99A8] transition-colors">Ingestors</a>
            <a href="#architecture" className="text-[13px] text-[#5F6B7C] hover:text-[#8F99A8] transition-colors">Architecture</a>
          </div>
        </div>
      </footer>
    </>
  );
}
