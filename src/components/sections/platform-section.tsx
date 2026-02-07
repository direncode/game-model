'use client';

import { Database, Brain, BarChart3, ArrowRight, Zap, Shield } from 'lucide-react';

const PIPELINE_STEPS = [
  {
    phase: 'Ingest',
    title: 'Data Ingestors',
    description: 'Real-time streams from GPS, wearables, and performance APIs flow through normalized pipelines.',
    icon: <Database className="w-5 h-5" />,
    color: '#2D72D2',
    items: ['Catapult GPS/IMU (10Hz + 100Hz)', 'Premier League squad data', 'Football Data API (FBref, Understat)', 'Wearable analytics stream'],
  },
  {
    phase: 'Analyze',
    title: 'Algorithm Modules',
    description: 'Six specialized engines process data through pattern recognition, AI, and multi-agent systems.',
    icon: <Brain className="w-5 h-5" />,
    color: '#7961DB',
    items: ['Tactical AI (Q-Learning)', 'Pattern Recognition (Markov chains)', 'Multi-Agent System (Boids + Genetics)', 'Analytics Engine (xG + Passing Networks)'],
  },
  {
    phase: 'Decide',
    title: 'Intelligence Output',
    description: 'Actionable insights, coherence scores, and tactical recommendations delivered in real-time.',
    icon: <BarChart3 className="w-5 h-5" />,
    color: '#238551',
    items: ['Coherence scoring (0-100)', 'Formation recommendations', 'Substitution intelligence', 'Pressing and tempo optimization'],
  },
];

export function PlatformSection() {
  return (
    <section id="platform" className="section-full section-alt">
      <div className="section-container">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="text-overline mb-3 text-[#2D72D2]">Platform</div>
          <h2 className="text-heading-1 text-[#F6F7F9] mb-4">
            Data in. Decisions out.
          </h2>
          <p className="text-body-large">
            A three-stage pipeline that transforms raw sensor data into tactical
            intelligence your coaching staff can act on immediately.
          </p>
        </div>

        {/* Pipeline */}
        <div className="grid md:grid-cols-3 gap-6">
          {PIPELINE_STEPS.map((step, i) => (
            <div key={step.phase} className="relative">
              {/* Connector arrow (between cards on desktop) */}
              {i < PIPELINE_STEPS.length - 1 && (
                <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                  <ArrowRight className="w-6 h-6 text-[#404854]" />
                </div>
              )}

              <div className="card-surface p-6 h-full">
                {/* Phase badge */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: `${step.color}18` }}
                  >
                    <div style={{ color: step.color }}>{step.icon}</div>
                  </div>
                  <div>
                    <div className="text-overline" style={{ color: step.color }}>
                      {step.phase}
                    </div>
                    <h3 className="text-heading-3 text-[#F6F7F9]">{step.title}</h3>
                  </div>
                </div>

                <p className="text-body mb-5">{step.description}</p>

                <div className="space-y-2">
                  {step.items.map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-2 text-sm text-[#ABB3BF]"
                    >
                      <Zap className="w-3 h-3 flex-shrink-0" style={{ color: step.color }} />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Platform banner */}
        <div className="mt-12 rounded-xl border border-[#2F343C] bg-gradient-to-r from-[#252A31] to-[#1C2127] p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Shield className="w-8 h-8 text-[#2D72D2]" />
            <div>
              <h3 className="text-heading-3 text-[#F6F7F9]">
                Built for any club. Any league. Any level.
              </h3>
              <p className="text-body mt-1">
                Plug in your data sources. The platform does the rest.
              </p>
            </div>
          </div>
          <a href="#contact" className="btn-primary flex-shrink-0">
            Get Started
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
