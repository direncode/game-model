# Apple-Grade Landing Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform latentocean.com from functional minimalist interface into an Apple-product-page experience with 12 cinematic sections, real SEC EDGAR sample data, and scroll-driven animations — while preserving the product surface at `/engine`.

**Architecture:** New marketing `app/page.tsx` composed of 12 landing components (`components/landing/*`). Current product surface moves to `app/engine/page.tsx`. Real EDGAR reduction pre-computed at build-time as static JSON loaded by the Live Demo section. Framer-motion for scroll-driven animations, canvas-based particle system for hero.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS (existing), Framer Motion (new), Instrument Serif + Inter + JetBrains Mono (existing config), Canvas 2D for particle system.

**Reference:** Design doc at `docs/plans/2026-04-15-apple-grade-landing-page-design.md`.

**Preservation Rule:** The existing product surface (`ConnectFlow`, `SurvivorTable`, etc.) stays intact — it becomes the product at `/engine`. Do NOT rewrite those. Only add new marketing components and rewire routing.

---

## Task 1: Install framer-motion dependency

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install dependency**

Run: `cd frontend && npm install framer-motion@^11.0.0 react-intersection-observer@^9.5.0`
Expected: Installs without errors. `node_modules/framer-motion` exists.

**Step 2: Verify**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -5`
Expected: No errors related to framer-motion.

**Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add framer-motion and react-intersection-observer for landing page"
```

---

## Task 2: Move current product surface to /engine route

**Files:**
- Create: `frontend/app/engine/page.tsx`
- Reference (DO NOT delete yet): `frontend/app/page.tsx`

**Step 1: Create the engine route with current product surface**

Create `frontend/app/engine/page.tsx` by copying the exact current content of `frontend/app/page.tsx`. This preserves the product surface.

Run: `cp frontend/app/page.tsx frontend/app/engine/page.tsx`

**Step 2: Verify build still works**

Run: `cd frontend && npm run build 2>&1 | tail -5`
Expected: Build succeeds. Both `/` and `/engine` routes exist.

**Step 3: Commit**

```bash
git add frontend/app/engine/page.tsx
git commit -m "feat: preserve product surface at /engine route before marketing rewrite"
```

---

## Task 3: Create landing component directory + shared motion utilities

**Files:**
- Create: `frontend/components/landing/` (directory)
- Create: `frontend/lib/motion.ts`

**Step 1: Create directory**

Run: `mkdir -p frontend/components/landing/canvas`

**Step 2: Create shared motion variants**

Create `frontend/lib/motion.ts`:

```typescript
import type { Variants } from "framer-motion";

// Fade up from below, used for section entries
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
  },
};

// Fade in without movement, for subtle reveals
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6 } },
};

// Stagger children for lists/grids
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

// Scale up from slightly smaller, for product shots
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 1, ease: [0.22, 1, 0.36, 1] },
  },
};

// Viewport settings for useInView / whileInView
export const viewportOnce = { once: true, margin: "-100px" };
```

**Step 3: Commit**

```bash
git add frontend/lib/motion.ts
git commit -m "feat: add shared motion variants for landing page"
```

---

## Task 4: EDGAR sample data generation script

**Files:**
- Create: `backend/scripts/generate_sample_data.py`

**Step 1: Write the script**

Create `backend/scripts/generate_sample_data.py`:

```python
"""Generate real SEC EDGAR reduction for the landing page Live Demo.

Fetches real public companies from EDGAR, runs the engine reduction,
and exports the result as static JSON consumed by the frontend.

Usage:
    cd backend
    python scripts/generate_sample_data.py --output ../frontend/data/edgar-sample.json
"""
from __future__ import annotations
import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from engine import EngineConfig, LatentOceanEngine
from app.services.btut.adapters.edgar import EdgarAdapter

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def generate(output_path: Path, limit: int = 500, budget_dollars: float = 50.0) -> None:
    logger.info("Fetching %d entities from SEC EDGAR...", limit)
    adapter = EdgarAdapter()
    entities = adapter.fetch_entities(limit=limit)
    edges = adapter.fetch_edges(entities)
    types = sorted({e.get("type", "unknown") for e in entities})

    logger.info("Fetched %d entities, %d edges, types=%s", len(entities), len(edges), types)

    logger.info("Running engine reduction (budget=$%.2f)...", budget_dollars)
    engine = LatentOceanEngine(EngineConfig(
        budget_dollars=budget_dollars,
        target_survivors=150,
        compute_3d_display=True,
    ))
    reduction = engine.reduce(entities, edges, types)
    manifold = engine.represent(reduction)

    # Shape for frontend consumption
    survivors_out = []
    for i, s in enumerate(reduction.survivors):
        entity = s.get("entity", {})
        scores = s.get("scores", {})
        survivors_out.append({
            "id": entity.get("name", f"entity_{i}"),
            "name": entity.get("name", ""),
            "type": entity.get("type", ""),
            "attributes": entity.get("attributes", {}),
            "cluster": s.get("cluster", 0),
            "fingerprint": s.get("fingerprint_48bit", ""),
            "scores": {
                "composite": scores.get("composite", 0.0),
                "diversity": scores.get("diversity", 0.0),
                "reconstruction": scores.get("reconstruction", 0.0),
                "anomaly": scores.get("anomaly", 0.0),
            },
            "coord_8d": manifold.coords_8d_unit[i].tolist() if i < len(manifold.coords_8d_unit) else [],
            "coord_3d": (
                manifold.coords_3d_s2[i].tolist()
                if manifold.coords_3d_s2 is not None and i < len(manifold.coords_3d_s2)
                else None
            ),
        })

    anomalies_out = [
        {
            "id": s["id"],
            "name": s["name"],
            "type": s["type"],
            "score": s["scores"]["anomaly"],
            "narrative": f"{s['name']} shows unusual structural position: composite {s['scores']['composite']:.2f}, anomaly {s['scores']['anomaly']:.2f}.",
        }
        for s in survivors_out
        if s["scores"]["anomaly"] > 0.7
    ][:30]

    # Build cluster summaries
    cluster_map: dict[int, list[dict]] = {}
    for s in survivors_out:
        cluster_map.setdefault(s["cluster"], []).append(s)

    clusters_out = [
        {
            "id": cid,
            "member_count": len(members),
            "dominant_type": max({m["type"] for m in members}, key=lambda t: sum(1 for m in members if m["type"] == t)),
            "sample_members": [m["name"] for m in members[:5]],
        }
        for cid, members in sorted(cluster_map.items())
    ]

    out = {
        "metadata": {
            "source": "SEC EDGAR",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "n_input": reduction.summary.get("total_entities", len(entities)),
            "n_survivors": len(survivors_out),
            "n_clusters": len(clusters_out),
            "reduction_ratio": reduction.summary.get("reduction", 1),
            "wall_seconds": reduction.summary.get("wall_seconds", 0),
            "unique_fingerprints": reduction.summary.get("unique_48bit_fingerprints", 0),
        },
        "survivors": survivors_out,
        "anomalies": anomalies_out,
        "clusters": clusters_out,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    logger.info("Wrote %s (%.1f KB)", output_path, output_path.stat().st_size / 1024)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("../frontend/data/edgar-sample.json"))
    parser.add_argument("--limit", type=int, default=500)
    parser.add_argument("--budget", type=float, default=50.0)
    args = parser.parse_args()
    generate(args.output, limit=args.limit, budget_dollars=args.budget)
```

**Step 2: Commit**

```bash
git add backend/scripts/generate_sample_data.py
git commit -m "feat: EDGAR sample data generation script for landing page"
```

---

## Task 5: Generate the EDGAR sample data

**Files:**
- Create: `frontend/data/edgar-sample.json`

**Step 1: Run the generator**

Run: `cd backend && python scripts/generate_sample_data.py --limit 500 --output ../frontend/data/edgar-sample.json`
Expected: Script runs, fetches EDGAR data, runs engine reduction, writes JSON.

**Step 2: Verify output**

Run: `ls -la frontend/data/edgar-sample.json && python -c "import json; d=json.load(open('frontend/data/edgar-sample.json')); print(f'survivors={len(d[\"survivors\"])}, anomalies={len(d[\"anomalies\"])}, clusters={len(d[\"clusters\"])}')"`
Expected: File exists, reasonable counts (survivors > 50, clusters > 3).

**Step 3: Commit**

```bash
git add frontend/data/edgar-sample.json
git commit -m "data: pre-computed EDGAR reduction for landing page Live Demo"
```

---

## Task 6: Write the new root page.tsx as section composer

**Files:**
- Modify: `frontend/app/page.tsx` (REWRITE)

**Step 1: Replace the current page**

Replace `frontend/app/page.tsx` with:

```tsx
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { ReductionCinematic } from "@/components/landing/ReductionCinematic";
import { LiveDemo } from "@/components/landing/LiveDemo";
import { Architecture } from "@/components/landing/Architecture";
import { UniversalConnect } from "@/components/landing/UniversalConnect";
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
```

**Step 2: Verify it fails because components don't exist yet**

Run: `cd frontend && npm run build 2>&1 | grep -i "cannot find" | head -5`
Expected: Many "Cannot find module" errors. This is correct — we'll create components next.

**Step 3: Don't commit yet** — commit after we have at least a stub for each component.

---

## Task 7: Nav component

**Files:**
- Create: `frontend/components/landing/Nav.tsx`

**Step 1: Create the Nav**

```tsx
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { label: "Engine", href: "#architecture" },
  { label: "Verticals", href: "#verticals" },
  { label: "Enterprise", href: "#enterprise" },
  { label: "Pricing", href: "#pricing" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 h-14 backdrop-blur-xl transition-colors duration-300 ${
        scrolled ? "bg-black/80 border-b border-white/5" : "bg-transparent"
      }`}
    >
      <div className="max-w-[1280px] mx-auto h-full px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-2 h-2 rounded-full bg-li-cyan shadow-[0_0_8px_rgba(0,212,255,0.6)]" />
          <span className="font-display text-base tracking-tight text-white/90 group-hover:text-white">
            Latent Ocean
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              {item.label}
            </a>
          ))}
        </div>

        <Link
          href="/engine"
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
        >
          Launch Engine
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 6h6m0 0L6 3m3 3L6 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </Link>
      </div>
    </nav>
  );
}
```

**Step 2: Don't commit yet.**

---

## Task 8: Hero section

**Files:**
- Create: `frontend/components/landing/Hero.tsx`

**Step 1: Create Hero**

```tsx
"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { fadeUp, viewportOnce } from "@/lib/motion";
import { ReductionCanvas } from "./canvas/ReductionCanvas";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-14">
      {/* Background canvas animation */}
      <div className="absolute inset-0 pointer-events-none opacity-60">
        <ReductionCanvas />
      </div>

      {/* Radial gradient depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.95) 100%)",
        }}
      />

      <div className="relative max-w-[1280px] mx-auto px-6 text-center z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="inline-flex items-center gap-2 h-7 px-3 rounded-full border border-white/10 bg-white/5 backdrop-blur mb-10"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-li-green animate-pulse" />
          <span className="text-xs font-mono text-white/70 tracking-wide">
            ENGINE v0.1.0 · 11 CONNECTORS · LIVE
          </span>
        </motion.div>

        <motion.h1
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="font-display text-[10vw] md:text-[120px] leading-[0.9] tracking-[-0.04em] text-white"
        >
          Latent Ocean
        </motion.h1>

        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.1 }}
          className="mt-8 text-2xl md:text-3xl text-white/80 max-w-3xl mx-auto font-light leading-tight"
        >
          Structural intelligence infrastructure for any database.
        </motion.p>

        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.2 }}
          className="mt-4 text-base text-white/50 max-w-2xl mx-auto"
        >
          Connect anything. See what matters. Your tables, now with intelligence built in.
        </motion.p>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.3 }}
          className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link
            href="/engine"
            className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full bg-white text-black text-base font-medium hover:bg-white/90 transition-colors"
          >
            Launch Engine
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3.5 7h7m0 0L7 3.5m3.5 3.5L7 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </Link>
          <a
            href="#live-demo"
            className="inline-flex items-center justify-center h-12 px-6 text-base text-white/70 hover:text-white transition-colors"
          >
            See it in action ↓
          </a>
        </motion.div>
      </div>
    </section>
  );
}
```

**Step 2: Don't commit yet.**

---

## Task 9: ReductionCanvas — particle animation

**Files:**
- Create: `frontend/components/landing/canvas/ReductionCanvas.tsx`

**Step 1: Create canvas component**

```tsx
"use client";
import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
  survivor: boolean;
  alpha: number;
  size: number;
};

export function ReductionCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let w = 0, h = 0;

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    // Seed particles
    const count = 1200;
    const particles: Particle[] = [];
    const cx = w / 2;
    const cy = h / 2;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 100 + Math.random() * Math.min(w, h) * 0.4;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      const survivor = Math.random() < 0.12; // ~12% are survivors
      particles.push({
        x, y, baseX: x, baseY: y,
        vx: 0, vy: 0,
        survivor,
        alpha: survivor ? 0.9 : 0.25,
        size: survivor ? 1.5 : 0.8,
      });
    }
    particlesRef.current = particles;

    const onMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };
    canvas.addEventListener("mousemove", onMouse);

    const tick = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const time = t * 0.001;

      for (const p of particles) {
        // Slow orbital drift
        const dx = p.baseX - cx;
        const dy = p.baseY - cy;
        const r = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) + (p.survivor ? 0.0003 : 0.0001);
        p.baseX = cx + Math.cos(angle) * r;
        p.baseY = cy + Math.sin(angle) * r;

        // Subtle breathing pulse
        const breathe = Math.sin(time + r * 0.01) * 2;
        p.x = p.baseX + breathe;
        p.y = p.baseY + breathe;

        // Mouse attraction for nearby particles
        const mdx = mouseRef.current.x - p.x;
        const mdy = mouseRef.current.y - p.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < 120) {
          p.x += (mdx / mdist) * 3;
          p.y += (mdy / mdist) * 3;
        }

        // Draw
        ctx.beginPath();
        if (p.survivor) {
          ctx.fillStyle = `rgba(0, 212, 255, ${p.alpha})`;
          ctx.shadowBlur = 12;
          ctx.shadowColor = "rgba(0, 212, 255, 0.8)";
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
          ctx.shadowBlur = 0;
        }
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMouse);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
```

**Step 2: Don't commit yet.**

---

## Task 10: ReductionCinematic — pinned scroll section

**Files:**
- Create: `frontend/components/landing/ReductionCinematic.tsx`

**Step 1: Create the cinematic reduction section**

```tsx
"use client";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const STAGES = [
  { label: "Input entities", value: "100,482", description: "Raw data from any source" },
  { label: "After pre-filter", value: "42,113", description: "Bloom + LSH + entropy gate" },
  { label: "After cascade", value: "3,847", description: "Multi-resolution reduction" },
  { label: "Survivors", value: "347", description: "Signal-rich entities remain" },
  { label: "Clusters", value: "8", description: "Structural groupings identified" },
];

export function ReductionCinematic() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  const activeIndex = useTransform(scrollYProgress, [0, 1], [0, STAGES.length - 1]);

  return (
    <section ref={ref} className="relative h-[500vh]" id="reduction">
      <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
        <div className="max-w-[1280px] mx-auto px-6 w-full text-center">
          <motion.p
            className="font-mono text-xs uppercase tracking-[0.2em] text-white/40 mb-6"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            The Reduction
          </motion.p>

          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white mb-20">
            A million points of noise.<br />
            <span className="text-white/40">A few hundred points of signal.</span>
          </h2>

          <div className="relative h-[300px]">
            {STAGES.map((stage, i) => {
              const stageStart = i / STAGES.length;
              const stageEnd = (i + 1) / STAGES.length;

              return (
                <StageCard
                  key={i}
                  stage={stage}
                  scrollYProgress={scrollYProgress}
                  start={stageStart}
                  end={stageEnd}
                  index={i}
                />
              );
            })}
          </div>

          <p className="mt-24 text-sm font-mono text-white/40">
            Scroll to watch the reduction →
          </p>
        </div>
      </div>
    </section>
  );
}

function StageCard({
  stage,
  scrollYProgress,
  start,
  end,
  index,
}: {
  stage: (typeof STAGES)[number];
  scrollYProgress: ReturnType<typeof useScroll>["scrollYProgress"];
  start: number;
  end: number;
  index: number;
}) {
  const opacity = useTransform(
    scrollYProgress,
    [Math.max(0, start - 0.05), start + 0.02, end - 0.02, Math.min(1, end + 0.05)],
    [0, 1, 1, 0]
  );
  const y = useTransform(scrollYProgress, [start, end], [20, -20]);

  return (
    <motion.div
      style={{ opacity, y }}
      className="absolute inset-0 flex flex-col items-center justify-center"
    >
      <div className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
        Stage {index + 1} of {STAGES.length}
      </div>
      <div className="font-mono text-[120px] md:text-[180px] leading-[0.9] font-light text-white tabular-nums">
        {stage.value}
      </div>
      <div className="mt-6 text-2xl text-white/70">{stage.label}</div>
      <div className="mt-2 text-sm text-white/40">{stage.description}</div>
    </motion.div>
  );
}
```

**Step 2: Don't commit yet.**

---

## Task 11: LiveDemo — real EDGAR data renderer

**Files:**
- Create: `frontend/components/landing/LiveDemo.tsx`

**Step 1: Create the LiveDemo**

```tsx
"use client";
import { motion } from "framer-motion";
import { useState } from "react";
import { fadeUp, viewportOnce } from "@/lib/motion";
import sampleData from "@/data/edgar-sample.json";

type Survivor = {
  id: string;
  name: string;
  type: string;
  attributes: Record<string, unknown>;
  cluster: number;
  scores: {
    composite: number;
    diversity: number;
    reconstruction: number;
    anomaly: number;
  };
};

const TYPE_COLORS: Record<string, string> = {
  company: "#00d4ff",
  filing: "#a371f7",
  financial_fact: "#3fb950",
};

export function LiveDemo() {
  const [selected, setSelected] = useState<Survivor | null>(null);
  const survivors = sampleData.survivors as Survivor[];
  const meta = sampleData.metadata;
  const anomalies = sampleData.anomalies;

  const topSurvivors = [...survivors].sort((a, b) => b.scores.composite - a.scores.composite).slice(0, 20);

  return (
    <section id="live-demo" className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
            Live · Real data · SEC EDGAR
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white mb-6 max-w-4xl">
            {meta.n_input.toLocaleString()} real companies.<br />
            <span className="text-white/40">{meta.n_survivors} signal-rich survivors.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl">
            This is a live reduction of {meta.n_input.toLocaleString()} real public companies from SEC EDGAR filings,
            computed in {meta.wall_seconds.toFixed(1)} seconds. No mockups. No hand-picking. Scroll and click any entity.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          className="mt-16 grid grid-cols-12 gap-6"
        >
          {/* Left: Survivors list */}
          <div className="col-span-12 lg:col-span-7 border border-white/10 rounded-2xl bg-[#0a0a10] overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-mono text-sm uppercase tracking-widest text-white/60">Top Survivors</h3>
              <span className="text-xs font-mono text-white/40">Ranked by composite score</span>
            </div>
            <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
              {topSurvivors.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className={`w-full text-left px-6 py-4 hover:bg-white/5 transition-colors ${
                    selected?.id === s.id ? "bg-white/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-1.5 h-12 rounded-full"
                      style={{ backgroundColor: TYPE_COLORS[s.type] || "#ffffff40" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-base text-white truncate">{s.name}</div>
                      <div className="text-xs font-mono text-white/40 mt-1">
                        {s.type} · cluster {s.cluster}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-lg text-white tabular-nums">
                        {s.scores.composite.toFixed(3)}
                      </div>
                      {s.scores.anomaly > 0.7 && (
                        <div className="text-xs font-mono text-li-red mt-0.5">
                          anomaly {s.scores.anomaly.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Selected detail + stats */}
          <div className="col-span-12 lg:col-span-5 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatBlock label="Reduction" value={`${meta.reduction_ratio}:1`} />
              <StatBlock label="Wall time" value={`${meta.wall_seconds.toFixed(1)}s`} />
              <StatBlock label="Clusters" value={meta.n_clusters.toString()} />
              <StatBlock label="Unique fingerprints" value={meta.unique_fingerprints.toString()} />
            </div>

            {/* Detail panel */}
            <div className="border border-white/10 rounded-2xl bg-[#0a0a10] p-6 min-h-[300px]">
              {selected ? (
                <div>
                  <div className="font-mono text-xs uppercase tracking-widest text-white/40 mb-2">
                    Entity detail
                  </div>
                  <div className="text-2xl text-white mb-4">{selected.name}</div>
                  <dl className="space-y-3 text-sm">
                    <Row k="Type" v={selected.type} />
                    <Row k="Cluster" v={`#${selected.cluster}`} />
                    <Row k="Composite" v={selected.scores.composite.toFixed(4)} />
                    <Row k="Diversity" v={selected.scores.diversity.toFixed(4)} />
                    <Row k="Reconstruction" v={selected.scores.reconstruction.toFixed(4)} />
                    <Row k="Anomaly" v={selected.scores.anomaly.toFixed(4)} />
                  </dl>
                </div>
              ) : (
                <div className="text-white/40 text-sm">
                  Select a survivor to view its structural profile.
                </div>
              )}
            </div>

            {/* Top anomalies */}
            {anomalies.length > 0 && (
              <div className="border border-white/10 rounded-2xl bg-[#0a0a10] p-6">
                <div className="font-mono text-xs uppercase tracking-widest text-white/40 mb-4">
                  Top anomalies
                </div>
                <ul className="space-y-3">
                  {anomalies.slice(0, 5).map((a) => (
                    <li key={a.id} className="text-sm">
                      <div className="text-white">{a.name}</div>
                      <div className="text-xs font-mono text-li-red mt-1">
                        anomaly {a.score.toFixed(3)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 rounded-xl bg-[#0a0a10] p-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">{label}</div>
      <div className="font-mono text-2xl text-white mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-2">
      <dt className="text-white/40 font-mono text-xs uppercase tracking-widest">{k}</dt>
      <dd className="text-white font-mono">{v}</dd>
    </div>
  );
}
```

**Step 2: Don't commit yet.**

---

## Task 12: Architecture — the 5 primitives

**Files:**
- Create: `frontend/components/landing/Architecture.tsx`

**Step 1: Create Architecture section**

```tsx
"use client";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

const PRIMITIVES = [
  {
    name: "Reduce",
    subtitle: "8-tier cascade",
    description: "Forward-only Fokker-Planck mean-field solver. One million points of noise become a few hundred of signal.",
    detail: "BTUT · PreFilter · Cascade · Thinning · Quality",
  },
  {
    name: "Represent",
    subtitle: "Manifold projection",
    description: "L2-normalized 8D hypersphere for compute, optional 3D S² for display. Geometry that preserves semantics.",
    detail: "8D unit sphere · 3D stereographic",
  },
  {
    name: "Discover",
    subtitle: "Topology-aware",
    description: "Cross-source causal linking and persistent homology. Find structural connections humans miss.",
    detail: "Causal linking · TCD-JEPA · Homology",
  },
  {
    name: "Monitor",
    subtitle: "Flow engine",
    description: "Wells, wires, circulation rate, friction index. Real-time health of your data lattice.",
    detail: "Well · Wire · FlowGraph · Conformal",
  },
  {
    name: "Query",
    subtitle: "O(1) lookups",
    description: "Indexed access to survivors, anomalies, clusters, and lineage. RAG-enhanced narrative generation.",
    detail: "Indexed · RAG · Narrative",
  },
];

export function Architecture() {
  return (
    <section id="architecture" className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
            Engine architecture
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white mb-6 max-w-4xl">
            Five primitives.<br />
            <span className="text-white/40">One engine.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl">
            Everything the platform does composes from these. They run in parallel, in sequence, in any combination.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
          className="mt-20 grid grid-cols-1 md:grid-cols-5 gap-px bg-white/5 border border-white/5 rounded-2xl overflow-hidden"
        >
          {PRIMITIVES.map((p, i) => (
            <motion.div
              key={p.name}
              variants={fadeUp}
              className="bg-[#0a0a10] p-8 hover:bg-[#0f0f18] transition-colors"
            >
              <div className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
                0{i + 1}
              </div>
              <div className="font-display text-3xl text-white mb-2">{p.name}</div>
              <div className="font-mono text-xs uppercase tracking-widest text-white/40 mb-4">
                {p.subtitle}
              </div>
              <p className="text-sm text-white/70 leading-relaxed mb-6">{p.description}</p>
              <div className="text-[11px] font-mono text-white/30 leading-relaxed">{p.detail}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
```

**Step 2: Don't commit yet.**

---

## Task 13: UniversalConnect — 11 connectors showcase

**Files:**
- Create: `frontend/components/landing/UniversalConnect.tsx`

**Step 1: Create UniversalConnect**

```tsx
"use client";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

const CONNECTORS = [
  { name: "PostgreSQL", category: "Database", example: "postgresql://..." },
  { name: "MySQL", category: "Database", example: "mysql://..." },
  { name: "MongoDB", category: "Database", example: "mongodb://..." },
  { name: "Snowflake", category: "Warehouse", example: "snowflake://..." },
  { name: "S3", category: "Object Store", example: "s3://bucket/*" },
  { name: "CSV", category: "File", example: "*.csv" },
  { name: "JSON", category: "File", example: "*.json · *.jsonl" },
  { name: "Parquet", category: "File", example: "*.parquet" },
  { name: "Excel", category: "File", example: "*.xlsx" },
  { name: "REST API", category: "API", example: "https://..." },
  { name: "Kafka", category: "Stream", example: "kafka://..." },
];

export function UniversalConnect() {
  return (
    <section id="connect" className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
            Universal connect
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white mb-6 max-w-4xl">
            One input.<br />
            <span className="text-white/40">Any data source.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl">
            Paste a connection string, a URI, a file path, or drag a file in. The engine figures out the rest.
          </p>
        </motion.div>

        {/* Code-like demo */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.1 }}
          className="mt-12 border border-white/10 rounded-2xl bg-[#0a0a10] overflow-hidden"
        >
          <div className="px-6 py-3 border-b border-white/10 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
            <span className="ml-3 font-mono text-xs text-white/40">connect.py</span>
          </div>
          <pre className="p-6 font-mono text-sm text-white/80 overflow-x-auto">
{`from latentocean import Client

client = Client(api_key="lo_sk_...")

# One call. Any source. Auto-detected.
client.infer("postgresql://user:pass@host/db")
client.infer("s3://acme/exports/2026/*.parquet")
client.infer("https://api.acme.com/v2/orders")
client.infer("/data/customers.csv")`}
          </pre>
        </motion.div>

        {/* Connectors grid */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
          className="mt-12 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3"
        >
          {CONNECTORS.map((c) => (
            <motion.div
              key={c.name}
              variants={fadeUp}
              className="border border-white/10 rounded-xl bg-[#0a0a10] p-4 hover:border-white/20 hover:bg-[#0f0f18] transition-colors"
            >
              <div className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-2">
                {c.category}
              </div>
              <div className="text-base text-white">{c.name}</div>
              <div className="font-mono text-[11px] text-white/40 mt-2 truncate">{c.example}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
```

**Step 2: Don't commit yet.**

---

## Task 14: Materialized — lo_* tables with code

**Files:**
- Create: `frontend/components/landing/Materialized.tsx`

**Step 1: Create Materialized section**

```tsx
"use client";
import { motion } from "framer-motion";
import { fadeUp, viewportOnce } from "@/lib/motion";

const LO_TABLES = [
  { name: "lo_survivors", description: "Signal-rich entities with composite, diversity, reconstruction, and anomaly scores" },
  { name: "lo_connections", description: "Structural relationships discovered between entities" },
  { name: "lo_anomalies", description: "Entities flagged by anomaly detection with severity and narrative" },
  { name: "lo_clusters", description: "Cluster memberships with dominant type and centroid geometry" },
  { name: "lo_magnitude", description: "6-dimensional continuous fingerprints for stability analysis" },
  { name: "lo_quality", description: "Per-run quality metrics: coverage, variance ratio, wall time, cost" },
  { name: "lo_lineage", description: "Full event history with parent-child causal chains" },
];

export function Materialized() {
  return (
    <section className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
            Materialized intelligence
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white mb-6 max-w-4xl">
            Intelligence lives in<br />
            <span className="text-white/40">your database.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl">
            Seven native tables written back to your data estate. Query them with SQL. Join them with your existing schema. No new tools.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.1 }}
          className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Left: Code block */}
          <div className="border border-white/10 rounded-2xl bg-[#0a0a10] overflow-hidden">
            <div className="px-6 py-3 border-b border-white/10 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
              <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
              <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
              <span className="ml-3 font-mono text-xs text-white/40">query.sql</span>
            </div>
            <pre className="p-6 font-mono text-sm text-white/80 overflow-x-auto leading-relaxed">
{`-- Top anomalies in your data
SELECT
  s.entity_id,
  s.entity_type,
  s.composite_score,
  s.narrative
FROM `}<span className="text-li-cyan">lo_survivors</span>{` s
WHERE s.anomaly_score > 0.8
ORDER BY s.composite_score DESC
LIMIT 20;

-- Hidden connections across your estate
SELECT
  c.source_id,
  c.target_id,
  c.signal_type,
  c.strength
FROM `}<span className="text-li-cyan">lo_connections</span>{` c
WHERE c.strength > 0.75;`}
            </pre>
          </div>

          {/* Right: Tables list */}
          <div className="space-y-2">
            {LO_TABLES.map((t) => (
              <div
                key={t.name}
                className="border border-white/10 rounded-xl bg-[#0a0a10] p-4 hover:border-white/20 hover:bg-[#0f0f18] transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="font-mono text-sm text-li-cyan whitespace-nowrap pt-0.5">
                    {t.name}
                  </div>
                  <div className="text-sm text-white/60 leading-relaxed">{t.description}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
```

**Step 2: Don't commit yet.**

---

## Task 15: Verticals — domain modules grid

**Files:**
- Create: `frontend/components/landing/Verticals.tsx`

**Step 1: Create Verticals section**

```tsx
"use client";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

const VERTICALS = [
  { name: "Finance", accent: "#00d4ff", description: "SEC EDGAR filings, XBRL facts, regulatory overlays", tag: "SEC · XBRL · FINRA" },
  { name: "Pharma", accent: "#3fb950", description: "PubMed literature, clinical trials, drug interactions", tag: "PubMed · ClinicalTrials · MeSH" },
  { name: "Patents", accent: "#a371f7", description: "USPTO filings, citation graphs, inventor networks", tag: "USPTO · CPC · Citations" },
  { name: "Supply Chain", accent: "#c9a96e", description: "UN Comtrade flows, supplier networks, disruption signals", tag: "Comtrade · HS Codes · Logistics" },
  { name: "Sports Intelligence", accent: "#f85149", description: "Player tracking, tactical overlays, live match analytics", tag: "DUNC · FIFA · Tactical" },
  { name: "Data Governance", accent: "#d29922", description: "Lineage, classification, compliance, audit trails", tag: "SOC2 · GDPR · Lineage" },
];

export function Verticals() {
  return (
    <section id="verticals" className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
            Vertical modules
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white mb-6 max-w-4xl">
            Domain-tuned<br />
            <span className="text-white/40">out of the box.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl">
            Nine modules ship enabled. Add yours as a manifest. Customers mix, match, and extend without touching the engine.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
          className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {VERTICALS.map((v) => (
            <motion.div
              key={v.name}
              variants={fadeUp}
              className="group relative border border-white/10 rounded-2xl bg-[#0a0a10] p-8 hover:border-white/20 transition-colors overflow-hidden"
            >
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{ backgroundColor: v.accent, opacity: 0.6 }}
              />
              <div
                className="w-2 h-2 rounded-full mb-6"
                style={{ backgroundColor: v.accent, boxShadow: `0 0 12px ${v.accent}80` }}
              />
              <div className="font-display text-3xl text-white mb-3">{v.name}</div>
              <p className="text-sm text-white/60 leading-relaxed mb-6">{v.description}</p>
              <div className="font-mono text-[11px] text-white/30 tracking-wide">{v.tag}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
```

**Step 2: Don't commit yet.**

---

## Task 16: Enterprise — Cloud vs Edge

**Files:**
- Create: `frontend/components/landing/Enterprise.tsx`

**Step 1: Create Enterprise section**

```tsx
"use client";
import { motion } from "framer-motion";
import { fadeUp, viewportOnce } from "@/lib/motion";

const EDITIONS = [
  {
    name: "Cloud Edition",
    tagline: "Managed. Scale-out. Shared fleet.",
    features: [
      "Fully managed by Latent Ocean",
      "Per-customer isolated forks",
      "Docker SDK + Kubernetes orchestration",
      "Materializer writes to your database",
      "Stripe-metered billing",
      "SSO: SAML 2.0 + OIDC",
      "SOC 2 Type II (in progress)",
      "99.9% uptime SLA",
    ],
    accent: "#00d4ff",
  },
  {
    name: "Edge Edition",
    tagline: "Air-gapped. FIPS. Classification-aware.",
    features: [
      "Deploys inside your perimeter",
      "Zero external network calls",
      "Classification marking (UNCLASSIFIED → TOP SECRET)",
      "Hash-chained immutable audit log",
      "FIPS 140-2 compliant crypto",
      "Ed25519-signed offline updates",
      "Clearance-based module access",
      "Hardened container image",
    ],
    accent: "#a371f7",
  },
];

export function Enterprise() {
  return (
    <section id="enterprise" className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
            Enterprise
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white mb-6 max-w-4xl">
            Two editions.<br />
            <span className="text-white/40">One engine.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl">
            The same intelligence primitives, packaged for how your organization actually operates.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          transition={{ delay: 0.1 }}
          className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {EDITIONS.map((ed) => (
            <div
              key={ed.name}
              className="relative border border-white/10 rounded-2xl bg-[#0a0a10] p-10 overflow-hidden"
            >
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{ backgroundColor: ed.accent, opacity: 0.6 }}
              />
              <div
                className="w-2 h-2 rounded-full mb-6"
                style={{ backgroundColor: ed.accent, boxShadow: `0 0 16px ${ed.accent}80` }}
              />
              <div className="font-display text-4xl text-white mb-2">{ed.name}</div>
              <div className="text-sm text-white/60 mb-8">{ed.tagline}</div>
              <ul className="space-y-3">
                {ed.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-white/70">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-0.5 flex-shrink-0" style={{ color: ed.accent }}>
                      <path d="M3 7l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
```

**Step 2: Don't commit yet.**

---

## Task 17: Pricing — 3-tier comparison

**Files:**
- Create: `frontend/components/landing/Pricing.tsx`

**Step 1: Create Pricing section**

```tsx
"use client";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

const TIERS = [
  {
    name: "Starter",
    price: "2,500",
    period: "/mo",
    tagline: "For teams getting started.",
    features: [
      "1 data source",
      "Up to 3 modules enabled",
      "100K entities/month included",
      "50K queries/month included",
      "Fast profile only",
      "Dashboard + API",
    ],
    cta: "Start free trial",
    highlighted: false,
  },
  {
    name: "Professional",
    price: "15,000",
    period: "/mo",
    tagline: "For serious data estates.",
    features: [
      "5 data sources",
      "Up to 10 modules enabled",
      "1M entities/month included",
      "500K queries/month included",
      "Fast + Deep profiles",
      "CDC · Webhooks",
      "SSO included",
    ],
    cta: "Start 14-day trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "50,000",
    period: "/mo+",
    tagline: "For critical infrastructure.",
    features: [
      "Unlimited sources",
      "Unlimited modules",
      "10M+ entities/month",
      "5M+ queries/month",
      "All profiles + custom tuning",
      "SIEM · Vault · SSO",
      "Edge Edition available",
      "Dedicated support",
    ],
    cta: "Contact sales",
    highlighted: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp} className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
            Pricing
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white mb-6">
            Pay for depth.<br />
            <span className="text-white/40">Scale with your data.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Dashboard seats are always free. You only pay for intelligence, not for eyeballs.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
          className="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {TIERS.map((tier) => (
            <motion.div
              key={tier.name}
              variants={fadeUp}
              className={`relative rounded-2xl p-10 ${
                tier.highlighted
                  ? "bg-gradient-to-b from-[#0a0a10] to-[#0f0f18] border border-li-cyan/30 shadow-[0_0_40px_rgba(0,212,255,0.1)]"
                  : "bg-[#0a0a10] border border-white/10"
              }`}
            >
              {tier.highlighted && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 h-6 rounded-full bg-li-cyan text-black text-[11px] font-mono uppercase tracking-widest flex items-center">
                  Most popular
                </div>
              )}
              <div className="font-display text-2xl text-white mb-2">{tier.name}</div>
              <div className="text-sm text-white/60 mb-8">{tier.tagline}</div>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="font-mono text-sm text-white/60">$</span>
                <span className="font-mono text-5xl text-white tabular-nums">{tier.price}</span>
                <span className="font-mono text-sm text-white/60">{tier.period}</span>
              </div>
              <button
                className={`w-full h-12 rounded-full text-sm font-medium transition-colors ${
                  tier.highlighted
                    ? "bg-white text-black hover:bg-white/90"
                    : "bg-white/5 text-white hover:bg-white/10 border border-white/10"
                }`}
              >
                {tier.cta}
              </button>
              <ul className="mt-8 space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-white/70">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-0.5 flex-shrink-0 text-li-cyan">
                      <path d="M3 7l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
```

**Step 2: Don't commit yet.**

---

## Task 18: FinalCTA

**Files:**
- Create: `frontend/components/landing/FinalCTA.tsx`

**Step 1: Create FinalCTA**

```tsx
"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { fadeUp, viewportOnce } from "@/lib/motion";

export function FinalCTA() {
  return (
    <section className="relative py-32 border-t border-white/5 overflow-hidden">
      {/* Glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,212,255,0.15) 0%, transparent 70%)",
        }}
      />

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={fadeUp}
        className="relative max-w-[1000px] mx-auto px-6 text-center"
      >
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-6">
          Ready to see what matters?
        </p>
        <h2 className="font-display text-6xl md:text-8xl tracking-[-0.03em] text-white leading-[0.95] mb-8">
          Structural intelligence,<br />
          <span className="text-white/40">in one API call.</span>
        </h2>
        <p className="text-lg text-white/60 max-w-xl mx-auto mb-12">
          Connect your database. The engine does the rest. Intelligence appears in tables you already query.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/engine"
            className="inline-flex items-center justify-center gap-2 h-14 px-10 rounded-full bg-white text-black text-base font-medium hover:bg-white/90 transition-colors"
          >
            Launch Engine
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3.5 7h7m0 0L7 3.5m3.5 3.5L7 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </Link>
          <a
            href="mailto:sales@latentocean.com"
            className="inline-flex items-center justify-center h-14 px-8 rounded-full border border-white/20 text-white/90 text-base hover:bg-white/5 transition-colors"
          >
            Contact sales
          </a>
        </div>
      </motion.div>
    </section>
  );
}
```

**Step 2: Don't commit yet.**

---

## Task 19: Footer

**Files:**
- Create: `frontend/components/landing/Footer.tsx`

**Step 1: Create Footer**

```tsx
const FOOTER_COLS = [
  {
    title: "Product",
    links: [
      { label: "Engine", href: "/engine" },
      { label: "Pricing", href: "#pricing" },
      { label: "Verticals", href: "#verticals" },
      { label: "Enterprise", href: "#enterprise" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "SDK", href: "#" },
      { label: "CLI", href: "#" },
      { label: "API Reference", href: "#" },
      { label: "GitHub", href: "https://github.com/direncode/lsx-latentocean" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Security", href: "#" },
      { label: "Compliance", href: "#" },
      { label: "Contact", href: "mailto:hello@latentocean.com" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
      { label: "DPA", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-white/5 py-20">
      <div className="max-w-[1280px] mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-li-cyan shadow-[0_0_8px_rgba(0,212,255,0.6)]" />
              <span className="font-display text-base tracking-tight text-white/90">
                Latent Ocean
              </span>
            </div>
            <p className="text-sm text-white/50 max-w-xs leading-relaxed">
              Structural intelligence infrastructure for any database. The engine that finds what matters.
            </p>
            <div className="mt-6 font-mono text-[11px] text-white/30">
              v0.1.0 · Engine 0.1.0 · 11 connectors
            </div>
          </div>
          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <div className="font-mono text-[11px] uppercase tracking-widest text-white/40 mb-4">
                {col.title}
              </div>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="text-sm text-white/70 hover:text-white transition-colors">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="font-mono text-[11px] text-white/30">
            © 2026 Latent Ocean. All rights reserved.
          </div>
          <div className="font-mono text-[11px] text-white/30">
            Built with the engine.
          </div>
        </div>
      </div>
    </footer>
  );
}
```

**Step 2: Verify build passes now that all components exist**

Run: `cd frontend && npm run build 2>&1 | tail -15`
Expected: Build succeeds.

**Step 3: Commit all landing components**

```bash
git add frontend/components/landing/ frontend/lib/motion.ts frontend/app/page.tsx
git commit -m "feat: Apple-grade landing page with 12 cinematic sections"
```

---

## Task 20: Update LayoutShell to hide product chrome on landing

**Files:**
- Modify: `frontend/components/layout/LayoutShell.tsx`

**Step 1: Read the current shell**

Run: `cat frontend/components/layout/LayoutShell.tsx`
Expected: See conditional logic based on pathname.

**Step 2: Update so landing page (/) has no sidebar or product nav**

Modify the conditional: if `pathname === "/"`, render children with NO MinimalNav, NO Sidebar, NO Navbar. The landing Nav handles its own chrome. The `/engine` route still gets MinimalNav.

Key change: the landing page `/` should render children bare (no layout chrome at all).

**Step 3: Verify build**

Run: `cd frontend && npm run build 2>&1 | tail -5`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add frontend/components/layout/LayoutShell.tsx
git commit -m "feat: LayoutShell renders landing page without product chrome"
```

---

## Task 21: Local visual smoke test

**Files:** None modified.

**Step 1: Start dev server**

Run: `cd frontend && npm run dev` (in background)
Expected: Dev server starts at http://localhost:3000

**Step 2: Smoke test with curl**

Run: `curl -s http://localhost:3000/ | grep -oE '(Latent Ocean|Launch Engine|Structural intelligence|Reduction|500|EDGAR|Verticals|Pricing)' | sort -u`
Expected: All 8 strings appear (confirms all major sections render).

**Step 3: Check engine route still works**

Run: `curl -s http://localhost:3000/engine | grep -oE '(Connect any|Latent Ocean)' | head -3`
Expected: Both strings appear.

**Step 4: Stop dev server**

---

## Task 22: Commit, push, and deploy to EC2

**Files:** None modified.

**Step 1: Push to GitHub**

```bash
git push origin main
```
Expected: Push succeeds.

**Step 2: Bundle for EC2 (SSH key doesn't have GitHub access)**

Run: `git bundle create /tmp/landing-page.bundle 7bd491a..main`
Expected: Bundle created.

**Step 3: Transfer bundle**

```bash
scp -i C:/Users/diren/Downloads/latentocean-key.pem /tmp/landing-page.bundle ubuntu@32.192.140.145:/tmp/
```
Expected: Bundle transferred.

**Step 4: Apply on EC2**

```bash
ssh -i C:/Users/diren/Downloads/latentocean-key.pem ubuntu@32.192.140.145 \
  "cd /opt/latentocean && git fetch /tmp/landing-page.bundle main:main-update && git reset --hard main-update"
```
Expected: Server updated.

**Step 5: Rebuild frontend container**

```bash
ssh -i C:/Users/diren/Downloads/latentocean-key.pem ubuntu@32.192.140.145 \
  "cd /opt/latentocean && docker compose -f docker-compose.prod.yml build frontend --no-cache"
```
Expected: Build succeeds (may take 3-5 minutes).

**Step 6: Restart frontend**

```bash
ssh -i C:/Users/diren/Downloads/latentocean-key.pem ubuntu@32.192.140.145 \
  "cd /opt/latentocean && docker compose -f docker-compose.prod.yml up -d frontend && sleep 5 && curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://localhost/"
```
Expected: `HTTP 200`.

**Step 7: Verify landing page is live**

```bash
ssh -i C:/Users/diren/Downloads/latentocean-key.pem ubuntu@32.192.140.145 \
  "docker exec latentocean-nginx-1 wget -qO- http://frontend:3000/ | grep -oE 'Launch Engine|Structural intelligence|SEC EDGAR' | sort -u"
```
Expected: All 3 strings appear — confirms new landing page is served.

---

## Verification Checklist

After Task 22 completes:

- [ ] `latentocean.com` renders the new 12-section landing page
- [ ] Scroll-driven reduction animation works in hero
- [ ] Live Demo section shows real EDGAR survivors
- [ ] Clicking a survivor shows detail panel
- [ ] All section navigation anchors scroll correctly
- [ ] "Launch Engine" CTA navigates to /engine
- [ ] /engine still shows the existing product surface
- [ ] Pricing CTAs are present (though non-functional is fine for now)
- [ ] Footer renders with all 4 columns
- [ ] Mobile breakpoints work (test at 375px width)

---

## Out of Scope

- Pricing checkout flow (links are decorative)
- Contact form (mailto: is fine)
- Blog / docs routes (deferred)
- Trusted-by logos section (deferred until real customers)
