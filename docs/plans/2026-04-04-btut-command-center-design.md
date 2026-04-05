# BTUT Intelligence Command Center — Design

**Date**: 2026-04-04
**Goal**: Bloomberg-terminal-density intelligence dashboard. Every pixel shows data. Zero tabs — everything visible at once.

## Layout

6-panel grid: status bar (top), entity table + gauges/scatter (middle), dossier + cluster matrix (bottom). Left 60%, right 40%.

## Panels

1. **Status Bar**: Monospace cyan-on-black strip with 8 pipeline metrics, staggered animation
2. **Entity Table**: 298 rows, 12 columns (role, ticker, name, type, 4 score bars, flips, cluster, confidence, fingerprint), sortable/filterable
3. **Signal Gauges**: 4 SVG radial arcs for aggregate scores + Recharts scatter plot (anomaly x reconstruction)
4. **Entity Dossier**: Full 10-section metadata panel on row click
5. **Cluster Matrix**: Heatmap grid, sized by count, colored by composite, click to filter

## Implementation

Single file rewrite: `frontend/app/btut/page.tsx`. Same API, new layout. Uses Recharts ScatterChart, SVG gauges, Tailwind grid.
