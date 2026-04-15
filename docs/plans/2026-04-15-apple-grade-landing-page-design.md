# Apple-Grade Landing Page Redesign

## Date: 2026-04-15

## Context

Current state: 201-line functional minimalist interface at latentocean.com. Works as a product surface but is NOT spectacular — it looks like a toolkit, not a product launch. The platform has Oracle-grade depth under the hood (engine extracted, 11 universal connectors, edge security, 326 tests) but the surface doesn't communicate this.

Goal: Transform latentocean.com into an Apple-product-page experience — cinematic, narrative, scroll-driven — with a genuine product surface accessible via prominent CTA. Think apple.com/iphone-17 or apple.com/vision-pro meets xAI Grok.

## Design Decisions (approved)

1. **Page type**: Marketing page + embedded product (Apple-style)
2. **Sample data**: Pre-computed real SEC EDGAR reduction (500+ real Fortune 500 companies)
3. **Hero visual**: Scroll-driven reduction animation (particles merging into survivors)
4. **Structure**: 12 cinematic sections (nav, hero, reduction, live demo, architecture, connect, materialized, verticals, enterprise, pricing, final CTA, footer)
5. **Product surface**: Preserved at /engine route, accessed via "Launch Engine" CTAs

## Section 1: Page Architecture

Full 12-section structure:

1. **Nav (56px sticky)** — Latent Ocean wordmark + product nav + Launch Engine CTA
2. **Hero (100vh)** — Scroll-driven reduction animation, massive display type, "Structural intelligence infrastructure"
3. **Reduction Cinematic (200vh pinned)** — Numbers transform as particles reduce: 100,482 → 347 → 8 clusters → 2.1 seconds
4. **Live Demo (100vh)** — Real SEC EDGAR reduction. 500+ real Fortune 500 companies. Interactive. Click entities for real anomaly narratives.
5. **Architecture (80vh)** — 5 primitives: Reduce Represent Discover Monitor Query. Technical depth.
6. **Universal Connect (80vh)** — All 11 connectors visualized: Postgres, MySQL, MongoDB, Snowflake, S3, CSV, JSON, Parquet, Excel, API, Kafka
7. **Materialized (80vh)** — "Intelligence lives in your database." Code snippet: `SELECT * FROM lo_survivors`. 7 lo_* tables shown.
8. **Verticals (80vh)** — Finance, Pharma, Patents, Supply Chain, Sports Intelligence, Data Governance
9. **Enterprise (80vh)** — Cloud vs Edge edition. SOC2, FIPS, classification marking, audit chains
10. **Pricing (100vh)** — Starter $2.5K · Professional $15K · Enterprise $50K
11. **Final CTA (80vh)** — "Structural intelligence in one API call" + CTAs
12. **Footer** — Comprehensive links

## Section 2: Sample Data Strategy

**Pre-compute real EDGAR reduction at build time:**

1. Script: `backend/scripts/generate_sample_data.py`
   - Uses existing EDGAR adapter from `backend/app/services/btut/adapters/edgar.py`
   - Fetches 500 real Fortune 500 companies (CIK, ticker, SIC code, filings)
   - XBRL financial facts (revenue, assets, employees)
   - Industry sector graph relationships
   - Runs LatentOceanEngine reduction
   - Outputs to `frontend/data/edgar-sample.json`

2. Output structure (~3MB JSON):
   ```json
   {
     "metadata": {
       "source": "SEC EDGAR",
       "generated_at": "2026-04-15T...",
       "n_input": 500,
       "n_survivors": 150,
       "n_clusters": 12,
       "wall_seconds": 2.1
     },
     "survivors": [...],    // Real companies with scores
     "connections": [...],  // Same-sector relationships
     "anomalies": [...],    // Real anomaly narratives
     "clusters": [...]      // Cluster memberships
   }
   ```

3. Frontend loads this at build time (Next.js static data) — instant render, no backend required for demo.

## Section 3: Visual Design Language

**Typography**
- Display: Instrument Serif (already configured) — editorial, confident
- Sans: Inter for all body
- Mono: JetBrains Mono for code, numbers, data
- Sizes: 128px+ hero, 72px section headers, 20px body

**Color Palette**
- Page background: `#000000` pure black (full Apple black)
- Surface panels: `#0a0a10` with subtle gradient overlays
- Border: `#1a1a24` (almost invisible)
- Primary accent: `#00d4ff` cyan
- Success: `#3fb950` green
- Premium: `#a371f7` purple
- Text: `#ffffff`, `#ffffff/70`, `#ffffff/40`, `#ffffff/20`

**Motion Principles**
- `framer-motion` for scroll-driven animations
- Canvas-based particle system for reduction animation
- Fade-in on viewport entry (intersection observer)
- Subtle parallax on hero
- Cursor-follow glow on interactive elements
- Only: fade, slide, scale. No bouncing, no rotating.

**Spacing**
- Section padding: 120px vertical (80px mobile)
- Content max-width: 1280px
- Generous whitespace between elements

## Section 4: Technical Approach

**New files:**
- `frontend/app/page.tsx` — REWRITE as marketing page (currently product surface)
- `frontend/app/engine/page.tsx` — NEW, move current product surface here
- `frontend/components/landing/Nav.tsx` — sticky navigation
- `frontend/components/landing/Hero.tsx` — hero section with reduction canvas
- `frontend/components/landing/ReductionCinematic.tsx` — pinned scroll section
- `frontend/components/landing/LiveDemo.tsx` — interactive EDGAR demo
- `frontend/components/landing/Architecture.tsx` — 5 primitives explainer
- `frontend/components/landing/UniversalConnect.tsx` — 11 connectors showcase
- `frontend/components/landing/Materialized.tsx` — lo_* tables with code
- `frontend/components/landing/Verticals.tsx` — vertical modules grid
- `frontend/components/landing/Enterprise.tsx` — Cloud vs Edge comparison
- `frontend/components/landing/Pricing.tsx` — 3-tier pricing table
- `frontend/components/landing/FinalCTA.tsx` — closing conversion section
- `frontend/components/landing/Footer.tsx` — footer links
- `frontend/components/landing/canvas/ReductionCanvas.tsx` — canvas particle system
- `frontend/data/edgar-sample.json` — pre-computed reduction (gitignored, generated)
- `frontend/lib/motion.ts` — shared framer-motion variants
- `backend/scripts/generate_sample_data.py` — EDGAR data generator

**Files to modify:**
- `frontend/components/layout/LayoutShell.tsx` — detect `/engine` route and show product UI there
- `frontend/components/layout/MinimalNav.tsx` — only show on product routes

**Dependencies to add:**
- `framer-motion` — scroll animations
- `react-intersection-observer` — viewport triggers
- (already have) `@react-three/fiber`, `@react-three/drei`

## Section 5: Error Handling & Performance

**Performance targets:**
- Hero LCP < 2.5s
- Total page weight < 1.5MB initial (with EDGAR data lazy-loaded)
- Lighthouse score > 95

**Loading strategy:**
- Hero and nav render immediately
- Canvas animation lazy-loads (client-only)
- EDGAR sample JSON loads on-demand when Live Demo section enters viewport
- Sections below fold use React Suspense with skeleton fallbacks

**Error boundaries:**
- Canvas component wrapped in error boundary — falls back to static image if WebGL unavailable
- EDGAR data fetch has 3s timeout — falls back to stub data
- All external images have alt text and error fallbacks

## Section 6: Testing Strategy

**Visual regression:**
- Build passes with zero errors (Next.js production build)
- Homepage renders on initial load (smoke test)
- All 12 sections visible via scroll (manual QA)

**Functional:**
- Nav CTAs navigate correctly
- "Launch Engine" → /engine route
- Pricing CTAs → contact or checkout flow
- Live Demo loads EDGAR data and renders survivors

**Accessibility:**
- Keyboard navigation through all CTAs
- Screen reader labels on interactive elements
- Color contrast WCAG AA

## Section 7: Deployment

After build + test locally:
1. Commit to main
2. Push to GitHub
3. Git bundle to EC2 (SSH key doesn't have GitHub access)
4. `docker compose build frontend --no-cache`
5. `docker compose up -d frontend`
6. Verify at latentocean.com

## Out of Scope (explicit)

- Blog / research section (deferred)
- Trusted-by logos section (deferred — no real logos yet)
- i18n / multi-language (deferred)
- Light mode (dark only for launch)
- Video backgrounds (using canvas animations instead)
