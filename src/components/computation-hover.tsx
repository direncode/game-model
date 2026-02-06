'use client';

import { useState, useRef, type ReactNode } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface ComputationStep {
  label: string;
  formula?: string;
  value?: string;
  detail?: string;
}

export interface ComputationSection {
  title: string;
  color: string;
  steps: ComputationStep[];
  conceptNote?: string;
}

interface HoverCardProps {
  children: ReactNode;
  title: string;
  sections: ComputationSection[];
  liveValue?: string;
  className?: string;
  anchor?: 'top' | 'bottom' | 'left' | 'right';
  width?: number;
}

// ============================================================================
// HOVER CARD — Palantir Blueprint-Inspired Panel
// ============================================================================

export function HoverCard({
  children,
  title,
  sections,
  liveValue,
  className = '',
  anchor = 'bottom',
  width = 360,
}: HoverCardProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));
  const timer = useRef<NodeJS.Timeout | null>(null);

  const enter = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 150);
  };
  const leave = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 220);
  };
  const toggle = (idx: number) => {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(idx) ? n.delete(idx) : n.add(idx);
      return n;
    });
  };

  const anchorPos: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-0 mr-2',
    right: 'left-full top-0 ml-2',
  };

  return (
    <span
      className={`relative inline-block ${className}`}
      onMouseEnter={enter}
      onMouseLeave={leave}
    >
      <span className="cursor-help border-b border-dotted border-[#404854] hover:border-[#4C90F0] transition-colors">{children}</span>

      {open && (
        <div
          className={`absolute ${anchorPos[anchor]} z-[200] animate-fadeIn`}
          style={{ width }}
          onMouseEnter={() => { if (timer.current) clearTimeout(timer.current); }}
          onMouseLeave={leave}
        >
          <div
            className="rounded-md overflow-hidden"
            style={{
              background: '#1C2127',
              border: '1px solid #2F343C',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 1px rgba(255,255,255,0.05)',
            }}
          >
            {/* Header bar */}
            <div
              className="px-4 py-2.5 flex items-start justify-between gap-3"
              style={{ borderBottom: '1px solid #2F343C', background: '#252A31' }}
            >
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-[#F6F7F9] tracking-wide leading-tight">{title}</div>
                {liveValue && (
                  <div className="text-[11px] font-mono mt-1 text-[#4C90F0]">{liveValue}</div>
                )}
              </div>
              <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#4C90F0] mt-1.5 opacity-70" />
            </div>

            {/* Sections */}
            <div className="max-h-[340px] overflow-y-auto">
              {sections.map((sec, si) => (
                <div key={si} style={{ borderBottom: si < sections.length - 1 ? '1px solid #252A31' : 'none' }}>
                  <button
                    onClick={() => toggle(si)}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors hover:bg-[#252A31]"
                  >
                    <svg
                      width="8" height="8" viewBox="0 0 8 8"
                      className={`transition-transform flex-shrink-0 ${expanded.has(si) ? 'rotate-90' : ''}`}
                      fill="currentColor"
                      style={{ color: '#5F6B7C' }}
                    >
                      <path d="M2 1l4 3-4 3V1z" />
                    </svg>
                    <span className={`text-[11px] font-medium ${sec.color}`}>{sec.title}</span>
                  </button>

                  {expanded.has(si) && (
                    <div className="px-4 pb-3 space-y-2">
                      {sec.steps.map((step, stIdx) => (
                        <div key={stIdx} className="ml-4">
                          {step.formula && (
                            <div
                              className="text-[10px] font-mono px-2.5 py-1 rounded mb-1 leading-relaxed break-all"
                              style={{ color: '#8ABBFF', background: 'rgba(45,114,210,0.08)', border: '1px solid rgba(45,114,210,0.12)' }}
                            >
                              {step.formula}
                            </div>
                          )}
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-[10px] leading-snug" style={{ color: '#8F99A8' }}>{step.label}</span>
                            {step.value && (
                              <span className="text-[11px] font-mono tabular-nums flex-shrink-0" style={{ color: '#D3D8DE' }}>{step.value}</span>
                            )}
                          </div>
                          {step.detail && (
                            <div className="text-[9px] leading-relaxed mt-0.5" style={{ color: '#5F6B7C' }}>{step.detail}</div>
                          )}
                        </div>
                      ))}
                      {sec.conceptNote && (
                        <div
                          className="ml-4 mt-2 px-3 py-2 rounded"
                          style={{ background: 'rgba(124,58,237,0.06)', borderLeft: '2px solid rgba(124,58,237,0.3)' }}
                        >
                          <div className="text-[9px] leading-relaxed" style={{ color: 'rgba(167,139,250,0.7)' }}>{sec.conceptNote}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </span>
  );
}

// ============================================================================
// NODE EXPLANATION DATABASE — Full computation logs for every diagram node
// ============================================================================

export function getNodeExplanation(
  nodeId: string,
  liveOutput?: {
    harmony?: number;
    fieldEnergy?: number;
    entanglementCount?: number;
    driftCount?: number;
    tick?: number;
    avgCoherence?: number;
    mcResult?: { avgHarmony: number; worstCase: number; bestCase: number } | null;
    twinIntents?: Record<string, { intent: string; confidence: number }>;
    playerData?: Record<string, { density: number; deviation: number; phaseAlignment: number; coherenceScore: number }>;
  }
): { title: string; sections: ComputationSection[]; liveValue?: string } {
  const explanations: Record<string, () => { title: string; sections: ComputationSection[]; liveValue?: string }> = {

    catapult: () => ({
      title: 'Catapult GPS/IMU Data Source',
      sections: [
        {
          title: 'What It Measures',
          color: 'text-[#4C90F0]',
          steps: [
            { label: 'GPS sampling', value: '10 Hz', detail: '10 position fixes per second via satellite triangulation' },
            { label: 'IMU sampling', value: '100 Hz', detail: 'Accelerometer + gyroscope + magnetometer at 100 readings/sec' },
            { label: 'Heart rate', value: 'Polar/Garmin', detail: 'Chest strap integration via Catapult OpenField API' },
            { label: 'Player load', value: 'AU (arb. units)', detail: 'Proprietary composite of tri-axial accelerometer data' },
          ],
          conceptNote: 'Catapult Vector devices worn between the shoulder blades capture every movement. The raw data stream includes position (x,y), speed, acceleration, and cumulative workload metrics.',
        },
        {
          title: 'Data Pipeline',
          color: 'text-[#8ABBFF]',
          steps: [
            { label: 'Step 1', value: 'Capture', detail: 'Raw GPS + IMU signals from on-body device' },
            { label: 'Step 2', value: 'Transmit', detail: 'Wireless relay to sideline antenna at 10Hz' },
            { label: 'Step 3', value: 'Normalize', detail: 'DataSubstrate.ingestFrame() maps to kernel format' },
            { label: 'Step 4', value: 'Inject', detail: 'Kernel receives {id, x, y, velocity, load, state}' },
          ],
        },
      ],
    }),

    synthetic: () => ({
      title: 'Synthetic Data Generator',
      sections: [{
        title: 'Purpose & Method',
        color: 'text-[#4C90F0]',
        steps: [
          { label: 'Function', value: 'getSampleFrame()', detail: 'Generates 11 players with realistic positional and load data' },
          { label: 'Player positions', value: '4-3-3 formation', detail: 'Hardcoded starting XI with GK, 4 defenders, 3 midfielders, 3 forwards' },
          { label: 'State inference', formula: 'if speed > 6 → attacking; > 4 → pressing; > 2.5 → building; acc > 1.5 → transitioning; else defending', detail: 'Movement speed determines tactical phase classification' },
          { label: 'Load normalization', formula: 'normalizedLoad = clamp((rawLoad / 800) * 100, 0, 100)', detail: '800 AU is typical match maximum; normalize to 0-100 scale' },
        ],
        conceptNote: 'Used when no live Catapult feed is available. The synthetic generator produces realistic player frames so the kernel can run in demo/development mode.',
      }],
    }),

    substrate: () => ({
      title: 'DataSubstrate — Normalization Layer',
      sections: [
        {
          title: 'Ingestion Pipeline',
          color: 'text-[#A78BFA]',
          steps: [
            { label: 'Input format', value: 'RawPlayerFrame[]', detail: '{playerId, x, y, speed, acceleration, heartRate, distance, hsr, sprint, load}' },
            { label: 'Load normalization', formula: 'load_norm = clamp((raw_load / 800) * 100, 0, 100)', detail: 'Maps arbitrary load units to 0-100 scale against 800 AU match ceiling' },
            { label: 'State inference', formula: 'speed > 6 → attacking | > 4 → pressing | > 2.5 → building | acc > 1.5 → transitioning | else defending', detail: 'Converts continuous speed into discrete tactical phase' },
            { label: 'Velocity vector', formula: 'angle = atan2(acc, speed); vx = speed * cos(angle); vy = speed * sin(angle)', detail: 'Reconstructs 2D velocity from speed magnitude and acceleration direction' },
          ],
          conceptNote: 'The substrate acts as an adapter pattern: it accepts any data format (CSV, JSON, Catapult API) and outputs a uniform NormalizedFrame that the kernel understands.',
        },
        {
          title: 'Output Format',
          color: 'text-[#C4B5FD]',
          steps: [
            { label: 'NormalizedPlayerData', value: '{id, x, y, velocity, load, state}' },
            { label: 'Ball position', value: '{x, y} optional' },
            { label: 'Timestamp', value: 'Date.now() ms' },
          ],
        },
      ],
    }),

    kernel: () => ({
      title: 'ResonanceKernel — Main Tick Loop',
      liveValue: liveOutput?.tick !== undefined ? `tick ${liveOutput.tick}` : undefined,
      sections: [
        {
          title: 'Tick Pipeline (executed every frame)',
          color: 'text-[#EC9A3C]',
          steps: [
            { label: 'Step 1', value: 'applyAttractorForces()', detail: 'Pull players toward tactical targets (ball, shape, space)' },
            { label: 'Step 2', value: 'applyCoulombForces()', detail: 'Push/pull players apart using charge-based spacing' },
            { label: 'Step 3', value: 'evolveWaves()', detail: 'Update wave function (amplitude, phase, frequency, wavelength)' },
            { label: 'Step 4', value: 'updatePositions()', detail: 'Integrate velocity → position, apply boundary clamp and drag' },
          ],
          conceptNote: 'Each tick is a discrete time step. The kernel treats 11 players as coupled wave packets on a continuous field. The four-step pipeline runs sequentially to maintain physical consistency.',
        },
        {
          title: 'Output Computation',
          color: 'text-[#FBB360]',
          steps: [
            { label: 'Field Harmony', value: 'cos(Δφ) avg + entropy', detail: 'Global team synchronization measure' },
            { label: 'Player Coherence', value: 'per-player |ψ|² + phase', detail: 'Individual alignment with field' },
            { label: 'Entanglement Map', value: 'RBF × cos(Δφ) pairs', detail: 'Phase-spatial correlations between players' },
            { label: 'Drift Detection', value: 'trend + zone analysis', detail: 'Predictive collapse warnings' },
            { label: 'Field Energy', value: 'KE + wave²', detail: 'Total system energy' },
          ],
        },
      ],
    }),

    attractors: () => ({
      title: '① Attractor Forces',
      sections: [
        {
          title: 'Force Computation',
          color: 'text-[#EC9A3C]',
          steps: [
            { label: 'Attractor force', formula: 'F = strength × e^(-distance × decay) × direction', detail: 'Exponential decay: force is strongest near the attractor and fades with distance' },
            { label: 'Direction', formula: 'dir = normalize(attractor_pos - player_pos)', detail: 'Unit vector pointing from player toward the attractor' },
            { label: 'State multiplier', value: '1.0–1.5x', detail: 'Attacking/pressing players feel 1.5x pull toward ball; defenders feel 1.3x toward defensive attractors' },
            { label: 'Velocity update', formula: 'v += F × DRIFT_RATE(0.1) × Δt', detail: 'Force is accumulated into velocity, not applied directly to position' },
          ],
          conceptNote: 'Attractors are invisible "gravity wells" placed on the pitch. They represent tactical intentions: the ball, the defensive shape, offensive zones, and open spaces. Players are drawn toward them like particles in a potential field.',
        },
        {
          title: 'Attractor Types',
          color: 'text-[#FBB360]',
          steps: [
            { label: 'ball', value: 'r=15, s=0.8', detail: 'Strongest pull — where the play happens' },
            { label: 'tactical', value: 'r=25, s=0.6', detail: 'Formation shape — keeps structure' },
            { label: 'defensive', value: 'r=20, s=0.5', detail: 'Pulls defenders into position' },
            { label: 'offensive', value: 'r=18, s=0.4', detail: 'Forward movement incentive' },
            { label: 'space', value: 'r=12, s=0.3', detail: 'Encourages width and stretching' },
          ],
        },
      ],
    }),

    coulomb: () => ({
      title: '② Coulomb Spacing Forces',
      sections: [{
        title: 'Electrostatic Analogy',
        color: 'text-[#EC9A3C]',
        steps: [
          { label: 'Coulomb\'s Law', formula: 'F = k × q₁ × q₂ / d²', detail: 'Same as electrostatic force between charged particles' },
          { label: 'Constant k', value: '0.5', detail: 'Scaled Coulomb constant for pitch dimensions' },
          { label: 'Charges', formula: 'q = chargeFromState(phase)', detail: 'defending=-0.8, pressing=-0.4, building=0, attacking=+0.6, transitioning=+0.2' },
          { label: 'Like charges', value: 'Repel', detail: 'Two defenders (both negative) push apart → proper defensive spacing' },
          { label: 'Unlike charges', value: 'Attract', detail: 'Attacker (+0.6) and defender (-0.8) attract → marking/pressing dynamics' },
          { label: 'Distance safety', value: 'd > 1m', detail: 'Below 1 meter, force is capped to prevent numerical explosion' },
        ],
        conceptNote: 'By assigning "tactical charges" to players based on their phase, the engine automatically creates proper spacing. Defenders spread out like same-sign electrons. Attackers and defenders attract like opposite charges — modeling pressing and marking without explicit rules.',
      }],
    }),

    fokker: () => ({
      title: '③ Wave Evolution (Fokker-Planck)',
      sections: [{
        title: 'Wave Function Update',
        color: 'text-[#EC9A3C]',
        steps: [
          { label: 'Amplitude decay', formula: 'A *= (1 - DIFFUSION_RATE × Δt × 0.1)', detail: 'Amplitude (energy) slowly decays — models fatigue. DIFFUSION_RATE = 0.02' },
          { label: 'Amplitude clamp', formula: 'A = clamp(A, 0.05, 1.0)', detail: 'Never reaches zero (player is always "alive") or exceeds 1' },
          { label: 'Phase drift', formula: 'φ += sin(φ_avg - φ) × DRIFT_RATE × Δt', detail: 'Each player\'s phase drifts toward the team average — models tactical coherence' },
          { label: 'Frequency update', formula: 'f = 0.5 + clamp(speed / 10, 0, 0.5)', detail: 'Faster players oscillate at higher frequencies (0.5-1.0 Hz)' },
          { label: 'Wavelength', formula: 'λ = 8 + (1 - A) × 12', detail: 'Fatigued players spread influence wider but weaker' },
          { label: 'Stimulus response', formula: 'φ += tanh(speed × A) × 0.01 × Δt', detail: 'Hyperbolic tangent: smooth, bounded phase adjustment from movement intensity' },
        ],
        conceptNote: 'Inspired by the Fokker-Planck equation from statistical mechanics. Each player\'s "wave function" captures energy (amplitude), tactical alignment (phase), rhythm (frequency), and spatial influence (wavelength). The wave evolves continuously, creating emergent team-level behavior.',
      }],
    }),

    positions: () => ({
      title: '④ Update Positions',
      sections: [{
        title: 'Position Integration',
        color: 'text-[#EC9A3C]',
        steps: [
          { label: 'Position update', formula: 'pos.x += vel.x × Δt; pos.y += vel.y × Δt', detail: 'Simple Euler integration: velocity → position' },
          { label: 'Boundary clamp', formula: 'x = clamp(x, 0, 105); y = clamp(y, 0, 68)', detail: 'Players cannot leave the pitch (105×68 meters)' },
          { label: 'Velocity drag', formula: 'vel *= 0.85', detail: '15% velocity decay per tick — models friction. Without drag, players accelerate forever.' },
        ],
        conceptNote: 'After all forces (attractors + Coulomb) and wave evolution are computed, positions are updated via Euler integration. The 0.85 drag coefficient is critical: too high and players are sluggish, too low and they oscillate wildly.',
      }],
    }),

    waveamp: () => ({
      title: 'Wave Amplitude (Energy)',
      sections: [{
        title: 'Amplitude Computation',
        color: 'text-[#EC9A3C]',
        steps: [
          { label: 'Initial value', formula: 'A = clamp(load / 100, 0.1, 1.0)', detail: 'Derived from physical load: higher workload → higher energy amplitude' },
          { label: 'Per-tick decay', formula: 'A *= (1 - 0.02 × Δt × 0.1) = A × 0.998', detail: 'Slow exponential decay: 0.2% per tick (models fatigue)' },
          { label: 'Density |ψ|²', formula: 'density = amplitude²', detail: 'Probability density — how "present" the player is in the field (Born rule)' },
          { label: 'Impact on coherence', value: '40% weight', detail: 'Density contributes 40% to the coherence score' },
        ],
        conceptNote: 'In quantum mechanics, the wave function amplitude squared gives probability density. Here, a player with amplitude 0.8 has density 0.64 — 64% of their potential field presence. As fatigue sets in, amplitude drops → density drops → tactical influence diminishes.',
      }],
    }),

    wavephase: () => ({
      title: 'Wave Phase (Tactical Alignment)',
      sections: [{
        title: 'Phase System',
        color: 'text-[#EC9A3C]',
        steps: [
          { label: 'Phase mapping', formula: 'defending=0, pressing=0.4π, building=0.8π, attacking=1.2π, transitioning=1.6π' },
          { label: 'Initial phase', formula: 'φ = PHASE_MAP[state] + random(-0.1, 0.1)', detail: 'Small random perturbation prevents exact phase-lock' },
          { label: 'Drift toward average', formula: 'φ += sin(φ_avg - φ) × 0.1 × Δt', detail: 'Players naturally synchronize — like coupled oscillators' },
          { label: 'Phase alignment metric', formula: 'alignment = (cos(φ_player - φ_avg) + 1) / 2', detail: 'Maps to 0-1: 1.0 = perfectly in sync, 0.0 = opposite phase' },
        ],
        conceptNote: 'Phase is the most conceptually rich part. When all players have similar phases, they\'re "in resonance." When phases diverge, the team is fragmented. The sin() drift term creates natural self-organization, but disruptions can push phases apart faster than they converge.',
      }],
    }),

    wavefreq: () => ({
      title: 'Wave Frequency (Movement Rhythm)',
      sections: [{
        title: 'Frequency Derivation',
        color: 'text-[#EC9A3C]',
        steps: [
          { label: 'Base frequency', value: '0.5 Hz', detail: 'Minimum oscillation rate (stationary player)' },
          { label: 'Speed contribution', formula: 'f = 0.5 + clamp(speed / 10, 0, 0.5)', detail: 'Speed in m/s divided by 10, capped at 0.5' },
          { label: 'Range', value: '0.5–1.0 Hz', detail: 'Walking = 0.5 Hz, sprinting = 1.0 Hz' },
        ],
        conceptNote: 'Frequency represents movement rhythm. Similar frequencies mean players move at similar rhythms — important for coordinated pressing or build-up play.',
      }],
    }),

    wavelength: () => ({
      title: 'Wave Wavelength (Spatial Coverage)',
      sections: [{
        title: 'Wavelength Computation',
        color: 'text-[#EC9A3C]',
        steps: [
          { label: 'Formula', formula: 'λ = 8 + (1 - amplitude) × 12', detail: 'Range: 8m (max energy) to 20m (min energy)' },
          { label: 'High energy player', value: '~8-10 meters', detail: 'Concentrated presence — dominates a small area intensely' },
          { label: 'Fatigued player', value: '~16-20 meters', detail: 'Dispersed presence — covers more ground but with less intensity' },
        ],
        conceptNote: 'A fresh player is like a focused laser beam (short wavelength, intense), while a tired player is like a diffuse lamp (long wavelength, spread thin). This models how fatigued players cover their zones less effectively.',
      }],
    }),

    harmony: () => ({
      title: 'Field Harmony — Team Synchronization',
      liveValue: liveOutput?.harmony !== undefined ? `${(liveOutput.harmony * 100).toFixed(1)}%` : undefined,
      sections: [{
        title: 'Harmony Computation',
        color: 'text-[#32A467]',
        steps: [
          { label: 'Phase alignment', formula: 'alignment = Σcos(φᵢ - φⱼ) / C(n,2)', detail: 'Average cosine similarity across all player pairs' },
          { label: 'Normalize alignment', formula: '(alignment + 1) / 2', detail: 'Shift from [-1,1] to [0,1] range' },
          { label: 'Amplitude entropy', formula: 'H = -Σ(pᵢ × log₂(pᵢ)) where pᵢ = Aᵢ/ΣA', detail: 'Shannon entropy of amplitude distribution' },
          { label: 'Normalized entropy', formula: 'H_norm = H / log₂(n)', detail: 'Scale to [0,1] using maximum possible entropy' },
          { label: 'Final harmony', formula: 'harmony = 0.7 × alignment + 0.3 × (1 - H_norm)', detail: '70% phase coherence + 30% energy uniformity' },
        ],
        conceptNote: '>70% = team in resonance. 40-70% = drifting. <40% = collapsing. Harmony measures BOTH tactical alignment AND energy balance. A team where one player does everything can never achieve high harmony.',
      }],
    }),

    coherence: () => ({
      title: 'Player Coherence — Individual Alignment',
      liveValue: liveOutput?.avgCoherence !== undefined ? `avg ${(liveOutput.avgCoherence * 100).toFixed(0)}%` : undefined,
      sections: [{
        title: 'Per-Player Coherence Score',
        color: 'text-[#32A467]',
        steps: [
          { label: 'Density', formula: '|ψ|² = amplitude²', detail: 'Born rule: probability density from wave amplitude. Weight: 40%' },
          { label: 'Phase alignment', formula: '(cos(φ_player - φ_avg) + 1) / 2', detail: 'How aligned this player is with team average phase. Weight: 35%' },
          { label: 'Positional deviation', formula: 'dev = min(d / (R × 3)) across all attractors', detail: 'Closeness to nearest attractor, normalized. Weight: 25% (inverted)' },
          { label: 'Final score', formula: 'C = 0.4 × density + 0.35 × phaseAlign + 0.25 × (1 - deviation)', detail: 'Weighted composite clamped to [0,1]' },
        ],
        conceptNote: 'A player with coherence < 0.35 is "losing tactical connection" — either out of position, out of phase, or fatigued. The insight layer watches for these drops.',
      }],
    }),

    entangle: () => ({
      title: 'Entanglement Map — Player Pair Correlations',
      liveValue: liveOutput?.entanglementCount !== undefined ? `${liveOutput.entanglementCount} pairs` : undefined,
      sections: [{
        title: 'Entanglement Computation',
        color: 'text-[#32A467]',
        steps: [
          { label: 'Spatial correlation', formula: 'spatial = RBF(posA, posB, σ=20) = e^(-d²/(2×20²))', detail: 'Radial Basis Function: 1.0 when overlapping, decays with distance' },
          { label: 'Phase correlation', formula: 'phase = (cos(φA - φB) + 1) / 2', detail: 'Same-phase = 1.0, opposite-phase = 0.0' },
          { label: 'Combined', formula: 'correlation = spatial × phase', detail: 'Must be close AND in-phase to entangle' },
          { label: 'Threshold', formula: 'correlation > 0.3', detail: 'Only pairs above 30% are considered "entangled"' },
        ],
        conceptNote: 'Two "entangled" players move and think as a coordinated unit — like CB partners who shift together. The RBF kernel ensures only nearby players can entangle, mimicking real communication range.',
      }],
    }),

    drifts: () => ({
      title: 'Drift Detection — Predictive Collapse Warning',
      liveValue: liveOutput?.driftCount !== undefined ? (liveOutput.driftCount > 0 ? `${liveOutput.driftCount} active` : 'none') : undefined,
      sections: [{
        title: 'Drift Detection Algorithm',
        color: 'text-[#E76A6E]',
        steps: [
          { label: 'Global trend', formula: 'trend = harmony[t] - harmony[t-3]', detail: 'Compares current harmony to 3 ticks ago' },
          { label: 'Trigger', formula: 'if trend < -0.05 → DRIFT', detail: '5% drop over 3 ticks signals structural collapse' },
          { label: 'Time to collapse', formula: 'TTC = |harmony / trend|', detail: 'Extrapolates when harmony hits zero. Clamped to 1-10 ticks' },
          { label: 'Severity', formula: 'severity = clamp(|trend| × 10, 0, 1)', detail: 'Normalized urgency score' },
          { label: 'Zone analysis', value: 'def/mid/atk', detail: 'Per-zone coherence checks: any zone avg < 0.4 → zone drift flagged' },
        ],
        conceptNote: 'The engine\'s "early warning system." By detecting trends, it can warn 3-6 seconds before tactical shape collapses — prediction, not analysis.',
      }],
    }),

    energy: () => ({
      title: 'Field Energy — Total System Energy',
      liveValue: liveOutput?.fieldEnergy !== undefined ? liveOutput.fieldEnergy.toFixed(2) : undefined,
      sections: [{
        title: 'Energy Computation',
        color: 'text-[#32A467]',
        steps: [
          { label: 'Kinetic energy', formula: 'KE = Σ 0.5 × (vx² + vy²)', detail: 'Sum of kinetic energy across all 11 players' },
          { label: 'Wave energy', formula: 'WE = Σ amplitude²', detail: 'Sum of wave function squared amplitudes' },
          { label: 'Total', formula: 'E = KE + WE', detail: 'System energy = movement + tactical presence' },
        ],
        conceptNote: 'Energy decays naturally via drag and diffusion. A spike indicates counter-attack or pressing trigger. Gradual decline = fatigue.',
      }],
    }),

    twins: () => ({
      title: 'Autonomous Twin ×11 — Self-Governing Agents',
      sections: [{
        title: 'Twin Evaluation Loop',
        color: 'text-[#DB2777]',
        steps: [
          { label: 'Step 1', value: 'evaluateIntent()', detail: 'Score all 6 possible intents using awareness + kernel state' },
          { label: 'Step 2', value: 'Pick best intent', detail: 'Highest scoring intent becomes current action' },
          { label: 'Step 3', value: 'executeIntent()', detail: 'Mutate kernel player velocity/phase based on chosen intent' },
          { label: 'Feedback loop', value: 'twins ↔ kernel', detail: 'Twins read kernel state, modify kernel players, kernel re-evaluates — creating emergent behavior' },
        ],
        conceptNote: 'Each player is an autonomous agent. No central controller. Each twin senses its environment and the field state, scores possible actions, and acts. Team behavior EMERGES from 11 independent decisions.',
      }],
    }),

    awareness: () => ({
      title: 'Awareness Vector — Agent Perception',
      sections: [{
        title: 'Awareness Dimensions',
        color: 'text-[#DB2777]',
        steps: [
          { label: 'Ball proximity', formula: 'ball = clamp(1 - ballDist / 50, 0, 1)', detail: 'At 0m = 1.0, at 50m = 0.0' },
          { label: 'Space available', formula: 'space = clamp(openSpaceRadius / 15, 0, 1)', detail: '15m radius = maximum' },
          { label: 'Threat level', formula: 'threat = clamp(1 - oppDist / 20, 0, 1)', detail: 'At 0m = 1.0, at 20m = 0.0' },
          { label: 'Teammate support', formula: 'teammates = clamp(1 - teammateDist / 30, 0, 1)', detail: 'Closer = more support' },
        ],
        conceptNote: 'The awareness vector is the twin\'s "eyes and ears." It collapses complex spatial data into 4 normalized values (0-1) that drive intent scoring.',
      }],
    }),

    intents: () => ({
      title: 'Intent Scoring — Decision Making',
      sections: [{
        title: 'Intent Score Formulas',
        color: 'text-[#DB2777]',
        steps: [
          { label: 'hold_position', formula: 'coherence × 0.6 + (1-threat) × 0.4' },
          { label: 'move_to_space', formula: 'space × 0.7 + (1-threat) × 0.3' },
          { label: 'press_opponent', formula: 'threat × 0.5 + amplitude × 0.3 + ball × 0.2' },
          { label: 'support_ball', formula: 'ball × 0.6 + (1-teammates) × 0.4' },
          { label: 'create_passing_lane', formula: 'space × 0.4 + ball × 0.3 + teammates × 0.3' },
          { label: 'recover_shape', formula: '(1-coherence) × 0.7 + (1-phaseAlign) × 0.3' },
        ],
        conceptNote: 'Each intent scored 0-1. Highest wins. A player badly out of position will prioritize "recover_shape." A player in space near the ball will "support_ball." Pure weighted scoring produces adaptive behavior.',
      }],
    }),

    insight: () => ({
      title: 'Insight Layer — Human-Readable Intelligence',
      sections: [{
        title: 'Insight Generation',
        color: 'text-[#A78BFA]',
        steps: [
          { label: 'Harmony insights', value: '≥85% info, ≥60% warning, <60% critical' },
          { label: 'Drift insights', value: 'severity > 0.7 → critical' },
          { label: 'Coherence insights', value: '< 0.35 → warning/critical' },
          { label: 'Entanglement insights', value: '> 0.7 = strong pair' },
        ],
        conceptNote: 'Translates raw math into coaching language: "midfield coherence low" instead of "zone.midfield.avgCoherence = 0.32." Bridges computation and decision-making.',
      }],
    }),

    montecarlo: () => ({
      title: 'Monte Carlo What-If — Scenario Simulation',
      liveValue: liveOutput?.mcResult ? `avg ${(liveOutput.mcResult.avgHarmony * 100).toFixed(0)}%` : undefined,
      sections: [{
        title: 'Monte Carlo Method',
        color: 'text-[#06B6D4]',
        steps: [
          { label: 'Algorithm', value: 'N scenarios × T ticks', detail: '10 random perturbations, each 5 ticks forward' },
          { label: 'Perturbation', formula: 'pos += random(-2, 2); phase += random(-0.15, 0.15)' },
          { label: 'Measure', value: 'Final harmony after T ticks' },
          { label: 'Aggregate', formula: 'avg = Σ(harmony) / N; worst = min(); best = max()' },
          { label: 'State restore', value: 'Serialize → run → deserialize', detail: 'Kernel state restored after simulation' },
        ],
        conceptNote: 'Answers: "how robust is our shape right now?" Wide best-worst gap = fragile state. Narrow range = stability.',
      }],
    }),

    states: () => ({
      title: 'Superposition States — Tactical Phases',
      sections: [{
        title: 'Phase System',
        color: 'text-[#8F99A8]',
        steps: [
          { label: 'defending', value: 'φ = 0', detail: 'Deep, maintain shape' },
          { label: 'pressing', value: 'φ = 0.4π', detail: 'Active defensive effort' },
          { label: 'building', value: 'φ = 0.8π', detail: 'Possession play' },
          { label: 'attacking', value: 'φ = 1.2π', detail: 'Final third penetration' },
          { label: 'transitioning', value: 'φ = 1.6π', detail: 'Between states' },
        ],
        conceptNote: 'The team\'s actual state is a superposition of all 11 individual phases. When they align, the team "collapses" into a coherent state. When they diverge, the team is in "quantum uncertainty."',
      }],
    }),

    predecision: () => ({
      title: 'PRE-DECISION OUTPUT — Actionable Intelligence',
      sections: [{
        title: 'What Makes It "Pre-Decision"',
        color: 'text-[#E76A6E]',
        steps: [
          { label: 'Key concept', value: 'Before, not after', detail: 'Tells you what\'s ABOUT to happen' },
          { label: 'Input sources', value: 'Insights + Monte Carlo + Drifts' },
          { label: 'Output format', value: 'Natural language + urgency' },
          { label: 'Action window', value: '3-6 seconds', detail: 'Warning before tactical collapse' },
        ],
        conceptNote: 'The entire BigDunc engine exists for this: a 3-6 second warning before tactical breakdowns. Not analysis — PREDICTION.',
      }],
    }),

    eventingest: () => ({
      title: 'Event Ingestion — Abstract to Structured',
      sections: [
        {
          title: 'What It Does',
          color: 'text-[#0D9488]',
          steps: [
            { label: 'Input', value: 'AbstractEvent', detail: '{ type: "pass", from: "CB1", to: "CM2", minute: 23, success: true }' },
            { label: 'No coordinates', value: 'Just semantics', detail: 'Abstract events carry only WHO did WHAT — no spatial data' },
            { label: 'Event types', value: '20+ types', detail: 'pass, shot, tackle, dribble, cross, through_ball, press_trigger, interception, and more' },
          ],
          conceptNote: 'Entry point: "CB1 passed to CM2 in minute 23." No x,y coordinates, no velocities. The ingestion layer accepts raw semantic data for vector enrichment.',
        },
        {
          title: 'Sample Event Stream',
          color: 'text-[#5EEAD4]',
          steps: [
            { label: '1', value: 'CB1 → CM2 (pass)' },
            { label: '2', value: 'CM2 → LW (through_ball)' },
            { label: '3', value: 'LW dribble' },
            { label: '4', value: 'LW → ST (cross)' },
            { label: '5', value: 'ST shot' },
          ],
          conceptNote: 'Each event enriches field state incrementally. After 20+ events, the field reflects real match dynamics.',
        },
      ],
    }),

    vectorenrich: () => ({
      title: 'Vector Enrichment — Spatial Resolution',
      sections: [
        {
          title: 'Position Resolution',
          color: 'text-[#0D9488]',
          steps: [
            { label: 'Step 1: Kernel sync', value: 'Current positions', detail: 'First tries kernel-synced GPS positions' },
            { label: 'Step 2: Role fallback', value: 'Tactical template', detail: 'Role-based positions if no kernel data' },
            { label: 'Step 3: Destination', formula: 'dest = target_pos + lead_offset + zone_noise' },
            { label: 'Zone mapping', value: '24 zones → Vec2' },
          ],
        },
        {
          title: 'Vector Computation',
          color: 'text-[#5EEAD4]',
          steps: [
            { label: 'Ball trajectory', formula: 'B(t) = (1-t)²P₀ + 2(1-t)tC + t²P₂', detail: 'Quadratic Bézier with type-dependent curvature' },
            { label: 'Ball speed', formula: 'v = base_speed[type] + clamp(distance/15, 0, 8)', detail: 'pass=12, shot=28, cross=18, through_ball=16 m/s' },
            { label: 'Passing lane width', formula: 'width = 10 - dist/8 - fwd_penalty×3' },
            { label: 'Progressive distance', formula: 'Δx = dest.x - origin.x', detail: 'Positive = toward opponent goal' },
          ],
        },
      ],
    }),

    fieldconst: () => ({
      title: 'Field Constructor — Organic Kernel Mutation',
      liveValue: liveOutput?.tick !== undefined ? `tick ${liveOutput.tick}` : undefined,
      sections: [
        {
          title: 'Mutation Pipeline',
          color: 'text-[#0D9488]',
          steps: [
            { label: '1. Actor position', formula: 'pos += (enriched_pos - pos) × 0.4', detail: 'Smooth 40% lerp' },
            { label: '2. Actor velocity', formula: 'v += normalize(dest - pos) × 0.8' },
            { label: '3. Actor phase', value: 'Event → phase map' },
            { label: '4. Target position', formula: 'pos += (enriched_target - pos) × 0.35', detail: '35% lerp on reception' },
            { label: '5. Ball attractor', value: 'Move to destination' },
            { label: '6. Phase cascade', formula: 'P(shift) = 0.6 × (1 - d/25)', detail: 'Cascades to players within 25m' },
            { label: '7. Energy injection', value: 'Amplitude boost', detail: 'High-energy events boost nearby amplitudes' },
          ],
          conceptNote: 'No position is hardcoded. Every position emerges from events. After 20+ events, every player has been moved organically by passes, tackles, dribbles.',
        },
        {
          title: 'Organic Coverage',
          color: 'text-[#5EEAD4]',
          steps: [
            { label: 'Coverage metric', formula: 'coverage = event_driven_players / 11' },
            { label: 'States', value: 'initializing → stable → organic' },
            { label: 'Volatile', value: '>5 mutations/5 ticks', detail: 'Rapid tactical changes' },
          ],
        },
      ],
    }),

    eventlog: () => ({
      title: 'Mutation Log — Field Change Audit Trail',
      sections: [{
        title: 'Mutation Types',
        color: 'text-[#0D9488]',
        steps: [
          { label: 'player_move', value: 'Position change' },
          { label: 'player_phase', value: 'Phase transition' },
          { label: 'player_load', value: 'Load adjustment' },
          { label: 'ball_move', value: 'Ball attractor moved' },
          { label: 'attractor_mutate', value: 'Create/remove attractor' },
          { label: 'energy_inject', value: 'Field energy boost' },
          { label: 'phase_cascade', value: 'Nearby players shift' },
        ],
        conceptNote: 'Every mutation is logged with before/after state. Full audit trail: trace exactly why player X is at position Y.',
      }],
    }),
  };

  const builder = explanations[nodeId];
  if (!builder) {
    return {
      title: nodeId,
      sections: [{ title: 'Node', color: 'text-[#8F99A8]', steps: [{ label: 'No detailed explanation available for this node' }] }],
    };
  }
  return builder();
}

// ============================================================================
// SIDEBAR STAT EXPLANATIONS
// ============================================================================

export function getStatExplanation(
  statId: string,
  value?: string
): { title: string; sections: ComputationSection[]; liveValue?: string } {
  const stats: Record<string, () => { title: string; sections: ComputationSection[]; liveValue?: string }> = {
    tick: () => ({
      title: 'Tick Counter',
      liveValue: value,
      sections: [{
        title: 'What Is a Tick?',
        color: 'text-[#EC9A3C]',
        steps: [
          { label: 'Definition', value: '1 discrete time step', detail: 'The kernel advances by calling tick(Δt) where Δt = 1 second' },
          { label: 'Per tick', value: '4-step pipeline', detail: 'Attractors → Coulomb → Waves → Positions, then compute outputs' },
          { label: 'Simulation speed', value: 'Configurable', detail: 'Real-time = 1 tick/sec. Adjustable from 100ms to 1000ms.' },
        ],
      }],
    }),

    energy: () => ({
      title: 'Field Energy',
      liveValue: value,
      sections: [{
        title: 'Energy Computation',
        color: 'text-[#32A467]',
        steps: [
          { label: 'Formula', formula: 'E = Σ(0.5 × |v|²) + Σ(A²)', detail: 'Kinetic energy (movement) + wave energy (amplitude squared)' },
          { label: 'Kinetic part', value: 'from velocity', detail: 'Fast-moving players contribute more kinetic energy' },
          { label: 'Wave part', value: 'from amplitude', detail: 'High-energy (fresh) players contribute more wave energy' },
        ],
        conceptNote: 'Energy decays via drag (v *= 0.85) and diffusion (A *= 0.998). A spike = counter-attack. Gradual decline = fatigue.',
      }],
    }),

    entangled: () => ({
      title: 'Entangled Pairs',
      liveValue: value,
      sections: [{
        title: 'Entanglement Count',
        color: 'text-[#A78BFA]',
        steps: [
          { label: 'Computation', formula: 'For all C(11,2)=55 pairs: RBF(d, σ=20) × cos_similarity(φ)' },
          { label: 'Threshold', value: '> 0.30' },
          { label: 'Ideal', value: '5-8 pairs', detail: 'Defensive unit, midfield triangle, etc.' },
          { label: 'Fragmented', value: '0-2 pairs', detail: 'No coordinated units' },
        ],
      }],
    }),

    drifts: () => ({
      title: 'Active Drifts',
      liveValue: value,
      sections: [{
        title: 'Drift Monitoring',
        color: 'text-[#E76A6E]',
        steps: [
          { label: '0 drifts', value: 'Stable' },
          { label: '1-2 drifts', value: 'Warning', detail: 'A zone or global harmony is declining' },
          { label: '3+ drifts', value: 'Critical', detail: 'Multiple zones collapsing simultaneously' },
          { label: 'Collapse timer', value: '1-10s' },
        ],
      }],
    }),
  };

  const builder = stats[statId];
  if (!builder) return { title: statId, sections: [] };
  return builder();
}
