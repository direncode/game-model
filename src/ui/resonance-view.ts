/**
 * BigDunc Resonance View — HTML5 Canvas Renderer
 *
 * Thin overlay rendering: wave contours, entanglement lines, phase icons,
 * harmony gauge, and intent badges. No heavy deps — pure Canvas API.
 */

import {
  KernelOutput,
  KernelPlayer,
  Attractor,
  EntanglementPair,
  PlayerCoherence,
  PITCH_WIDTH,
  PITCH_HEIGHT,
} from '../lib/resonance-kernel';
import { AutonomousTwin } from '../lib/autonomous-twin';

const PHASE_COLORS: Record<string, string> = {
  defending: '#2563eb',
  pressing: '#dc2626',
  building: '#16a34a',
  attacking: '#ea580c',
  transitioning: '#9333ea',
};

export class ResonanceView {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scaleX: number;
  private scaleY: number;
  private padding = 40;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.scaleX = (canvas.width - this.padding * 2) / PITCH_WIDTH;
    this.scaleY = (canvas.height - this.padding * 2) / PITCH_HEIGHT;
  }

  /** Render a full frame: pitch, players, entanglements, attractors, gauge. */
  render(
    output: KernelOutput,
    players: KernelPlayer[],
    attractors: Attractor[],
    twins?: Map<string, AutonomousTwin>,
  ): void {
    this.clear();
    this.drawPitch();
    this.drawAttractors(attractors);
    this.drawWaveContours(players);
    this.drawEntanglements(output.entanglements, players);
    this.drawPlayers(players, output.players, twins);
    this.drawHarmonyGauge(output.harmony);
    this.drawTickInfo(output);
  }

  private clear(): void {
    this.ctx.fillStyle = '#0a1628';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private toScreen(x: number, y: number): { sx: number; sy: number } {
    return { sx: this.padding + x * this.scaleX, sy: this.padding + y * this.scaleY };
  }

  private drawPitch(): void {
    const ctx = this.ctx;
    const tl = this.toScreen(0, 0);
    const br = this.toScreen(PITCH_WIDTH, PITCH_HEIGHT);
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tl.sx, tl.sy, br.sx - tl.sx, br.sy - tl.sy);
    // Center line
    const mid = this.toScreen(PITCH_WIDTH / 2, 0);
    const midB = this.toScreen(PITCH_WIDTH / 2, PITCH_HEIGHT);
    ctx.beginPath(); ctx.moveTo(mid.sx, mid.sy); ctx.lineTo(midB.sx, midB.sy); ctx.stroke();
    // Center circle
    const center = this.toScreen(PITCH_WIDTH / 2, PITCH_HEIGHT / 2);
    ctx.beginPath(); ctx.arc(center.sx, center.sy, 9.15 * this.scaleX, 0, Math.PI * 2); ctx.stroke();
  }

  private drawAttractors(attractors: Attractor[]): void {
    const ctx = this.ctx;
    for (const attr of attractors) {
      const { sx, sy } = this.toScreen(attr.position.x, attr.position.y);
      const r = attr.radius * this.scaleX;
      const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      const color = attr.type === 'ball' ? '#fbbf24' : attr.type === 'defensive' ? '#3b82f6' : '#22c55e';
      gradient.addColorStop(0, color + '40');
      gradient.addColorStop(1, color + '00');
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
      // Icon
      ctx.fillStyle = color + '80';
      ctx.font = '10px monospace';
      ctx.fillText(attr.type[0].toUpperCase(), sx - 3, sy + 3);
    }
  }

  private drawWaveContours(players: KernelPlayer[]): void {
    const ctx = this.ctx;
    for (const p of players) {
      const { sx, sy } = this.toScreen(p.position.x, p.position.y);
      const waveR = p.wave.wavelength * this.scaleX;
      const alpha = (p.wave.amplitude * 0.3).toFixed(2);
      const color = PHASE_COLORS[p.state] || '#888';
      ctx.strokeStyle = color + '60';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(sx, sy, waveR, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      // Density fill |ψ|²
      const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, waveR * 0.5);
      gradient.addColorStop(0, color + '30');
      gradient.addColorStop(1, color + '00');
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.arc(sx, sy, waveR * 0.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  private drawEntanglements(entanglements: EntanglementPair[], players: KernelPlayer[]): void {
    const ctx = this.ctx;
    const playerMap = new Map(players.map(p => [p.id, p]));
    for (const ent of entanglements) {
      const a = playerMap.get(ent.playerA);
      const b = playerMap.get(ent.playerB);
      if (!a || !b) continue;
      const sa = this.toScreen(a.position.x, a.position.y);
      const sb = this.toScreen(b.position.x, b.position.y);
      const alpha = Math.floor(ent.correlation * 200);
      ctx.strokeStyle = `rgba(168, 85, 247, ${alpha / 255})`;
      ctx.lineWidth = ent.correlation * 2.5;
      ctx.beginPath(); ctx.moveTo(sa.sx, sa.sy); ctx.lineTo(sb.sx, sb.sy); ctx.stroke();
    }
  }

  private drawPlayers(
    players: KernelPlayer[],
    coherence: Record<string, PlayerCoherence>,
    twins?: Map<string, AutonomousTwin>,
  ): void {
    const ctx = this.ctx;
    for (const p of players) {
      const { sx, sy } = this.toScreen(p.position.x, p.position.y);
      const color = PHASE_COLORS[p.state] || '#888';
      const coh = coherence[p.id];
      // Player dot
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // ID label
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(p.id, sx - 8, sy - 10);
      // Coherence bar
      if (coh) {
        const barW = 20;
        const barH = 3;
        ctx.fillStyle = '#334155';
        ctx.fillRect(sx - barW / 2, sy + 9, barW, barH);
        ctx.fillStyle = coh.coherenceScore > 0.6 ? '#22c55e' : coh.coherenceScore > 0.35 ? '#eab308' : '#ef4444';
        ctx.fillRect(sx - barW / 2, sy + 9, barW * coh.coherenceScore, barH);
      }
      // Intent badge
      if (twins) {
        const twin = twins.get(p.id);
        if (twin) {
          ctx.fillStyle = '#94a3b8';
          ctx.font = '7px monospace';
          ctx.fillText(`${twin.getCurrentIntent()} ${(twin.getConfidence() * 100).toFixed(0)}%`, sx + 10, sy + 4);
        }
      }
    }
  }

  private drawHarmonyGauge(harmony: number): void {
    const ctx = this.ctx;
    const gx = this.canvas.width - 130;
    const gy = 15;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(gx, gy, 120, 28);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(gx, gy, 120, 28);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('HARMONY', gx + 6, gy + 13);
    const barX = gx + 6;
    const barY = gy + 18;
    const barW = 108;
    const barH = 6;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(barX, barY, barW, barH);
    const color = harmony > 0.7 ? '#22c55e' : harmony > 0.4 ? '#eab308' : '#ef4444';
    ctx.fillStyle = color;
    ctx.fillRect(barX, barY, barW * harmony, barH);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '9px monospace';
    ctx.fillText(`${(harmony * 100).toFixed(1)}%`, gx + 75, gy + 13);
  }

  private drawTickInfo(output: KernelOutput): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#64748b';
    ctx.font = '9px monospace';
    ctx.fillText(`tick: ${output.tick}  energy: ${output.fieldEnergy.toFixed(2)}  entangled: ${output.entanglements.length}`, this.padding, this.canvas.height - 10);
    if (output.drifts.length > 0) {
      ctx.fillStyle = '#ef4444';
      ctx.fillText(`⚠ ${output.drifts[0].description}`, this.padding, this.canvas.height - 22);
    }
  }
}
