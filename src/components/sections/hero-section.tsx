export function HeroSection() {
  return (
    <section className="min-h-[90vh] flex items-end pb-24 pt-32">
      <div className="max-w-[1200px] mx-auto px-8 w-full">
        <p className="text-[13px] text-[#5F6B7C] tracking-[0.15em] uppercase mb-6">
          Algorithmic Football Intelligence
        </p>

        <h1
          className="text-[#F6F7F9] font-semibold leading-[1.04] tracking-tight max-w-[900px]"
          style={{ fontSize: 'clamp(2.5rem, 5.5vw, 4.8rem)', letterSpacing: '-0.03em' }}
        >
          The operating system for tactical analysis
        </h1>

        <p className="text-[#8F99A8] text-lg leading-relaxed max-w-[640px] mt-8">
          BigDunc transforms raw GPS, wearable, and performance data into tactical
          intelligence. Six algorithm modules and four seamless ingestors, unified in
          a single platform built for professional football.
        </p>

        <div className="flex items-center gap-6 mt-12">
          <a
            href="#platform"
            className="text-[13px] text-[#F6F7F9] border border-[#2F343C] px-6 py-2.5 hover:border-[#5F6B7C] transition-colors"
          >
            Explore the platform
          </a>
          <a
            href="#algorithms"
            className="text-[13px] text-[#5F6B7C] hover:text-[#8F99A8] transition-colors"
          >
            View algorithms
          </a>
        </div>
      </div>
    </section>
  );
}
