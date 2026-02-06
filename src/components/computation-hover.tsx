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
  color: string; // tailwind text color class
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
// HOVER CARD COMPONENT
// ============================================================================

export function HoverCard({
  children,
  title,
  sections,
  liveValue,
  className = '',
  anchor = 'bottom',
  width = 340,
}: HoverCardProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));
  const timer = useRef<NodeJS.Timeout | null>(null);

  const enter = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 180);
  };
  const leave = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 250);
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
      <span className="cursor-help">{children}</span>

      {open && (
        <div
          className={`absolute ${anchorPos[anchor]} z-[200]`}
          style={{ width }}
          onMouseEnter={() => { if (timer.current) clearTimeout(timer.current); }}
          onMouseLeave={leave}
        >
          <div className="bg-[#0d1424] border border-white/10 rounded-lg shadow-2xl shadow-black/70 overflow-hidden backdrop-blur-xl">
            {/* Header */}
            <div className="px-3 py-2 border-b border-white/5 bg-gradient-to-r from-amber-500/10 to-purple-500/10">
              <div className="text-[11px] font-bold text-white tracking-wide">{title}</div>
              {liveValue && (
                <div className="text-[10px] text-amber-400 font-mono mt-0.5">Live: {liveValue}</div>
              )}
            </div>

            {/* Sections */}
            <div className="max-h-80 overflow-y-auto">
              {sections.map((sec, si) => (
                <div key={si} className="border-b border-white/5 last:border-0">
                  <button
                    onClick={() => toggle(si)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/3 text-left transition-colors"
                  >
                    <span className="text-[9px] text-white/30">{expanded.has(si) ? '▾' : '▸'}</span>
                    <span className={`text-[10px] font-semibold ${sec.color}`}>{sec.title}</span>
                  </button>

                  {expanded.has(si) && (
                    <div className="px-3 pb-2 space-y-1.5">
                      {sec.steps.map((step, stIdx) => (
                        <div key={stIdx} className="ml-3">
                          {step.formula && (
                            <div className="text-[9px] font-mono text-blue-300/80 bg-blue-500/8 px-1.5 py-0.5 rounded mb-0.5 leading-snug">
                              {step.formula}
                            </div>
                          )}
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[9px] text-white/50 leading-snug">{step.label}</span>
                            {step.value && (
                              <span className="text-[10px] font-mono text-white/80 tabular-nums flex-shrink-0">{step.value}</span>
                            )}
                          </div>
                          {step.detail && (
                            <div className="text-[8px] text-white/30 leading-relaxed mt-0.5">{step.detail}</div>
                          )}
                        </div>
                      ))}
                      {sec.conceptNote && (
                        <div className="ml-3 mt-1 p-1.5 bg-purple-500/5 border-l-2 border-purple-400/30 rounded-r">
                          <div className="text-[8px] text-purple-300/60 leading-relaxed">{sec.conceptNote}</div>
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

    // ═══════════════════════════════════════════════════════════════
    // DATA SOURCES
    // ═══════════════════════════════════════════════════════════════
    catapult: () => ({
      title: 'Catapult GPS/IMU Data Source',
      sections: [
        {
          title: 'What It Measures',
          color: 'text-sky-400',
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
          color: 'text-sky-300',
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
        color: 'text-sky-400',
        steps: [
          { label: 'Function', value: 'getSampleFrame()', detail: 'Generates 11 players with realistic positional and load data' },
          { label: 'Player positions', value: '4-3-3 formation', detail: 'Hardcoded starting XI with GK, 4 defenders, 3 midfielders, 3 forwards' },
          { label: 'State inference', formula: 'if speed > 6 → attacking; > 4 → pressing; > 2.5 → building; acc > 1.5 → transitioning; else defending', detail: 'Movement speed determines tactical phase classification' },
          { label: 'Load normalization', formula: 'normalizedLoad = clamp((rawLoad / 800) * 100, 0, 100)', detail: '800 AU is typical match maximum; normalize to 0-100 scale' },
        ],
        conceptNote: 'Used when no live Catapult feed is available. The synthetic generator produces realistic player frames so the kernel can run in demo/development mode.',
      }],
    }),

    // ═══════════════════════════════════════════════════════════════
    // SUBSTRATE
    // ═══════════════════════════════════════════════════════════════
    substrate: () => ({
      title: 'DataSubstrate — Normalization Layer',
      sections: [
        {
          title: 'Ingestion Pipeline',
          color: 'text-violet-400',
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
          color: 'text-violet-300',
          steps: [
            { label: 'NormalizedPlayerData', value: '{id, x, y, velocity, load, state}' },
            { label: 'Ball position', value: '{x, y} optional' },
            { label: 'Timestamp', value: 'Date.now() ms' },
          ],
        },
      ],
    }),

    // ═══════════════════════════════════════════════════════════════
    // KERNEL CORE
    // ═══════════════════════════════════════════════════════════════
    kernel: () => ({
      title: 'ResonanceKernel — Main Tick Loop',
      liveValue: liveOutput?.tick !== undefined ? `tick ${liveOutput.tick}` : undefined,
      sections: [
        {
          title: 'Tick Pipeline (executed every frame)',
          color: 'text-amber-400',
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
          color: 'text-amber-300',
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

    // ═══════════════════════════════════════════════════════════════
    // KERNEL PIPELINE STEPS
    // ═══════════════════════════════════════════════════════════════
    attractors: () => ({
      title: '① Attractor Forces',
      sections: [
        {
          title: 'Force Computation',
          color: 'text-amber-400',
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
          color: 'text-amber-300',
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
        color: 'text-amber-400',
        steps: [
          { label: 'Coulomb\'s Law', formula: 'F = k × q₁ × q₂ / d²', detail: 'Same as electrostatic force between charged particles' },
          { label: 'Constant k', value: '0.5', detail: 'Scaled Coulomb constant for pitch dimensions' },
          { label: 'Charges', formula: 'q = chargeFromState(phase)', detail: 'defending=-0.8, pressing=-0.4, building=0, attacking=+0.6, transitioning=+0.2' },
          { label: 'Like charges', value: 'Repel', detail: 'Two defenders (both negative) push apart → proper defensive spacing' },
          { label: 'Unlike charges', value: 'Attract', detail: 'Attacker (+0.6) and defender (-0.8) attract → marking/pressing dynamics' },
          { label: 'Distance safety', value: 'd > 1m', detail: 'Below 1 meter, force is capped to prevent numerical explosion' },
        ],
        conceptNote: 'This is the genius of the model: by assigning "tactical charges" to players based on their phase, the engine automatically creates proper spacing. Defenders spread out like same-sign electrons. Attackers and defenders attract like opposite charges — modeling pressing and marking without explicit rules.',
      }],
    }),

    fokker: () => ({
      title: '③ Wave Evolution (Fokker-Planck)',
      sections: [
        {
          title: 'Wave Function Update',
          color: 'text-amber-400',
          steps: [
            { label: 'Amplitude decay', formula: 'A *= (1 - DIFFUSION_RATE × Δt × 0.1)', detail: 'Amplitude (energy) slowly decays — models fatigue. DIFFUSION_RATE = 0.02' },
            { label: 'Amplitude clamp', formula: 'A = clamp(A, 0.05, 1.0)', detail: 'Never reaches zero (player is always "alive") or exceeds 1' },
            { label: 'Phase drift', formula: 'φ += sin(φ_avg - φ) × DRIFT_RATE × Δt', detail: 'Each player\'s phase drifts toward the team average — models tactical coherence as a natural pull' },
            { label: 'Frequency update', formula: 'f = 0.5 + clamp(speed / 10, 0, 0.5)', detail: 'Faster players oscillate at higher frequencies (0.5-1.0 Hz)' },
            { label: 'Wavelength', formula: 'λ = 8 + (1 - A) × 12', detail: 'Fatigued players (low amplitude) have longer wavelengths — they spread influence wider but weaker' },
            { label: 'Stimulus response', formula: 'φ += tanh(speed × A) × 0.01 × Δt', detail: 'Hyperbolic tangent provides smooth, bounded phase adjustment from movement intensity' },
          ],
          conceptNote: 'Inspired by the Fokker-Planck equation from statistical mechanics, which describes how probability distributions evolve over time. Here, each player\'s "wave function" captures their energy (amplitude), tactical alignment (phase), rhythm (frequency), and spatial influence (wavelength). The wave evolves continuously, creating emergent team-level behavior from individual dynamics.',
        },
      ],
    }),

    positions: () => ({
      title: '④ Update Positions',
      sections: [{
        title: 'Position Integration',
        color: 'text-amber-400',
        steps: [
          { label: 'Position update', formula: 'pos.x += vel.x × Δt; pos.y += vel.y × Δt', detail: 'Simple Euler integration: velocity → position' },
          { label: 'Boundary clamp', formula: 'x = clamp(x, 0, 105); y = clamp(y, 0, 68)', detail: 'Players cannot leave the pitch (105×68 meters)' },
          { label: 'Velocity drag', formula: 'vel *= 0.85', detail: '15% velocity decay per tick — models friction/deceleration. Without drag, players would accelerate forever.' },
        ],
        conceptNote: 'After all forces (attractors + Coulomb) and wave evolution are computed, positions are updated using Euler integration. The 0.85 drag coefficient is critical: too high and players are sluggish, too low and they oscillate wildly.',
      }],
    }),

    // ═══════════════════════════════════════════════════════════════
    // WAVE FUNCTION DETAILS
    // ═══════════════════════════════════════════════════════════════
    waveamp: () => ({
      title: 'Wave Amplitude (Energy)',
      sections: [{
        title: 'Amplitude Computation',
        color: 'text-orange-400',
        steps: [
          { label: 'Initial value', formula: 'A = clamp(load / 100, 0.1, 1.0)', detail: 'Derived from physical load: higher workload → higher energy amplitude' },
          { label: 'Per-tick decay', formula: 'A *= (1 - 0.02 × Δt × 0.1) = A × 0.998', detail: 'Slow exponential decay: 0.2% per tick (models fatigue)' },
          { label: 'Density |ψ|²', formula: 'density = amplitude²', detail: 'Probability density — how "present" the player is in the field. Squared because it\'s the Born rule from quantum mechanics.' },
          { label: 'Impact on coherence', value: '40% weight', detail: 'density contributes 40% to the coherence score' },
        ],
        conceptNote: 'In quantum mechanics, the wave function amplitude squared gives probability density. Here, a player with amplitude 0.8 has density 0.64, meaning they "occupy" 64% of their potential field presence. As fatigue sets in, amplitude drops → density drops → their tactical influence diminishes.',
      }],
    }),

    wavephase: () => ({
      title: 'Wave Phase (Tactical Alignment)',
      sections: [{
        title: 'Phase System',
        color: 'text-orange-400',
        steps: [
          { label: 'Phase mapping', formula: 'defending=0, pressing=0.4π, building=0.8π, attacking=1.2π, transitioning=1.6π', detail: 'Each tactical state maps to a unique angle in radians (0 to 2π circle)' },
          { label: 'Initial phase', formula: 'φ = PHASE_MAP[state] + random(-0.1, 0.1)', detail: 'Small random perturbation prevents exact phase-lock (more realistic)' },
          { label: 'Drift toward average', formula: 'φ += sin(φ_avg - φ) × 0.1 × Δt', detail: 'Players naturally synchronize — like coupled oscillators. sin() creates smooth convergence.' },
          { label: 'Phase alignment metric', formula: 'alignment = (cos(φ_player - φ_avg) + 1) / 2', detail: 'Maps to 0-1: 1.0 = perfectly in sync, 0.0 = opposite phase (π radians out)' },
        ],
        conceptNote: 'Phase is the most conceptually rich part. When all players have similar phases, they\'re "in resonance" — like a choir singing in harmony. When phases diverge, the team is fragmented. The sin() drift term creates the natural tendency for teams to self-organize, but external disruptions (opponent pressing, fatigue) can push phases apart faster than they converge.',
      }],
    }),

    wavefreq: () => ({
      title: 'Wave Frequency (Movement Rhythm)',
      sections: [{
        title: 'Frequency Derivation',
        color: 'text-orange-400',
        steps: [
          { label: 'Base frequency', value: '0.5 Hz', detail: 'Minimum oscillation rate (stationary player)' },
          { label: 'Speed contribution', formula: 'f = 0.5 + clamp(speed / 10, 0, 0.5)', detail: 'Speed in m/s divided by 10, capped at 0.5. Running at 10 m/s → f = 1.0 Hz' },
          { label: 'Range', value: '0.5–1.0 Hz', detail: 'Walking = 0.5 Hz, sprinting = 1.0 Hz' },
        ],
        conceptNote: 'Frequency represents the player\'s movement rhythm. A player jogging slowly has a low-frequency wave (slow oscillation), while a sprinting player has a high-frequency wave (rapid oscillation). In team coherence, similar frequencies mean players are moving at similar rhythms — important for coordinated pressing or build-up play.',
      }],
    }),

    wavelength: () => ({
      title: 'Wave Wavelength (Spatial Coverage)',
      sections: [{
        title: 'Wavelength Computation',
        color: 'text-orange-400',
        steps: [
          { label: 'Formula', formula: 'λ = 8 + (1 - amplitude) × 12', detail: 'Range: 8m (max energy) to 20m (min energy)' },
          { label: 'High energy player', value: '~8-10 meters', detail: 'Concentrated presence — dominates a small area intensely' },
          { label: 'Fatigued player', value: '~16-20 meters', detail: 'Dispersed presence — covers more ground but with less intensity per point' },
        ],
        conceptNote: 'An intuitive analogy: a fresh player is like a focused laser beam (short wavelength, intense), while a tired player is like a diffuse lamp (long wavelength, spread thin). This models how fatigued players cover their zones less effectively — they\'re "there" in a wider area but not really controlling any of it.',
      }],
    }),

    // ═══════════════════════════════════════════════════════════════
    // OUTPUTS
    // ═══════════════════════════════════════════════════════════════
    harmony: () => ({
      title: 'Field Harmony — Team Synchronization',
      liveValue: liveOutput?.harmony !== undefined ? `${(liveOutput.harmony * 100).toFixed(1)}%` : undefined,
      sections: [
        {
          title: 'Harmony Computation',
          color: 'text-emerald-400',
          steps: [
            { label: 'Phase alignment', formula: 'alignment = Σcos(φᵢ - φⱼ) / C(n,2)', detail: 'Average cosine similarity across all player pairs. cos(0)=1 (in sync), cos(π)=-1 (opposite)' },
            { label: 'Normalize alignment', formula: '(alignment + 1) / 2', detail: 'Shift from [-1,1] to [0,1] range' },
            { label: 'Amplitude entropy', formula: 'H = -Σ(pᵢ × log₂(pᵢ)) where pᵢ = Aᵢ/ΣA', detail: 'Shannon entropy of amplitude distribution. Low entropy = one player dominates. High entropy = uniform energy.' },
            { label: 'Normalized entropy', formula: 'H_norm = H / log₂(n)', detail: 'Scale to [0,1] using maximum possible entropy' },
            { label: 'Final harmony', formula: 'harmony = 0.7 × alignment + 0.3 × (1 - H_norm)', detail: '70% phase coherence + 30% energy uniformity' },
          ],
          conceptNote: 'Harmony above 0.7 = team in resonance (green). 0.4-0.7 = drifting (yellow). Below 0.4 = collapsing (red). The key insight: harmony measures BOTH tactical alignment (are they playing the same phase?) AND energy balance (is workload evenly distributed?). A team where one player does everything can never achieve high harmony.',
        },
      ],
    }),

    coherence: () => ({
      title: 'Player Coherence — Individual Alignment',
      liveValue: liveOutput?.avgCoherence !== undefined ? `avg ${(liveOutput.avgCoherence * 100).toFixed(0)}%` : undefined,
      sections: [{
        title: 'Per-Player Coherence Score',
        color: 'text-emerald-400',
        steps: [
          { label: 'Density', formula: '|ψ|² = amplitude²', detail: 'Born rule: probability density from wave amplitude. Weight: 40%' },
          { label: 'Phase alignment', formula: '(cos(φ_player - φ_avg) + 1) / 2', detail: 'How aligned this player is with team average phase. Weight: 35%' },
          { label: 'Positional deviation', formula: 'dev = min(d / (R × 3)) across all attractors', detail: 'How close to nearest attractor, normalized by 3× attractor radius. Weight: 25% (inverted)' },
          { label: 'Final score', formula: 'C = 0.4 × density + 0.35 × phaseAlign + 0.25 × (1 - deviation)', detail: 'Weighted composite clamped to [0,1]' },
        ],
        conceptNote: 'A player with coherence < 0.35 is "losing tactical connection" — they\'re either out of position, out of phase with the team, or fatigued (low density). The insight layer watches for these drops and generates warnings.',
      }],
    }),

    entangle: () => ({
      title: 'Entanglement Map — Player Pair Correlations',
      liveValue: liveOutput?.entanglementCount !== undefined ? `${liveOutput.entanglementCount} pairs` : undefined,
      sections: [{
        title: 'Entanglement Computation',
        color: 'text-emerald-400',
        steps: [
          { label: 'Spatial correlation', formula: 'spatial = RBF(posA, posB, σ=20) = e^(-d²/(2×20²))', detail: 'Radial Basis Function: 1.0 when overlapping, decays with distance (σ=20m)' },
          { label: 'Phase correlation', formula: 'phase = (cos(φA - φB) + 1) / 2', detail: 'Same-phase players have correlation 1.0, opposite-phase = 0.0' },
          { label: 'Combined', formula: 'correlation = spatial × phase', detail: 'Both spatially close AND phase-aligned → entangled' },
          { label: 'Threshold', formula: 'correlation > 0.3', detail: 'Only pairs above 30% correlation are considered "entangled"' },
        ],
        conceptNote: 'Borrowed from quantum entanglement: two "entangled" players move and think as a unit. High entanglement between CB1↔CB2 means your center-backs are a coordinated pair. Zero entanglement means players are isolated — a fragmented team structure. The RBF kernel ensures only nearby players can entangle, mimicking real football communication range.',
      }],
    }),

    drifts: () => ({
      title: 'Drift Detection — Predictive Collapse Warning',
      liveValue: liveOutput?.driftCount !== undefined ? (liveOutput.driftCount > 0 ? `${liveOutput.driftCount} active` : 'none') : undefined,
      sections: [{
        title: 'Drift Detection Algorithm',
        color: 'text-red-400',
        steps: [
          { label: 'Global trend', formula: 'trend = harmony[t] - harmony[t-3]', detail: 'Compares current harmony to 3 ticks ago' },
          { label: 'Trigger', formula: 'if trend < -0.05 → DRIFT', detail: '5% harmony drop over 3 ticks signals structural collapse' },
          { label: 'Time to collapse', formula: 'TTC = |harmony / trend|', detail: 'Extrapolates: at this rate, when does harmony hit zero? Clamped to 1-10 ticks' },
          { label: 'Severity', formula: 'severity = clamp(|trend| × 10, 0, 1)', detail: 'Normalized urgency score' },
          { label: 'Zone analysis', value: 'def/mid/atk', detail: 'Additionally checks per-zone coherence: if any zone avg < 0.4, zone drift is flagged' },
        ],
        conceptNote: 'This is the engine\'s "early warning system." By detecting harmony trends (not just current values), it can warn 3-6 seconds before a tactical shape actually collapses. The coaching staff sees "midfield zone coherence low — shape at risk" BEFORE the opponent exploits the gap.',
      }],
    }),

    energy: () => ({
      title: 'Field Energy — Total System Energy',
      liveValue: liveOutput?.fieldEnergy !== undefined ? liveOutput.fieldEnergy.toFixed(2) : undefined,
      sections: [{
        title: 'Energy Computation',
        color: 'text-emerald-400',
        steps: [
          { label: 'Kinetic energy', formula: 'KE = Σ 0.5 × (vx² + vy²)', detail: 'Sum of kinetic energy across all 11 players' },
          { label: 'Wave energy', formula: 'WE = Σ amplitude²', detail: 'Sum of wave function squared amplitudes' },
          { label: 'Total', formula: 'E = KE + WE', detail: 'System energy = movement energy + tactical presence energy' },
        ],
        conceptNote: 'High field energy means the team is active (moving fast + high amplitude). Energy naturally decays due to velocity drag (0.85) and amplitude diffusion. A sudden energy spike means a phase transition (counter-attack). Gradual energy decline means the team is tiring.',
      }],
    }),

    // ═══════════════════════════════════════════════════════════════
    // AGENT SYSTEM
    // ═══════════════════════════════════════════════════════════════
    twins: () => ({
      title: 'Autonomous Twin ×11 — Self-Governing Agents',
      sections: [{
        title: 'Twin Evaluation Loop',
        color: 'text-pink-400',
        steps: [
          { label: 'Step 1', value: 'evaluateIntent()', detail: 'Score all 6 possible intents using awareness + kernel state' },
          { label: 'Step 2', value: 'Pick best intent', detail: 'Highest scoring intent becomes current action' },
          { label: 'Step 3', value: 'executeIntent()', detail: 'Mutate kernel player velocity/phase based on chosen intent' },
          { label: 'Feedback loop', value: 'twins ↔ kernel', detail: 'Twins read kernel state, modify kernel players, kernel re-evaluates — creating emergent behavior' },
        ],
        conceptNote: 'Each player is an autonomous agent that decides its own actions. There is no central controller telling players where to go. Instead, each twin senses its environment (awareness vector) and the field state (kernel output), scores possible actions, and acts. The team\'s tactical behavior EMERGES from 11 independent decisions.',
      }],
    }),

    awareness: () => ({
      title: 'Awareness Vector — Agent Perception',
      sections: [{
        title: 'Awareness Dimensions',
        color: 'text-pink-400',
        steps: [
          { label: 'Ball proximity', formula: 'ball = clamp(1 - ballDist / 50, 0, 1)', detail: 'How relevant the ball is. At 0m = 1.0, at 50m = 0.0' },
          { label: 'Space available', formula: 'space = clamp(openSpaceRadius / 15, 0, 1)', detail: 'How much open space around the player. 15m radius = maximum' },
          { label: 'Threat level', formula: 'threat = clamp(1 - oppDist / 20, 0, 1)', detail: 'How close the nearest opponent is. At 0m = 1.0, at 20m = 0.0' },
          { label: 'Teammate support', formula: 'teammates = clamp(1 - teammateDist / 30, 0, 1)', detail: 'How close the nearest teammate is. Closer = more support' },
        ],
        conceptNote: 'The awareness vector is the twin\'s "eyes and ears." It collapses complex spatial data into 4 normalized values (0-1) that drive intent scoring. A player who sees high threat + high ball proximity will likely choose "press_opponent." One with low coherence will choose "recover_shape."',
      }],
    }),

    intents: () => ({
      title: 'Intent Scoring — Decision Making',
      sections: [{
        title: 'Intent Score Formulas',
        color: 'text-pink-400',
        steps: [
          { label: 'hold_position', formula: 'coherence × 0.6 + (1-threat) × 0.4', detail: 'Stay put when already coherent and not under pressure' },
          { label: 'move_to_space', formula: 'space × 0.7 + (1-threat) × 0.3', detail: 'Exploit open space when available and safe' },
          { label: 'press_opponent', formula: 'threat × 0.5 + amplitude × 0.3 + ball × 0.2', detail: 'Press when opponent is close, you have energy, and ball is near' },
          { label: 'support_ball', formula: 'ball × 0.6 + (1-teammates) × 0.4', detail: 'Move toward ball when it\'s near and few teammates are helping' },
          { label: 'create_passing_lane', formula: 'space × 0.4 + ball × 0.3 + teammates × 0.3', detail: 'Find space between ball and teammates for receiving' },
          { label: 'recover_shape', formula: '(1-coherence) × 0.7 + (1-phaseAlign) × 0.3', detail: 'Return to tactical position when out of shape' },
        ],
        conceptNote: 'Each intent is scored 0-1. The highest wins. This creates a priority system: a player who is badly out of position (low coherence) will prioritize "recover_shape" over all else. A player in space near the ball will "support_ball." No hard rules — pure weighted scoring produces intelligent, adaptive behavior.',
      }],
    }),

    // ═══════════════════════════════════════════════════════════════
    // INSIGHT + MONTE CARLO + META
    // ═══════════════════════════════════════════════════════════════
    insight: () => ({
      title: 'Insight Layer — Human-Readable Intelligence',
      sections: [{
        title: 'Insight Generation',
        color: 'text-violet-400',
        steps: [
          { label: 'Harmony insights', value: '≥85% info, ≥60% warning, <60% critical', detail: 'Maps harmony level to urgency' },
          { label: 'Drift insights', value: 'severity > 0.7 → critical', detail: 'Converts drift predictions to warnings with collapse timing' },
          { label: 'Coherence insights', value: '< 0.35 → warning/critical', detail: 'Flags players losing tactical connection. 3+ players = critical.' },
          { label: 'Entanglement insights', value: '> 0.7 = strong pair', detail: 'Reports strongly entangled pairs. Zero pairs = critical fragmentation.' },
        ],
        conceptNote: 'The insight layer translates raw math into coaching language: "midfield zone coherence low — shape at risk" instead of "zone.midfield.avgCoherence = 0.32." It bridges the gap between the kernel\'s continuous math and the discrete decisions coaches need to make.',
      }],
    }),

    montecarlo: () => ({
      title: 'Monte Carlo What-If — Scenario Simulation',
      liveValue: liveOutput?.mcResult ? `avg ${(liveOutput.mcResult.avgHarmony * 100).toFixed(0)}%` : undefined,
      sections: [{
        title: 'Monte Carlo Method',
        color: 'text-cyan-400',
        steps: [
          { label: 'Algorithm', value: 'N scenarios × T ticks', detail: 'Default: 10 random perturbations, each run 5 ticks forward' },
          { label: 'Perturbation', formula: 'pos += random(-2, 2); phase += random(-0.15, 0.15)', detail: 'Randomly nudge all player positions and phases' },
          { label: 'Measure', value: 'Final harmony after T ticks', detail: 'Each scenario produces one harmony value' },
          { label: 'Aggregate', formula: 'avg = Σ(harmony) / N; worst = min(); best = max()', detail: 'Summary statistics across all scenarios' },
          { label: 'State restore', value: 'Serialize → run → deserialize', detail: 'After all scenarios, kernel state is restored exactly to pre-simulation state' },
        ],
        conceptNote: 'Monte Carlo answers: "if random things happen in the next few seconds, how robust is our current shape?" A wide gap between best and worst means the team is in a fragile state — small perturbations lead to very different outcomes. A narrow range means stability.',
      }],
    }),

    states: () => ({
      title: 'Superposition States — Tactical Phases',
      sections: [{
        title: 'Phase System',
        color: 'text-slate-400',
        steps: [
          { label: 'defending', value: 'φ = 0', detail: 'Lowest phase angle. Players sit deep, maintain shape.' },
          { label: 'pressing', value: 'φ = 0.4π', detail: 'Active defensive effort. Moving forward to regain ball.' },
          { label: 'building', value: 'φ = 0.8π', detail: 'Possession play. Patient progression through midfield.' },
          { label: 'attacking', value: 'φ = 1.2π', detail: 'Final third play. Penetrating runs, creating chances.' },
          { label: 'transitioning', value: 'φ = 1.6π', detail: 'Between states. Rapid change after gaining/losing ball.' },
        ],
        conceptNote: 'The "superposition" metaphor: in quantum mechanics, a particle can be in multiple states simultaneously until measured. Here, a team is never purely in one phase — individuals are in different phases. The team\'s actual state is a superposition of all 11 individual phases. When phases align, the team "collapses" into a coherent tactical state. When they diverge, the team is in "quantum uncertainty" — unpredictable even to themselves.',
      }],
    }),

    predecision: () => ({
      title: 'PRE-DECISION OUTPUT — Actionable Intelligence',
      sections: [{
        title: 'What Makes It "Pre-Decision"',
        color: 'text-red-400',
        steps: [
          { label: 'Key concept', value: 'Before, not after', detail: 'Traditional analysis tells you what happened. This tells you what\'s ABOUT to happen.' },
          { label: 'Input sources', value: 'Insights + Monte Carlo + Drifts', detail: 'Combines qualitative insights with quantitative scenario analysis' },
          { label: 'Output format', value: 'Natural language + urgency', detail: '"Harmony dropping in midfield — shift phase now"' },
          { label: 'Action window', value: '3-6 seconds', detail: 'Drift detection gives this much warning before tactical collapse' },
        ],
        conceptNote: 'The entire BigDunc engine exists for this single purpose: to give coaches a 3-6 second warning before tactical breakdowns occur. Not analysis, not statistics — PREDICTION. The resonance model detects when the team\'s "wave function" is about to decohere, and surfaces that as a plain-language directive.',
      }],
    }),
  };

  const builder = explanations[nodeId];
  if (!builder) {
    return {
      title: nodeId,
      sections: [{ title: 'Node', color: 'text-white/60', steps: [{ label: 'No detailed explanation available for this node' }] }],
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
        color: 'text-amber-400',
        steps: [
          { label: 'Definition', value: '1 discrete time step', detail: 'The kernel advances by calling tick(Δt) where Δt = 1 second' },
          { label: 'Per tick', value: '4-step pipeline', detail: 'Attractors → Coulomb → Waves → Positions, then compute outputs' },
          { label: 'Simulation speed', value: 'Configurable', detail: 'Real-time = 1 tick/sec. Can run at 100ms, 200ms, 500ms, or 1000ms intervals.' },
        ],
      }],
    }),

    energy: () => ({
      title: 'Field Energy',
      liveValue: value,
      sections: [{
        title: 'Energy Computation',
        color: 'text-emerald-400',
        steps: [
          { label: 'Formula', formula: 'E = Σ(0.5 × |v|²) + Σ(A²)', detail: 'Kinetic energy (movement) + wave energy (amplitude squared)' },
          { label: 'Kinetic part', value: 'from velocity', detail: 'Fast-moving players contribute more kinetic energy' },
          { label: 'Wave part', value: 'from amplitude', detail: 'High-energy (fresh) players contribute more wave energy' },
        ],
        conceptNote: 'Energy decays naturally due to drag (v *= 0.85) and diffusion (A *= 0.998). A spike indicates counter-attack or pressing trigger. Gradual decline = fatigue accumulation.',
      }],
    }),

    entangled: () => ({
      title: 'Entangled Pairs',
      liveValue: value,
      sections: [{
        title: 'Entanglement Count',
        color: 'text-purple-400',
        steps: [
          { label: 'Computation', formula: 'For all C(11,2)=55 pairs: RBF(d, σ=20) × cos_similarity(φ)', detail: '55 possible player pairs evaluated every tick' },
          { label: 'Threshold', value: '> 0.30', detail: 'Correlation must exceed 30% to count as "entangled"' },
          { label: 'Ideal', value: '5-8 pairs', detail: 'Well-organized team has 5-8 entangled pairs (defensive unit, midfield triangle, etc.)' },
          { label: 'Fragmented', value: '0-2 pairs', detail: 'Critical — team has no coordinated units' },
        ],
      }],
    }),

    drifts: () => ({
      title: 'Active Drifts',
      liveValue: value,
      sections: [{
        title: 'Drift Monitoring',
        color: 'text-red-400',
        steps: [
          { label: '0 drifts', value: 'Stable', detail: 'Team shape is holding, harmony is steady or rising' },
          { label: '1-2 drifts', value: 'Warning', detail: 'A zone or global harmony is declining — monitor closely' },
          { label: '3+ drifts', value: 'Critical', detail: 'Multiple zones collapsing simultaneously — immediate tactical intervention needed' },
          { label: 'Collapse timer', value: '1-10s', detail: 'Each drift has a predicted time-to-collapse' },
        ],
      }],
    }),
  };

  const builder = stats[statId];
  if (!builder) return { title: statId, sections: [] };
  return builder();
}
