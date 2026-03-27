# Engine Simulation + Methodology Walkthrough Design

## Context

The landing page has a "The Engine" section describing TCD-JEPA and a "Methodology" section with 6 numbered cards. Both need to become interactive: the Engine gets a real-time simulation visualization, and the Methodology becomes a step-by-step walkthrough showing actual results from three datasets (Semiconductor, GDELT, SEC EDGAR).

## Feature 1: Engine Simulation

### Component: `<EngineSimulation />`

**Location:** Below "The Engine" heading on the landing page.

**Layout:** Pipeline timeline on top, D3 force-directed canvas below, metric bar at bottom.

```
┌─────────────────────────────────────────────────────────────┐
│  ▶ Play                                      Speed: 1x 2x  │
├─────────────────────────────────────────────────────────────┤
│  [01 Encode]──[02 Explore]──[03 Crystallize]──[Converged]   │
│      ●            ○              ○               ○          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│              D3 Force-Directed Canvas                       │
│     ~50 nodes: scatter → cluster → crystallize              │
│     Color by module assignment as they form                 │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Modules: 4/16  │  Purity: 94%  │  Link AUC: 82.7%  │ ⏱   │
└─────────────────────────────────────────────────────────────┘
```

### Simulation Stages

1. **Idle** — Nodes displayed in gray, scattered randomly. Play button visible.
2. **System 1: Encode** (~3s) — Nodes pulse, edges appear, positions shift toward initial clusters.
3. **System 2: Explore** (~5s) — Nodes drift along energy landscape trajectories (Langevin-inspired wobble). Edges strengthen/weaken.
4. **System 3: Crystallize** (~5s) — Nodes snap into distinct color-coded module clusters. Module boundaries become visible.
5. **Converged** — Final state. Modules labeled. Metrics show final values: Link AUC 82.7%, 16 modules, 100% purity.

### Demo Data (Semiconductor — Georgetown CSET)

Pre-baked ~50 node subset with:
- Pre-computed positions for each stage (random, encoded, exploring, crystallized)
- Edge list with weights
- Module assignments (subset of the 16 real modules)
- Simulated metric trajectory (loss, AUC, module count over time)

### Tech

- D3.js force simulation (reuse patterns from `ModuleGraph.tsx`)
- `requestAnimationFrame` for smooth interpolation between stage positions
- CSS transitions for pipeline step indicators
- React state machine: idle → encoding → exploring → crystallizing → converged

### Landing vs App

- **Landing page:** Self-contained pre-baked animation, no backend
- **App (future):** Same component accepts WebSocket events via `ws.subscribeToCrystallization()` to drive real data

---

## Feature 2: Methodology Interactive Walkthrough

### Component: `<MethodologyWalkthrough />`

**Location:** Replaces the 6-card methodology grid on the landing page.

**Layout:** Vertical step list on the left, detail panel with visualization on the right.

```
┌──────────┬──────────────────────────────────────────────────┐
│ 01 Data  │  Data Awakening                                  │
│ Awakening│                                                  │
│          │  Ingest entity-relationship data from any source. │
│ 02 Cryst.│  Auto-detect types, validate, and profile.       │
│          │                                                  │
│ 03 Interp│  ┌─────────────────────────────────────┐         │
│          │  │  [Type Distribution Bar Chart]       │         │
│ 04 Cont. │  │  Person: 142  Organization: 218     │         │
│          │  │  Location: 89  Product: 45  ...      │         │
│ 05 Gov.  │  └─────────────────────────────────────┘         │
│          │                                                  │
│ 06 Intel │  Dataset: ETO Semiconductor (519 entities)       │
│          │  Types detected: 5  │  Edges: 2,847             │
│  ▲active │  Density: 0.021                                  │
└──────────┴──────────────────────────────────────────────────┘
```

### Per-Stage Content

| # | Stage | Visualization | Data Shown |
|---|-------|--------------|------------|
| 01 | Data Awakening | Type distribution bar/pie chart | 519 entities, 5 types, 2,847 edges, density 0.021 |
| 02 | Crystallization | Mini engine simulation or module formation animation | 16 modules discovered, Link AUC 82.7% vs baseline 46.1% |
| 03 | Interpretation | Purity chart + module table | 15/15 GOV = 100% purity, module names (CMP pipeline, Netherlands hub, etc.) |
| 04 | Contestation | Challenge UI mockup with before/after | Example: School-crime nexus (8 EDU + 7 CRM) challenged → refined |
| 05 | Governance | Lineage mini-graph | W3C PROV trace: Source CSV → Ingestion → Crystallization → Module output |
| 06 | Intelligence Delivery | Results comparison table + hidden connections | TCD vs baselines table, hidden connections list |

### Results Data (Real — from provided tables)

**Table 1 — TCD vs Baseline:**
| Dataset | Entities | TCD Link AUC | Baseline | Improvement |
|---------|----------|-------------|----------|-------------|
| ETO Semiconductor | 519 | 82.7% | 46.1% | +36.6% |
| GDELT Events | 380 | 69.1% | 47.0% | +22.1% |
| SEC EDGAR 10-K | 9,725 | 66.4% | 46.4% | +20.0% |

**Table 2 — TCD vs Supervised GNNs:**
| Method | Training | Semi | GDELT | SEC |
|--------|----------|------|-------|-----|
| GCN | Supervised | 63.9% | 85.2% | 90.8% |
| GAT | Supervised | 70.3% | 92.1% | OOM |
| TCD-JEPA | Self-supervised | 82.7% | 69.1% | 66.4% |

**Interpretable Modules (Semiconductor):**
- CMP pipeline (materials ↔ etching ↔ deposition)
- Netherlands equipment hub (NLD ↔ die attach ↔ wet etch)
- Singapore ATP network (SGP ↔ assembly tools)
- Design-to-fab chain (AMD, Intel ↔ inspection)
- China packaging entry (Shenzhen Axxon ↔ die attach)

**Hidden Connections:**
- Lithography tools ↔ CMP materials
- AI ASICs ↔ Hitachi
- EUV lithography ↔ Etch and clean
- Netherlands ↔ Applied Materials

### Tech

- React state for active step index
- Reuse existing chart components where possible (`TypeDistribution`, `PurityChart`)
- Pre-baked data objects for each stage
- CSS transition on panel swap (fade + slide)
- Responsive: stacks vertically on mobile (steps become horizontal tabs)

---

## Files to Create

1. `frontend/components/landing/EngineSimulation.tsx` — Main simulation component
2. `frontend/components/landing/SimulationCanvas.tsx` — D3 force-directed canvas
3. `frontend/components/landing/PipelineTimeline.tsx` — Stage progress indicator
4. `frontend/components/landing/MetricBar.tsx` — Bottom metrics display
5. `frontend/components/landing/MethodologyWalkthrough.tsx` — Interactive walkthrough
6. `frontend/components/landing/StageDetail.tsx` — Right panel for each stage
7. `frontend/lib/demo-data.ts` — Pre-baked demo datasets and simulation keyframes

## Files to Modify

1. `frontend/app/page.tsx` — Replace Engine section and Methodology section with new components

## Verification

1. Preview landing page, press Play on simulation
2. Watch nodes animate through all 4 stages
3. Verify metrics update during simulation
4. Click each methodology step (01-06)
5. Verify each step shows correct visualization and real data
6. Test mobile responsive layout
