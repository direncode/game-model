'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  Activity,
  Brain,
  Target,
  Zap,
  Users,
  BarChart3,
  Shield,
  ArrowRight,
  Play,
  ChevronDown,
} from 'lucide-react';

// Animated counter hook
function useCounter(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [isVisible, end, duration]);

  return { count, ref };
}

// Floating particles background
function ParticleField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(50)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-white/20 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `float ${5 + Math.random() * 10}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.2; }
          50% { transform: translateY(-20px) translateX(10px); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

// Animated grid lines
function GridBackground() {
  return (
    <div className="absolute inset-0 hero-grid opacity-50" />
  );
}

// Navigation
function Navigation() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-black/90 backdrop-blur-lg border-b border-white/5' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-semibold tracking-tight">TACTICAL.AI</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <a href="#platform" className="nav-link">Platform</a>
          <a href="#algorithm" className="nav-link">Algorithm</a>
          <a href="#capabilities" className="nav-link">Capabilities</a>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="btn-outline hidden sm:block">
            Launch Platform
          </Link>
          <Link href="/dashboard" className="btn-primary">
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}

// Hero Section
function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 bg-black" />
      <div className="absolute inset-0 hero-gradient" />
      <GridBackground />
      <ParticleField />

      {/* Radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/10 rounded-full blur-[120px]" />

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-gray-400">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          Now with Premier League Integration
        </div>

        <h1 className="mb-8">
          <span className="block text-gray-400 text-2xl md:text-3xl font-light mb-4">
            The Operating System for
          </span>
          <span className="block bg-gradient-to-r from-white via-white to-gray-500 bg-clip-text text-transparent">
            Football Intelligence
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-lg md:text-xl text-gray-400 mb-12 leading-relaxed">
          Transform raw GPS and wearable data into actionable tactical intelligence.
          Build digital twins, simulate scenarios, and optimize performance in real-time.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link href="/dashboard" className="btn-primary flex items-center gap-2">
            <Play className="w-4 h-4" />
            Launch Platform
          </Link>
          <button className="btn-outline flex items-center gap-2">
            Watch Demo
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-500">
          <span className="text-xs uppercase tracking-widest">Scroll to explore</span>
          <ChevronDown className="w-5 h-5 animate-bounce" />
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
    </section>
  );
}

// Stats Section
function Stats() {
  const stat1 = useCounter(256);
  const stat2 = useCounter(99);
  const stat3 = useCounter(47);
  const stat4 = useCounter(12);

  return (
    <section className="relative py-24 border-y border-white/5">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          <div ref={stat1.ref} className="text-center">
            <div className="stat-number">{stat1.count}</div>
            <div className="text-gray-500 text-sm uppercase tracking-widest mt-2">
              Latent Dimensions
            </div>
          </div>
          <div ref={stat2.ref} className="text-center">
            <div className="stat-number">{stat2.count}%</div>
            <div className="text-gray-500 text-sm uppercase tracking-widest mt-2">
              Prediction Accuracy
            </div>
          </div>
          <div ref={stat3.ref} className="text-center">
            <div className="stat-number">{stat3.count}ms</div>
            <div className="text-gray-500 text-sm uppercase tracking-widest mt-2">
              Real-time Latency
            </div>
          </div>
          <div ref={stat4.ref} className="text-center">
            <div className="stat-number">{stat4.count}</div>
            <div className="text-gray-500 text-sm uppercase tracking-widest mt-2">
              Elite Clubs
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Platform Section
function Platform() {
  return (
    <section id="platform" className="relative py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="mb-6">
              <span className="text-gray-500">One platform.</span>
              <br />
              <span className="text-white">Infinite possibilities.</span>
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed mb-8">
              TACTICAL.AI integrates GPS tracking, wearable biometrics, and video analysis
              into a unified intelligence platform. Transform fragmented data streams into
              coherent tactical understanding.
            </p>
            <div className="space-y-4">
              {[
                'Real-time player tracking and digital twins',
                'AI-powered tactical pattern recognition',
                'Energy-based formation optimization',
                'Predictive injury risk modeling',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-gray-300">
                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Platform visualization */}
          <div className="relative">
            <div className="aspect-square relative">
              {/* Orbital rings */}
              <div className="absolute inset-0 border border-white/5 rounded-full" />
              <div className="absolute inset-8 border border-white/5 rounded-full" />
              <div className="absolute inset-16 border border-white/5 rounded-full" />

              {/* Center core */}
              <div className="absolute inset-24 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-full flex items-center justify-center glow">
                <Brain className="w-16 h-16 text-cyan-400" />
              </div>

              {/* Orbiting nodes */}
              {[
                { icon: Activity, angle: 0, label: 'GPS' },
                { icon: Target, angle: 72, label: 'Tactics' },
                { icon: Users, angle: 144, label: 'Team' },
                { icon: BarChart3, angle: 216, label: 'Analytics' },
                { icon: Shield, angle: 288, label: 'Health' },
              ].map(({ icon: Icon, angle, label }, i) => (
                <div
                  key={i}
                  className="absolute w-16 h-16 card-dark rounded-xl flex flex-col items-center justify-center"
                  style={{
                    top: `${50 + 42 * Math.sin((angle * Math.PI) / 180)}%`,
                    left: `${50 + 42 * Math.cos((angle * Math.PI) / 180)}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <Icon className="w-6 h-6 text-white mb-1" />
                  <span className="text-[10px] text-gray-500 uppercase">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Capabilities Section
function Capabilities() {
  const capabilities = [
    {
      icon: Brain,
      title: 'Digital Twin Engine',
      description:
        'Create precise digital replicas of every player. Model physical states, tactical tendencies, and decision-making patterns with 96-dimensional feature vectors.',
    },
    {
      icon: Zap,
      title: 'Real-time Analysis',
      description:
        'Process GPS coordinates, accelerometer data, and heart rate metrics at 10Hz. Instant coherence scoring between tactical intent and on-pitch execution.',
    },
    {
      icon: Target,
      title: 'Pattern Recognition',
      description:
        'Markov chain analysis identifies recurring tactical sequences. Predict opposition movements and optimize pressing triggers automatically.',
    },
    {
      icon: BarChart3,
      title: 'Energy Modeling',
      description:
        'Undercurrent Flux Engine computes trajectory deviation, friction terms, and self-prediction error. Quantify tactical stability mathematically.',
    },
    {
      icon: Shield,
      title: 'Injury Prevention',
      description:
        'Fatigue modeling integrates sprint capacity, metabolic load, and recovery rates. Proactive substitution recommendations prevent injuries.',
    },
    {
      icon: Users,
      title: 'Team Coherence',
      description:
        'Measure alignment between ideal formations and actual positions. Identify players deviating from tactical instructions in real-time.',
    },
  ];

  return (
    <section id="capabilities" className="relative py-32 bg-gradient-to-b from-black via-gray-950 to-black">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="mb-4">Capabilities</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Built for elite football operations. Every feature designed for
            the demands of professional competition.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {capabilities.map((cap, i) => (
            <div
              key={i}
              className="card-dark rounded-xl p-8 transition-all duration-300 hover:translate-y-[-4px]"
            >
              <div className="feature-icon mb-6">
                <cap.icon className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-xl mb-3">{cap.title}</h3>
              <p className="text-gray-400 leading-relaxed">{cap.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Algorithm Section - Core Technology Showcase
function Algorithm() {
  return (
    <section id="algorithm" className="relative py-32 bg-black overflow-hidden">
      {/* Background grid effect */}
      <div className="absolute inset-0 hero-grid opacity-30" />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-cyan-400 text-sm uppercase tracking-widest mb-4 block">Core Algorithm</span>
          <h2 className="mb-6">
            Undercurrent Flux Engine
          </h2>
          <p className="text-gray-400 text-lg max-w-3xl mx-auto">
            The mathematical foundation powering real-time tactical analysis.
            256-dimensional latent space modeling meets energy-based coherence scoring.
          </p>
        </div>

        {/* Energy Function Display */}
        <div className="card-dark rounded-2xl p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" />
            <span className="text-xs uppercase tracking-widest text-cyan-400">Energy Function</span>
          </div>

          <div className="bg-black/50 rounded-xl p-8 font-mono text-center">
            <div className="text-2xl md:text-3xl text-white mb-4">
              E = α·<span className="text-cyan-400">Δtrajectory</span> + β·<span className="text-purple-400">friction</span> + γ·<span className="text-emerald-400">ε_self</span>
            </div>
            <div className="grid md:grid-cols-3 gap-6 mt-8 text-left">
              <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                <div className="text-cyan-400 font-semibold mb-2">Trajectory Deviation</div>
                <div className="text-sm text-gray-400">Measures divergence between predicted and actual player movements in latent space</div>
              </div>
              <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <div className="text-purple-400 font-semibold mb-2">Undercurrent Friction</div>
                <div className="text-sm text-gray-400">coherence_dev + fatigue_energy + overpress — tactical resistance forces</div>
              </div>
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <div className="text-emerald-400 font-semibold mb-2">Self-Prediction Error</div>
                <div className="text-sm text-gray-400">Digital twin accuracy — how well the model predicts its own state</div>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Specs Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { value: '96', label: 'Input Dimensions', desc: 'GPS, biometrics, tactical' },
            { value: '256', label: 'Latent Dimensions', desc: 'Compressed representation' },
            { value: '10Hz', label: 'Sample Rate', desc: 'Real-time processing' },
            { value: '<50ms', label: 'Inference Time', desc: 'End-to-end latency' },
          ].map((spec, i) => (
            <div key={i} className="card-dark rounded-xl p-6 text-center">
              <div className="text-4xl font-light text-white mb-2">{spec.value}</div>
              <div className="text-sm text-cyan-400 mb-1">{spec.label}</div>
              <div className="text-xs text-gray-500">{spec.desc}</div>
            </div>
          ))}
        </div>

        {/* Feature Vector Breakdown */}
        <div className="card-dark rounded-2xl p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-cyan-400" />
              <span className="text-lg font-medium">96-Dimensional Feature Vector</span>
            </div>
            <span className="text-xs text-gray-500 uppercase tracking-wider">Real-time Input</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { range: '0-6', label: 'Distance', color: 'bg-blue-500' },
              { range: '7-15', label: 'Speed Zones', color: 'bg-cyan-500' },
              { range: '16-25', label: 'Acceleration', color: 'bg-teal-500' },
              { range: '26-34', label: 'Load/Position', color: 'bg-emerald-500' },
              { range: '35-49', label: 'HR/Twin State', color: 'bg-green-500' },
              { range: '50-59', label: 'Tactical', color: 'bg-lime-500' },
              { range: '60-74', label: 'Formation', color: 'bg-yellow-500' },
              { range: '75-87', label: 'Coherence', color: 'bg-orange-500' },
              { range: '88-95', label: 'Physical', color: 'bg-red-500' },
            ].map((segment, i) => (
              <div key={i} className="p-3 bg-black/30 rounded-lg border border-white/5">
                <div className={`w-full h-1 ${segment.color} rounded-full mb-2 opacity-60`} />
                <div className="text-xs text-white/70">{segment.label}</div>
                <div className="text-[10px] text-gray-500 font-mono">[{segment.range}]</div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-emerald-500/10 rounded-lg border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full" />
              <span className="text-sm text-white">Markov Chain Pattern Recognition</span>
            </div>
            <p className="text-xs text-gray-400">
              Sequential tactical patterns are modeled as Markov chains, enabling prediction of opponent movements
              and automatic detection of recurring sequences with Q-learning optimization for decision-making.
            </p>
          </div>
        </div>

        {/* Live Demo CTA */}
        <div className="mt-12 text-center">
          <Link href="/dashboard" className="btn-primary inline-flex items-center gap-2">
            <Play className="w-4 h-4" />
            See Algorithm in Action
          </Link>
        </div>
      </div>
    </section>
  );
}

// CTA Section
function CTA() {
  return (
    <section className="relative py-32">
      <div className="absolute inset-0 hero-gradient opacity-50" />
      <div className="relative max-w-4xl mx-auto px-6 text-center">
        <h2 className="mb-6">
          Ready to transform your
          <br />
          tactical intelligence?
        </h2>
        <p className="text-gray-400 text-lg mb-10 max-w-2xl mx-auto">
          Join elite clubs already using TACTICAL.AI to gain competitive advantage.
          Start with a live demo of your team's data.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/dashboard" className="btn-primary flex items-center gap-2">
            Access Platform
            <ArrowRight className="w-4 h-4" />
          </Link>
          <button className="btn-outline">Schedule Demo</button>
        </div>
      </div>
    </section>
  );
}

// Footer
function Footer() {
  return (
    <footer className="border-t border-white/5 py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-semibold">TACTICAL.AI</span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed">
              The operating system for football intelligence.
              Transform data into decisions.
            </p>
          </div>

          <div>
            <h4 className="text-sm uppercase tracking-widest text-gray-400 mb-4">Platform</h4>
            <div className="space-y-3">
              <a href="#" className="footer-link block">Digital Twins</a>
              <a href="#" className="footer-link block">Analytics</a>
              <a href="#" className="footer-link block">Pattern Engine</a>
              <a href="#" className="footer-link block">UFE Integration</a>
            </div>
          </div>

          <div>
            <h4 className="text-sm uppercase tracking-widest text-gray-400 mb-4">Company</h4>
            <div className="space-y-3">
              <a href="#" className="footer-link block">About</a>
              <a href="#" className="footer-link block">Careers</a>
              <a href="#" className="footer-link block">Contact</a>
              <a href="#" className="footer-link block">Press</a>
            </div>
          </div>

          <div>
            <h4 className="text-sm uppercase tracking-widest text-gray-400 mb-4">Resources</h4>
            <div className="space-y-3">
              <a href="#" className="footer-link block">Documentation</a>
              <a href="#" className="footer-link block">API Reference</a>
              <a href="#" className="footer-link block">Research</a>
              <a href="#" className="footer-link block">Blog</a>
            </div>
          </div>
        </div>

        <div className="section-divider mb-8" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-gray-500 text-sm">
          <div>&copy; 2025 TACTICAL.AI. All rights reserved.</div>
          <div className="flex items-center gap-6">
            <a href="#" className="footer-link">Privacy</a>
            <a href="#" className="footer-link">Terms</a>
            <a href="#" className="footer-link">Security</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Main Page Component
export default function HomePage() {
  return (
    <main className="bg-black min-h-screen">
      <Navigation />
      <Hero />
      <Stats />
      <Algorithm />
      <Platform />
      <Capabilities />
      <CTA />
      <Footer />
    </main>
  );
}
