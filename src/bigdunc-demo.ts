/**
 * BigDunc Engine — Demo Runner
 *
 * Initializes the resonance kernel with 11 players in a 4-3-3 formation,
 * adds tactical/ball attractors, runs 10 ticks with autonomous twins,
 * and logs harmony, coherence, entanglements, and insights.
 *
 * Run: npx tsx src/bigdunc-demo.ts
 */

import { ResonanceKernel, PlayerPhase } from './lib/resonance-kernel';
import { AutonomousTwin } from './lib/autonomous-twin';
import { DataSubstrate } from './lib/catapult-data-substrate';
import { insightFromKernel } from './lib/resonance-insight';

// ======================== Formation: 4-3-3 ========================

interface PlayerSetup {
  id: string;
  x: number;
  y: number;
  state: PlayerPhase;
  load: number;
}

const formation433: PlayerSetup[] = [
  // GK
  { id: 'GK',  x: 5,  y: 34, state: 'defending',  load: 30 },
  // Defenders
  { id: 'LB',  x: 20, y: 10, state: 'defending',  load: 55 },
  { id: 'CB1', x: 18, y: 28, state: 'defending',  load: 50 },
  { id: 'CB2', x: 18, y: 40, state: 'defending',  load: 50 },
  { id: 'RB',  x: 20, y: 58, state: 'defending',  load: 55 },
  // Midfield
  { id: 'CM1', x: 40, y: 22, state: 'building',   load: 65 },
  { id: 'CM2', x: 42, y: 34, state: 'building',   load: 70 },
  { id: 'CM3', x: 40, y: 46, state: 'building',   load: 65 },
  // Forwards
  { id: 'LW',  x: 70, y: 12, state: 'attacking',  load: 75 },
  { id: 'ST',  x: 78, y: 34, state: 'attacking',  load: 80 },
  { id: 'RW',  x: 70, y: 56, state: 'attacking',  load: 75 },
];

// ======================== Main ========================

function main(): void {
  console.log('═══════════════════════════════════════════════════');
  console.log('  BigDunc Resonance Engine — Demo Run');
  console.log('═══════════════════════════════════════════════════\n');

  // 1. Init kernel
  const kernel = new ResonanceKernel();

  // 2. Add players
  for (const p of formation433) {
    kernel.addPlayer(p.id, p.x, p.y, p.state, p.load);
  }
  console.log(`✓ Added ${formation433.length} players (4-3-3 formation)\n`);

  // 3. Add attractors
  kernel.addAttractor('ball', 52, 34, 15, 0.8);       // Ball at center
  kernel.addAttractor('tactical', 35, 34, 25, 0.6);   // Shape anchor midfield
  kernel.addAttractor('defensive', 18, 34, 20, 0.5);  // Defensive block center
  kernel.addAttractor('offensive', 75, 34, 18, 0.4);   // Attacking third pull
  kernel.addAttractor('space', 60, 15, 12, 0.3);       // Open space left channel
  console.log('✓ Added 5 field attractors (ball, tactical, defensive, offensive, space)\n');

  // 4. Init autonomous twins
  const twins = new Map<string, AutonomousTwin>();
  for (const p of formation433) {
    twins.set(p.id, new AutonomousTwin(p.id));
  }

  // 5. Init data substrate (demo)
  const substrate = new DataSubstrate();
  const sampleFrame = substrate.getSampleFrame();
  console.log(`✓ Data substrate: ${sampleFrame.players.length} player frames ingested`);
  const baselines = substrate.getBaselines();
  console.log(`✓ Baselines computed for ${baselines.length} players\n`);

  // 6. Simulate awareness from sample data
  for (const np of sampleFrame.players) {
    const twin = twins.get(np.id);
    if (twin) {
      twin.updateAwareness({
        ballDist: Math.sqrt((np.x - 52) ** 2 + (np.y - 34) ** 2),
        nearestOpponentDist: 5 + Math.random() * 15,
        nearestTeammateDist: 3 + Math.random() * 10,
        openSpaceRadius: 4 + Math.random() * 10,
      });
    }
  }

  // 7. Run simulation: 10 ticks
  console.log('───────────────────────────────────────────────────');
  console.log('  Simulation: 10 ticks (1s each)');
  console.log('───────────────────────────────────────────────────\n');

  for (let t = 0; t < 10; t++) {
    // Twins evaluate + execute
    const preOutput = kernel.tick(1);
    for (const [id, twin] of twins) {
      const result = twin.evaluateIntent(preOutput, kernel);
      twin.executeIntent(kernel);
    }

    // Get post-twin output
    const output = kernel.tick(1);

    // Insights
    const insights = insightFromKernel(output);

    console.log(`Tick ${output.tick}  |  Harmony: ${(output.harmony * 100).toFixed(1)}%  |  Energy: ${output.fieldEnergy.toFixed(2)}  |  Entangled: ${output.entanglements.length} pairs`);

    // Show drifts
    for (const drift of output.drifts) {
      console.log(`  ⚠ DRIFT [${drift.region}] severity=${drift.severity.toFixed(2)} collapse_in=${drift.timeToCollapse.toFixed(1)}s — ${drift.description}`);
    }

    // Show critical/warning insights
    for (const ins of insights.filter(i => i.level !== 'info')) {
      console.log(`  ${ins.level === 'critical' ? '🔴' : '🟡'} ${ins.message}`);
    }

    // Show twin intents every 3 ticks
    if ((t + 1) % 3 === 0) {
      console.log('  Twin intents:');
      for (const [id, twin] of twins) {
        console.log(`    ${id.padEnd(4)} → ${twin.getCurrentIntent().padEnd(22)} (${(twin.getConfidence() * 100).toFixed(0)}% conf)`);
      }
    }
    console.log('');
  }

  // 8. Final summary
  console.log('───────────────────────────────────────────────────');
  console.log('  Final State');
  console.log('───────────────────────────────────────────────────\n');

  const finalOutput = kernel.getHistory().at(-1)!;
  console.log(`Harmony: ${(finalOutput.harmony * 100).toFixed(1)}%`);
  console.log(`Field Energy: ${finalOutput.fieldEnergy.toFixed(2)}`);
  console.log(`Entangled Pairs: ${finalOutput.entanglements.length}`);

  console.log('\nPlayer Coherence:');
  for (const [id, coh] of Object.entries(finalOutput.players)) {
    console.log(`  ${id.padEnd(4)}  density=${coh.density.toFixed(3)}  phase_align=${coh.phaseAlignment.toFixed(3)}  coherence=${coh.coherenceScore.toFixed(3)}`);
  }

  console.log('\nTop Entanglements:');
  for (const ent of finalOutput.entanglements.slice(0, 5)) {
    console.log(`  ${ent.playerA} ↔ ${ent.playerB}  correlation=${ent.correlation.toFixed(3)}`);
  }

  // 9. Monte Carlo what-if
  console.log('\n───────────────────────────────────────────────────');
  console.log('  Monte Carlo What-If (20 scenarios, 5 ticks ahead)');
  console.log('───────────────────────────────────────────────────\n');

  const mc = kernel.monteCarloWhatIf(20, 5);
  console.log(`Avg Harmony:  ${(mc.avgHarmony * 100).toFixed(1)}%`);
  console.log(`Best Case:    ${(mc.bestCase * 100).toFixed(1)}%`);
  console.log(`Worst Case:   ${(mc.worstCase * 100).toFixed(1)}%`);

  // 10. Final insights
  console.log('\n───────────────────────────────────────────────────');
  console.log('  All Insights (Final Tick)');
  console.log('───────────────────────────────────────────────────\n');

  const allInsights = insightFromKernel(finalOutput);
  for (const ins of allInsights) {
    const icon = ins.level === 'critical' ? '🔴' : ins.level === 'warning' ? '🟡' : '🟢';
    console.log(`${icon} ${ins.message}`);
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  BigDunc Engine demo complete.');
  console.log('═══════════════════════════════════════════════════');
}

main();
