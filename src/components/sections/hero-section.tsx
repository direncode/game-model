'use client';

import { ArrowRight, Brain, Database, GitCompare, Activity } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 grid-bg opacity-40" />

      {/* Radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-[radial-gradient(ellipse,rgba(45,114,210,0.08)_0%,transparent_65%)] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-[radial-gradient(ellipse,rgba(35,133,81,0.05)_0%,transparent_65%)] pointer-events-none" />

      {/* Floating nodes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[20%] left-[10%] w-12 h-12 rounded-lg border border-[#2F343C] bg-[#252A31]/60 flex items-center justify-center animate-fade-in delay-300">
          <Brain className="w-5 h-5 text-[#E879F9]" />
        </div>
        <div className="absolute top-[30%] right-[12%] w-12 h-12 rounded-lg border border-[#2F343C] bg-[#252A31]/60 flex items-center justify-center animate-fade-in delay-500">
          <Database className="w-5 h-5 text-[#2D72D2]" />
        </div>
        <div className="absolute bottom-[25%] left-[15%] w-12 h-12 rounded-lg border border-[#2F343C] bg-[#252A31]/60 flex items-center justify-center animate-fade-in delay-700">
          <GitCompare className="w-5 h-5 text-[#7961DB]" />
        </div>
        <div className="absolute bottom-[30%] right-[18%] w-12 h-12 rounded-lg border border-[#2F343C] bg-[#252A31]/60 flex items-center justify-center animate-fade-in delay-400">
          <Activity className="w-5 h-5 text-[#238551]" />
        </div>

        {/* Connection lines */}
        <svg className="absolute inset-0 w-full h-full">
          <line x1="15%" y1="24%" x2="50%" y2="50%" stroke="#2F343C" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
          <line x1="85%" y1="34%" x2="50%" y2="50%" stroke="#2F343C" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
          <line x1="18%" y1="72%" x2="50%" y2="50%" stroke="#2F343C" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
          <line x1="80%" y1="68%" x2="50%" y2="50%" stroke="#2F343C" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
        </svg>
      </div>

      <div className="relative z-10 section-container text-center pt-24">
        {/* Badge */}
        <div className="animate-fade-in-up inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#2F343C] bg-[#252A31]/80 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#238551] animate-data-pulse" />
          <span className="text-xs text-[#8F99A8] font-medium">
            Algorithmic Football Intelligence Platform
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-display text-[#F6F7F9] animate-fade-in-up delay-100 max-w-4xl mx-auto">
          The operating system for{' '}
          <span className="bg-gradient-to-r from-[#4C90F0] to-[#147EB3] bg-clip-text text-transparent">
            tactical intelligence
          </span>
        </h1>

        {/* Sub copy */}
        <p className="text-body-large max-w-2xl mx-auto mt-6 animate-fade-in-up delay-200">
          Six algorithm modules. Four seamless ingestors. One unified platform
          that transforms raw data into decisions that win football matches.
        </p>

        {/* CTAs */}
        <div className="flex items-center justify-center gap-4 mt-10 animate-fade-in-up delay-300">
          <a href="#platform" className="btn-primary">
            Explore the Platform
            <ArrowRight className="w-4 h-4" />
          </a>
          <a href="#algorithms" className="btn-ghost">
            View Algorithms
          </a>
        </div>

        {/* Metrics strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mt-20 pt-12 border-t border-[#2F343C] max-w-3xl mx-auto animate-fade-in-up delay-500">
          {[
            { value: '40+', label: 'Tactical patterns detected' },
            { value: '6', label: 'Algorithm modules' },
            { value: '10Hz', label: 'GPS sampling rate' },
            { value: '100Hz', label: 'IMU sensor resolution' },
          ].map((m) => (
            <div key={m.label} className="text-center">
              <div className="metric-value">{m.value}</div>
              <div className="metric-label">{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
