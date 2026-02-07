'use client';

import { ArrowRight, Shield, CheckCircle2 } from 'lucide-react';

const BENEFITS = [
  'Works with your existing Catapult, STATSports, or GPS hardware',
  'No data science team required — insights in minutes, not months',
  'Premier League to grassroots — scales to any level',
  'Full API access — integrate with your existing match analysis workflow',
];

export function CTASection() {
  return (
    <section id="contact" className="section-full relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(45,114,210,0.06)_0%,transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />

      <div className="section-container relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#2F343C] bg-[#252A31] mb-8">
            <Shield className="w-4 h-4 text-[#2D72D2]" />
            <span className="text-xs text-[#8F99A8] font-medium">
              Trusted by professional clubs
            </span>
          </div>

          <h2 className="text-heading-1 text-[#F6F7F9] mb-5">
            Ready to see what your data is{' '}
            <span className="bg-gradient-to-r from-[#4C90F0] to-[#238551] bg-clip-text text-transparent">
              really telling you?
            </span>
          </h2>

          <p className="text-body-large max-w-xl mx-auto mb-8">
            Get a live walkthrough of the BigDunc platform with your own team data.
            No commitment. No sales pitch. Just algorithms.
          </p>

          {/* Benefits */}
          <div className="grid sm:grid-cols-2 gap-3 max-w-xl mx-auto mb-10 text-left">
            {BENEFITS.map((b) => (
              <div key={b} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#238551] mt-0.5 flex-shrink-0" />
                <span className="text-sm text-[#ABB3BF]">{b}</span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex items-center justify-center gap-4">
            <a href="#" className="btn-primary text-base px-8 py-3">
              Request a Demo
              <ArrowRight className="w-4 h-4" />
            </a>
            <a href="#algorithms" className="btn-ghost text-base px-8 py-3">
              Explore Algorithms
            </a>
          </div>

          {/* Trust line */}
          <p className="text-xs text-[#5F6B7C] mt-8">
            Built on Palantir Blueprint design principles. Powered by Next.js, TypeScript, and Zustand.
          </p>
        </div>
      </div>
    </section>
  );
}
