# Polymath Secret Detection: Newton, Von Neumann, Leonardo

**Date:** 2026-04-10
**Author:** Investigation in collaboration with user
**Status:** Design approved, ready for implementation

## Background

Prior work in this repository has established a cross-era structural detection method for technical document corpora. Key results:

1. **Tesla investigation**: BTUT's medium-resolution lattice variance flagged US1119732 as uniquely anomalous in the Tesla corpus. Deep reading revealed the Wardenclyffe patent contains the "T/4 energy transfer" and "free oscillations" language consistent with Zenneck surface wave physics, which wasn't theoretically described until 1907.

2. **Keyword discriminator validation**: 96% classification accuracy across three independent technical domains (wireless physics, cryptography, information theory) using vocabulary-pattern analysis alone.

3. **BTUT heterogeneous lattice validation**: 25/25 top anomalies in a 1851-entity heterogeneous corpus were canonical markers of their respective physics/mathematics regimes, demonstrating zero-shot regime detection via lattice fingerprints.

The next step is to apply this proven methodology to find **Tesla-style secrets** — bounded, verifiable claims readable from public-domain sources — in the work of three historical polymaths: Isaac Newton, John von Neumann, and Leonardo da Vinci.

## Goal

For each of the three polymaths, identify at least one document that:
1. BTUT flags as uniquely anomalous at the medium resolution
2. When read carefully, contains specific passages/values/designs ahead of its era
3. Shares lattice fingerprints with a modern descendant in the same paradigm
4. Is independently classified into the modern paradigm regime by the keyword discriminator

A successful outcome is one verifiable "secret" per figure, documented with the specific passage, the modern descendant match, and the bounded claim.

## Paradigm Focus (Approved)

Each polymath is investigated through their **forgotten paradigm** — the area of their work most analogous to Tesla's Wardenclyffe surface wave work. These are areas where the figure was demonstrably ahead of their era and where modern connections have not been systematically drawn.

| Polymath | Forgotten paradigm | Why this paradigm |
|---|---|---|
| **Isaac Newton** | Alchemy | ~1 million words of manuscripts, only systematically published 1991-present. Known to contain reproducible chemistry. Maximum signal-to-noise for "hidden" content. |
| **John von Neumann** | Cellular automata / self-reproducing machines | Manuscript unfinished at death, published posthumously 1966. Anticipates Conway (1970), Wolfram (1983), modern complexity theory, DNA computing, swarm robotics. |
| **Leonardo da Vinci** | Flight mechanics + hydraulics | Notebook observations of turbulence and aerodynamics anticipate Reynolds, Navier-Stokes, modern rotor design. Parachute design tested and worked in 2000. |

## Corpus Construction

### Entity types (heterogeneous — matches the 6-type heterogeneous BTUT run that produced 25/25 canonical markers)

- **book_chunk** / **paper_chunk** / **manuscript_chunk**: document text split at 12-15 word boundaries
- **writing**: named works (Principia, Theory of Games, Codex on Flight of Birds, etc.)
- **person**: historical figures + modern researchers in descendant paradigms
- **concept**: key ideas from each paradigm (phlogiston, self-replication, lift coefficient, etc.)
- **event**: major milestones (Principia publication, EDVAC report, Leonardo's death, etc.)
- **location**: relevant places (Cambridge, Los Alamos, Milan, etc.)

### Source material per figure

**Newton corpus**:
- Principia (English translation, passages on mechanics, gravity, cooling)
- Opticks (passages on light, color, spectrum)
- Method of Fluxions (calculus passages)
- Alchemical manuscripts (via Chymistry of Isaac Newton Project, Indiana University)
- Keynes MS 28, Keynes MS 18 (alchemical), Index Chemicus
- Modern descendants: Lagrangian mechanics texts, materials science papers, chemistry of transition metals

**Von Neumann corpus**:
- *Theory of Self-Reproducing Automata* (1966, posthumous, Arthur Burks edition)
- *First Draft Report on the EDVAC* (1945)
- *Mathematical Foundations of Quantum Mechanics* (1932)
- *Theory of Games and Economic Behavior* (1944)
- Modern descendants: Wolfram *A New Kind of Science*, Conway's Game of Life papers, modern GPU architecture patents, DNA computing research papers

**Leonardo corpus**:
- *Codex on the Flight of Birds* (translated)
- *Codex Atlanticus* (relevant hydraulics + engineering passages, translated)
- Selected notebook passages (anatomy, optics, fluid dynamics)
- Modern descendants: Reynolds' 1883 paper on turbulence, modern rotor dynamics papers, Navier-Stokes-era fluid dynamics texts, NASA rotor design reports

### Controls

- **Polymath-internal controls**: For each figure, include documents from OTHER paradigms they worked in (Newton's theology, Leonardo's art theory, Von Neumann's Monte Carlo). These should cluster SEPARATELY from the target paradigm.
- **Cross-figure controls**: Documents from each figure's mainstream paradigm should NOT match the other figures' forgotten paradigms.
- **Unrelated-era controls**: Random modern patents from unrelated fields (should be distant from all polymath chunks).

### Size target

~40-60 source documents, aggressive chunking to ~1500-2500 entities, ~200 heterogeneous non-chunk entities (persons, concepts, events, locations). Matches the heterogeneous corpus that produced the 25/25 canonical marker result.

## Method (Replicates the Proven Tesla Pattern)

### Stage 1: Corpus acquisition (parallel agents)
Dispatch parallel research agents to fetch full-text or representative passages for each polymath's forgotten paradigm work + modern descendants. Save to `scripts/cross_era_analysis/documents/` with consistent naming.

### Stage 2: Heterogeneous entity generation
Extend `build_heterogeneous_corpus.py` to include the new polymath regimes:
- `newton_alchemy`, `newton_mechanics`, `newton_optics`, `newton_theology_control`
- `vn_cellular_automata`, `vn_computing`, `vn_game_theory`, `vn_quantum`
- `leonardo_flight`, `leonardo_fluids`, `leonardo_anatomy`, `leonardo_art_control`
- Plus modern descendant regimes: `modern_materials`, `modern_complexity`, `modern_aerodynamics`, etc.

### Stage 3: Aggressive chunking
Use the existing `chunk_aggressive.py` (12-15 word chunks) to convert source texts into ~1500-2500 entities.

### Stage 4: BTUT standalone run
Use `run_heterogeneous_btut.py` pattern. Deploy to production worker, invoke `run_btut_pipeline` directly, pull results.

### Stage 5: Per-figure anomaly extraction
For each polymath, extract the top 10-15 BTUT anomalies (highest composite scores). Identify which documents from their forgotten paradigm appear in the top anomalies.

### Stage 6: Deep reading for smoking guns
For each flagged document, perform a detailed textual analysis looking for:
- Specific numerical values, dimensions, frequencies, proportions
- Named concepts that only got formal treatment centuries later
- Procedural descriptions that match modern reproducible processes
- Cross-references to other flagged documents

### Stage 7: Cross-era fingerprint verification
Compare lattice fingerprints of each flagged polymath document against modern descendants. Confirm structural match above noise threshold.

### Stage 8: Keyword discriminator independent verification
Run the keyword discriminator (with expanded paradigm-specific keyword groups) on the same flagged documents. Confirm independent regime classification.

### Stage 9: Bounded claim formulation
For each figure, write a 3-5 sentence bounded claim of the form:
> "[Figure name]'s [specific document name] contains [specific passage/value/design] that structurally matches modern [descendant paradigm]. Both the BTUT lattice engine and the keyword discriminator independently identify this document as belonging to the modern paradigm regime. The modern paradigm was not formally theorized until [date], [N] years after the original writing."

## Predictions To Test

1. **Newton alchemy prediction**: At least one alchemical manuscript passage structurally matches modern materials science / transition metal chemistry vocabulary. The smoking gun is likely a specific procedure or ratio that matches a modern reaction.

2. **Von Neumann cellular automata prediction**: *Theory of Self-Reproducing Automata* passages share fingerprints with modern complexity theory papers. Specific candidates: passages on universal constructor design, self-description/Quine-like behavior, growth rules.

3. **Leonardo fluids prediction**: Codex Atlanticus hydraulics passages share fingerprints with modern turbulence research. Specific candidates: his descriptions of eddies and their interaction, prefiguring vortex dynamics.

4. **Cross-figure independence**: Each figure's top anomalies should be concentrated in their OWN forgotten paradigm, not in the other figures' paradigms. This rules out a generic "old text" artifact.

5. **Control regime rejection**: Newton's theology, Leonardo's art theory, Von Neumann's Monte Carlo (the control paradigms) should NOT appear in the top anomalies for their respective figures.

## Success Criteria

**Minimum success (publishable result)**: One figure produces a bounded verifiable claim where BTUT + keyword discriminator independently agree and the smoking gun is specific.

**Target success**: All three figures produce bounded verifiable claims with independent dual-method validation.

**Stretch success**: The specific smoking guns are genuinely novel (not in widely-cited historical scholarship) and would be newsworthy in their own right.

## Scope and Time

Realistic estimate: 3-5 extended turns of work. Parallel agent dispatching for corpus acquisition (parallelizable), sequential for analysis and deep reading. Document count ~40-60 source texts, final corpus size ~1500-2500 entities.

## What Could Kill The Investigation

1. **Insufficient source access**: If primary sources (especially Newton's alchemical manuscripts and Leonardo's notebooks) aren't readily accessible via WebFetch, the corpus may be too thin for BTUT to find a strong signal.

2. **Translation artifacts**: Leonardo's mirror-writing + multiple translation layers may add noise that dominates the signal. Mitigation: use standard scholarly translations, not auto-translated text.

3. **No anomaly separation**: If BTUT flags chunks from all three figures at similar rates without paradigm concentration, the result is null and has to be reported honestly.

4. **Confabulated smoking guns**: The deep reading stage must use ACTUAL text passages from verifiable sources. Any claim that cannot be traced to a specific line of a specific published document must be rejected.

## Artifacts To Produce

- `scripts/cross_era_analysis/documents/` — 40+ new text files
- `scripts/cross_era_analysis/build_polymath_corpus.py` — extended heterogeneous builder
- `scripts/cross_era_analysis/output/polymath_btut_result.json` — BTUT output
- `scripts/cross_era_analysis/analyze_polymath_anomalies.py` — per-figure analysis
- `docs/findings/2026-04-10-newton-secret.md` — bounded claim with citations
- `docs/findings/2026-04-10-vonneumann-secret.md` — bounded claim with citations
- `docs/findings/2026-04-10-leonardo-secret.md` — bounded claim with citations

## Approval Status

User approved framing, paradigm focus, and scope on 2026-04-10. Ready to transition to implementation via writing-plans skill.
