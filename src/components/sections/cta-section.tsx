export function CTASection() {
  return (
    <section id="contact" className="py-32 border-t border-[#2F343C]/40 bg-[#1C2127]">
      <div className="max-w-[1200px] mx-auto px-8">
        <div className="max-w-[640px]">
          <p className="text-[13px] text-[#5F6B7C] tracking-[0.15em] uppercase mb-6">
            Get Started
          </p>

          <h2
            className="text-[#F6F7F9] font-semibold leading-[1.08] tracking-tight"
            style={{ fontSize: 'clamp(2rem, 3.5vw, 3rem)', letterSpacing: '-0.025em' }}
          >
            See what your data is telling you
          </h2>

          <p className="text-[#8F99A8] text-base leading-relaxed mt-6">
            Get a live walkthrough of the BigDunc platform using your own team data.
            No commitment. No sales pitch. Just algorithms.
          </p>

          <div className="mt-10 space-y-3">
            <p className="text-[#8F99A8] text-sm leading-relaxed">
              Works with your existing Catapult, STATSports, or GPS hardware.
            </p>
            <p className="text-[#8F99A8] text-sm leading-relaxed">
              No data science team required — insights in minutes, not months.
            </p>
            <p className="text-[#8F99A8] text-sm leading-relaxed">
              Premier League to grassroots. Scales to any level.
            </p>
            <p className="text-[#8F99A8] text-sm leading-relaxed">
              Full API access for integration with your existing match analysis workflow.
            </p>
          </div>

          <div className="flex items-center gap-6 mt-12">
            <a
              href="#"
              className="text-[13px] text-[#F6F7F9] border border-[#2F343C] px-6 py-2.5 hover:border-[#5F6B7C] transition-colors"
            >
              Request a demo
            </a>
            <a
              href="#algorithms"
              className="text-[13px] text-[#5F6B7C] hover:text-[#8F99A8] transition-colors"
            >
              Explore algorithms
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
