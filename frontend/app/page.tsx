"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { PageLoader } from "@/components/LoadingSpinner";
import { formatDate, formatCompactNumber } from "@/lib/utils";
import type { Dataset } from "@/lib/types";
import { Reveal } from "@/components/effects/ScrollReveal";
import { AnimatedCounter } from "@/components/effects/AnimatedCounter";
import EngineSimulation from "@/components/landing/EngineSimulation";
import { MethodologyWalkthrough } from "@/components/landing/MethodologyWalkthrough";
import {
  Database,
  Boxes,
  Link2,
  Activity,
  Search,
  Bell,
  Settings,
  MapPin,
  Goal,
} from "lucide-react";

/* ─── Dashboard (authenticated) ─── */
function Dashboard() {
  const { data: datasets, isLoading: datasetsLoading } = useQuery({
    queryKey: ["datasets"],
    queryFn: () => api.listDatasets() as Promise<{ items: Dataset[] }>,
  });

  const totalEntities = datasets?.items?.reduce((sum, d) => sum + d.entity_count, 0) || 0;
  const totalEdges = datasets?.items?.reduce((sum, d) => sum + d.edge_count, 0) || 0;

  if (datasetsLoading) return <PageLoader />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-white" style={{ letterSpacing: "-0.02em" }}>
          Dashboard
        </h1>
        <p className="text-sm text-li-gray-400 mt-1">
          Overview of your intelligence discovery workspace
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Datasets" value={datasets?.items?.length || 0} icon={Database} />
        <StatCard label="Total Entities" value={formatCompactNumber(totalEntities)} icon={Boxes} />
        <StatCard label="Total Edges" value={formatCompactNumber(totalEdges)} icon={Link2} />
        <StatCard label="Active Jobs" value={0} icon={Activity} />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          href="/datasets/new"
          className="li-card py-3 px-4 flex items-center gap-3 group cursor-pointer hover:border-li-gray-600 transition-colors"
        >
          <Database className="w-5 h-5 text-li-primary" />
          <span className="text-sm text-li-text-secondary group-hover:text-li-primary transition-colors">
            Upload Dataset
          </span>
        </Link>
        <Link
          href="/search"
          className="li-card py-3 px-4 flex items-center gap-3 group cursor-pointer hover:border-li-gray-600 transition-colors"
        >
          <Search className="w-5 h-5 text-li-primary" />
          <span className="text-sm text-li-text-secondary group-hover:text-li-primary transition-colors">
            Search Entities
          </span>
        </Link>
        <Link
          href="/alerts"
          className="li-card py-3 px-4 flex items-center gap-3 group cursor-pointer hover:border-li-gray-600 transition-colors"
        >
          <Bell className="w-5 h-5 text-li-primary" />
          <span className="text-sm text-li-text-secondary group-hover:text-li-primary transition-colors">
            Manage Alerts
          </span>
        </Link>
        <Link
          href="/settings"
          className="li-card py-3 px-4 flex items-center gap-3 group cursor-pointer hover:border-li-gray-600 transition-colors"
        >
          <Settings className="w-5 h-5 text-li-primary" />
          <span className="text-sm text-li-text-secondary group-hover:text-li-primary transition-colors">
            Account Settings
          </span>
        </Link>
      </div>

      {/* Live Adapters — streaming sources that feed the engine in real time */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-white" style={{ letterSpacing: "-0.01em" }}>
            Live Adapters
          </h2>
          <span className="text-xs font-mono text-li-gray-600 uppercase tracking-wider">
            Streaming into BTUT → TCD-JEPA
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/dunc"
            className="li-card group cursor-pointer hover:border-li-cyan transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-li-black-surface border border-li-border flex items-center justify-center">
                  <Goal className="w-5 h-5 text-li-cyan" />
                </div>
                <div>
                  <h3 className="font-medium text-white leading-tight">
                    D-U-N-C Football
                  </h3>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-li-cyan mt-0.5">
                    Live · 10 Hz
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-li-green">● LIVE</span>
            </div>
            <p className="text-sm text-li-text-secondary leading-relaxed">
              Streaming GPS/RFID tracking from match play. Digital twins,
              tactical convergence detection, role-scoped AI for manager and
              staff. Feeds directly into the engine.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs font-mono text-white">22</p>
                <p className="text-[10px] text-li-gray-600 uppercase tracking-wider">twins</p>
              </div>
              <div>
                <p className="text-xs font-mono text-white">3</p>
                <p className="text-[10px] text-li-gray-600 uppercase tracking-wider">edge types</p>
              </div>
              <div>
                <p className="text-xs font-mono text-white">10 Hz</p>
                <p className="text-[10px] text-li-gray-600 uppercase tracking-wider">rate</p>
              </div>
            </div>
          </Link>

          <Link
            href="/franklin"
            className="li-card group cursor-pointer hover:border-li-warm transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-li-black-surface border border-li-border flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-li-warm" />
                </div>
                <div>
                  <h3 className="font-medium text-white leading-tight">
                    Franklin Street
                  </h3>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-li-warm mt-0.5">
                    Live · multi-hour
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-li-green">● LIVE</span>
            </div>
            <p className="text-sm text-li-text-secondary leading-relaxed">
              Multi-hour venue busyness graph — spatial proximity and
              busyness-correlation edges for the awakening pipeline.
            </p>
          </Link>

          <Link
            href="/datasets/new"
            className="li-card group cursor-pointer hover:border-li-gray-600 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-li-black-surface border border-li-border flex items-center justify-center">
                  <Database className="w-5 h-5 text-li-text-secondary" />
                </div>
                <div>
                  <h3 className="font-medium text-white leading-tight">
                    Upload Adapter
                  </h3>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-li-text-muted mt-0.5">
                    CSV · JSON · Hub
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm text-li-text-secondary leading-relaxed">
              Bring your own dataset — CSV edge lists, JSON adjacency, or a
              Hugging Face hub import. Feeds the same pipeline as the live
              streams.
            </p>
          </Link>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-white" style={{ letterSpacing: "-0.01em" }}>
            Recent Datasets
          </h2>
          <Link href="/datasets" className="btn-tertiary">
            View all
          </Link>
        </div>

        {datasets?.items && datasets.items.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {datasets.items.slice(0, 6).map((dataset: Dataset) => (
              <Link key={dataset.id} href={`/datasets/${dataset.id}`} className="li-card group cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-medium text-white group-hover:text-white transition-colors">
                    {dataset.name}
                  </h3>
                  <StatusBadge status={dataset.status} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-mono font-medium text-white">{formatCompactNumber(dataset.entity_count)}</p>
                    <p className="text-xs text-li-gray-600">Entities</p>
                  </div>
                  <div>
                    <p className="text-lg font-mono font-medium text-white">{formatCompactNumber(dataset.edge_count)}</p>
                    <p className="text-xs text-li-gray-600">Edges</p>
                  </div>
                  <div>
                    <p className="text-lg font-mono font-medium text-white">{dataset.density.toFixed(3)}</p>
                    <p className="text-xs text-li-gray-600">Density</p>
                  </div>
                </div>
                <p className="text-xs text-li-gray-600 mt-3 font-mono">{formatDate(dataset.created_at)}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="li-card text-center py-12">
            <Database className="w-12 h-12 text-li-gray-600 mx-auto mb-4" />
            <p className="text-li-gray-400 mb-4">No datasets yet</p>
            <Link href="/datasets/new" className="li-btn-primary text-sm">
              Upload Your First Dataset
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Landing Page (unauthenticated) ─── */
function LandingPage() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollIndicatorOpacity = Math.max(0, 1 - scrollY / 120);
  const scrollIndicatorTranslate = Math.min(scrollY * 0.5, 60);

  return (
    <main className="relative">
      {/* Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrollY > 50 ? "bg-black/80 backdrop-blur-xl border-b border-li-gray-900/50" : "bg-transparent"
        }`}
      >
        <div className="container-li">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-3">
                <div className="relative w-8 h-8 group">
                  <div className="absolute inset-0 border border-white transition-transform duration-300 group-hover:rotate-45" />
                  <div className="absolute inset-1.5 bg-white transition-transform duration-300 group-hover:rotate-45" />
                </div>
                <span className="text-sm font-sans font-medium tracking-[0.15em] uppercase">
                  Latent Intelligence
                </span>
              </Link>
              <span className="hidden lg:inline-flex items-center gap-2 text-xs text-li-gray-600 ml-2">
                <kbd className="px-1.5 py-0.5 border border-li-gray-800 rounded text-xs font-mono text-li-gray-500 bg-li-black-light">
                  ⌘K
                </kbd>
              </span>
            </div>
            <div className="hidden md:flex items-center gap-10">
              <Link href="/datasets" className="nav-link">Platform</Link>
              <Link href="#methodology" className="nav-link">Methodology</Link>
              <Link href="#architecture" className="nav-link">Architecture</Link>
              <Link href="#impact" className="nav-link">Impact</Link>
              <Link href="/login" className="btn-primary px-6 py-2.5">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="min-h-screen flex flex-col justify-center relative px-6 md:px-8 lg:px-16">
        <div className="container-li w-full">
          <div className="max-w-4xl">
            <p className="overline opacity-0 animate-fade-in-up animation-delay-200">
              Enterprise Structure Discovery
            </p>
            <h1 className="heading-display mt-6 opacity-0 animate-fade-in-up animation-delay-400">
              Discover <em className="heading-italic text-white">Hidden</em>
              <br />
              Structure
            </h1>
            <p className="text-hero-sub text-li-gray-400 mt-8 max-w-2xl opacity-0 animate-fade-in-up animation-delay-600 font-sans">
              Unsupervised intelligence that finds what you didn&apos;t know to look for.
              No labels. No schemas. No supervision.
            </p>
            <div className="flex flex-wrap items-center gap-6 mt-12 opacity-0 animate-fade-in-up animation-delay-800">
              <Link href="/datasets/new" className="btn-primary">
                Start Discovering
              </Link>
              <Link href="#methodology" className="btn-tertiary">
                See Methodology
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4"
          style={{
            opacity: scrollIndicatorOpacity,
            transform: `translateX(-50%) translateY(${scrollIndicatorTranslate}px)`,
          }}
        >
          <span className="caption text-li-gray-600">Scroll</span>
          <div className="w-px h-12 origin-top animate-line-grow">
            <div className="w-full h-full bg-gradient-to-b from-li-gray-600 to-transparent" />
          </div>
        </div>
      </section>

      {/* Stats Section — Metric Cards */}
      <section id="impact" className="section-padding">
        <div className="container-li">
          <Reveal>
            <div className="divider-gradient mb-24" />
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { value: 519, suffix: "", label: "Semiconductor Entities", sub: "Georgetown CSET" },
              { value: 100, suffix: "%", label: "Module Purity", sub: "15/15 GOV clusters" },
              { value: 9725, suffix: "", label: "Financial Entities", sub: "SEC EDGAR 10-K" },
              { value: 16, suffix: "", label: "Crystallized Modules", sub: "GDELT Global Events" },
            ].map((stat, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="card-metric">
                  <AnimatedCounter
                    target={stat.value}
                    suffix={stat.suffix}
                    className="metric-value block"
                  />
                  <p className="metric-label">{stat.label}</p>
                  <div className="metric-status">
                    <span className="metric-dot" />
                    <span className="font-mono text-xs text-li-gray-500">{stat.sub}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Statement — The Engine */}
      <section className="section-padding">
        <div className="container-li">
          <Reveal>
            <p className="overline mb-4">The Engine</p>
            <div className="line-accent-cyan mb-12" />
          </Reveal>
          <Reveal delay={100}>
            <h2 className="heading-section max-w-3xl">
              TCD-JEPA: <em className="heading-italic text-white">Topological Crystallization</em> Dynamics
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="body-large text-li-gray-400 max-w-2xl mt-8 mb-12 font-sans">
              The first architecture that discovers structural modules through persistent homology,
              crystallizes typed neural predictors, and produces interpretable output —
              without labels, predefined schemas, or supervised training.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <EngineSimulation />
          </Reveal>
        </div>
      </section>

      {/* Methodology — Interactive Walkthrough */}
      <section id="methodology" className="section-padding section-depth">
        <div className="container-li">
          <Reveal>
            <p className="overline mb-4">Methodology</p>
            <div className="line-accent-cyan mb-12" />
          </Reveal>
          <Reveal delay={100}>
            <h2 className="heading-section mb-16">
              From Raw Data to<br /><em className="heading-italic text-white">Actionable Intelligence</em>
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <MethodologyWalkthrough />
          </Reveal>
        </div>
      </section>

      {/* Architecture Section */}
      <section id="architecture" className="section-padding">
        <div className="container-li">
          <Reveal>
            <div className="divider-gradient mb-24" />
          </Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24">
            <div>
              <Reveal>
                <p className="overline mb-4">Architecture</p>
                <div className="line-accent-cyan mb-12" />
              </Reveal>
              <Reveal delay={100}>
                <h2 className="heading-section">
                  Built for<br /><em className="heading-italic text-white">Enterprise Scale</em>
                </h2>
              </Reveal>
              <Reveal delay={200}>
                <p className="body-text mt-8 max-w-lg font-sans">
                  Full-stack platform with FastAPI backend, Next.js frontend,
                  PostgreSQL, Neo4j graph store, Redis, and TCD-JEPA engine.
                  Containerized with Docker, ready for Kubernetes.
                </p>
              </Reveal>
            </div>
            <div>
              <Reveal delay={150}>
                <div className="space-y-4">
                  {[
                    { label: "Backend", tech: "FastAPI \u00b7 Celery \u00b7 PyTorch", color: "#3fb950" },
                    { label: "Frontend", tech: "Next.js 14 \u00b7 TypeScript \u00b7 D3.js \u00b7 Three.js", color: "#00d4ff" },
                    { label: "Data", tech: "PostgreSQL \u00b7 Neo4j \u00b7 Redis \u00b7 MinIO", color: "#a371f7" },
                    { label: "Security", tech: "JWT \u00b7 RBAC \u00b7 SOC 2 \u00b7 Audit Logs", color: "#f85149" },
                    { label: "Engine", tech: "TCD-JEPA \u00b7 Persistent Homology \u00b7 GNN", color: "#d29922" },
                  ].map((item, i) => (
                    <Reveal key={i} delay={200 + i * 80}>
                      <div className="card flex items-center gap-6">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <div>
                          <p className="text-sm font-medium text-white">{item.label}</p>
                          <p className="text-sm text-li-gray-600 font-mono">{item.tech}</p>
                        </div>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding section-depth">
        <div className="container-li text-center">
          <Reveal>
            <h2 className="heading-section">
              Ready to Discover<br /><em className="heading-italic text-white">Hidden Structure?</em>
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="body-text text-center mt-8 max-w-lg mx-auto font-sans">
              Upload your entity-relationship dataset and let TCD-JEPA reveal
              the patterns no one knew existed.
            </p>
          </Reveal>
          <Reveal delay={400}>
            <div className="flex flex-wrap justify-center items-center gap-6 mt-12">
              <Link href="/register" className="btn-primary">
                Create Account
              </Link>
              <Link href="/login" className="btn-tertiary">
                Sign In
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-li-gray-900 py-16">
        <div className="container-li">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div>
              <span className="text-sm font-sans font-medium tracking-[0.15em] uppercase">
                Latent Intelligence
              </span>
              <p className="text-sm text-li-gray-600 mt-4">
                Enterprise Structure Discovery Platform
              </p>
            </div>
            <div>
              <p className="overline mb-4">Platform</p>
              <div className="space-y-3">
                <Link href="/datasets" className="block text-sm text-li-gray-500 hover:text-white transition-colors">Datasets</Link>
                <Link href="/datasets/new" className="block text-sm text-li-gray-500 hover:text-white transition-colors">Upload Data</Link>
                <Link href="#methodology" className="block text-sm text-li-gray-500 hover:text-white transition-colors">Methodology</Link>
              </div>
            </div>
            <div>
              <p className="overline mb-4">Resources</p>
              <div className="space-y-3">
                <Link href="#" className="block text-sm text-li-gray-500 hover:text-white transition-colors">Documentation</Link>
                <Link href="#" className="block text-sm text-li-gray-500 hover:text-white transition-colors">API Reference</Link>
                <Link href="#" className="block text-sm text-li-gray-500 hover:text-white transition-colors">Security</Link>
              </div>
            </div>
            <div>
              <p className="overline mb-4">Company</p>
              <div className="space-y-3">
                <Link href="#" className="block text-sm text-li-gray-500 hover:text-white transition-colors">About</Link>
                <Link href="#" className="block text-sm text-li-gray-500 hover:text-white transition-colors">Contact</Link>
                <Link href="#" className="block text-sm text-li-gray-500 hover:text-white transition-colors">GitHub</Link>
              </div>
            </div>
          </div>
          <div className="divider-gradient mt-16 mb-8" />
          <p className="text-xs text-li-gray-700">
            &copy; 2026 Latent Intelligence. Built by Diren Kumaratilleke.
          </p>
        </div>
      </footer>
    </main>
  );
}

/* ─── Page Router ─── */
export default function HomePage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-60 p-8">
        <Navbar />
        <Dashboard />
      </div>
    </div>
  );
}
