# Polymath Secret Detection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Apply the validated cross-era detection method (BTUT lattice + keyword discriminator) to the forgotten paradigms of Newton (alchemy), Von Neumann (cellular automata), and Leonardo (flight/fluids) to find Tesla-style bounded, verifiable secrets.

**Architecture:** Extend the existing `scripts/cross_era_analysis/` pipeline with polymath-specific documents and regime definitions. Reuse `run_heterogeneous_btut.py` for BTUT execution and `analyze_heterogeneous_btut.py` for anomaly extraction. Deep-read top anomalies for smoking guns, cross-validate with keyword discriminator, document bounded claims in `docs/findings/`.

**Tech Stack:** Python 3.11, numpy, existing BTUT engine on production (Docker-deployed at 32.192.140.145), existing keyword discriminator scripts, parallel research agents for corpus acquisition.

**Reference design doc:** `docs/plans/2026-04-10-polymath-secret-detection-design.md`

---

## Phase 1: Corpus Acquisition (Parallel Dispatch)

### Task 1: Dispatch Newton corpus agent

**Files:**
- Create: `scripts/cross_era_analysis/documents/newton_*.txt` (via agent)

**Step 1: Launch general-purpose agent in background**

Dispatch a research agent with this specific brief:

```
Goal: Retrieve text content for a cross-era structural detection
experiment on Isaac Newton's forgotten paradigm (alchemy), with additional
mainstream paradigm controls.

Required documents (save to C:\Users\diren\Desktop\lsx-latentocean\scripts\cross_era_analysis\documents\):

1. newton_alchemy_keynes28.txt — Keynes MS 28 "Praxis" alchemical manuscript
   (via Chymistry of Isaac Newton Project at Indiana University
   http://webapp1.dlib.indiana.edu/newton/)
2. newton_alchemy_keynes18.txt — Keynes MS 18 or another accessible alchemical text
3. newton_alchemy_clavis.txt — The "Clavis" (Key) manuscript if accessible
4. newton_principia_mechanics.txt — Principia excerpts on mechanics/gravity
   (Book 1 definitions, laws of motion, universal gravitation)
5. newton_opticks_light.txt — Opticks excerpts on light, color, prisms
6. newton_theology_control.txt — Apocalyptic/theological writings as control
   (e.g., "Observations upon the Prophecies of Daniel")

For each file, save 1000-3000 words of actual text content (or a dense paraphrased
summary if full text isn't accessible). Include a 2-line header with:
- Source name and date
- URL or citation

Use WebFetch against:
- http://webapp1.dlib.indiana.edu/newton/
- https://archive.org/ for public domain scans
- https://en.wikisource.org/ for standard translations
- Specific alchemical manuscript databases

Report filenames saved and approximate word counts. Report any documents that
could not be retrieved and why.
```

**Expected output:** 4-6 text files in documents/ directory, each 1000-3000 words.

**Step 2: Note the agent ID for progress tracking**

**Step 3: Continue to next task (parallel dispatch) — do NOT wait for completion**

---

### Task 2: Dispatch Von Neumann corpus agent

**Files:**
- Create: `scripts/cross_era_analysis/documents/vonneumann_*.txt` (via agent)

**Step 1: Launch second general-purpose agent in parallel**

```
Goal: Retrieve text content for a cross-era structural detection
experiment on John von Neumann's forgotten paradigm (cellular automata
and self-reproducing machines) and mainstream paradigm controls.

Required documents (save to C:\Users\diren\Desktop\lsx-latentocean\scripts\cross_era_analysis\documents\):

1. vn_self_reproducing_automata.txt — Theory of Self-Reproducing Automata
   (published 1966, edited by Arthur Burks). Focus on the universal
   constructor chapter, the 29-state cellular automaton, and the
   description of self-description / quine-like behavior.
2. vn_edvac_report.txt — First Draft of a Report on the EDVAC (1945).
   Focus on the logical architecture, memory hierarchy, stored-program
   concept.
3. vn_mathematical_foundations_qm.txt — Mathematical Foundations of
   Quantum Mechanics (1932). Focus on the measurement problem and
   the Hilbert space formalism.
4. vn_theory_of_games.txt — Theory of Games and Economic Behavior
   (1944), with Morgenstern. Focus on minimax theorem, expected utility,
   coalition theory.
5. vn_monte_carlo_control.txt — Monte Carlo method papers (control —
   should cluster separately from CA work).

For each file, save 1500-3000 words of actual text content. Use:
- https://cba.mit.edu/events/03.11.ASE/docs/VonNeumann.pdf
- https://archive.org/details/theoryofselfrepr00vonn
- https://archive.org/details/theoryofgamesand030098mbp
- https://library.si.edu/digital-library/book/firstdraftofrepo00vonn
- Other public domain sources

Report filenames saved, word counts, and any documents that could not
be retrieved.
```

**Step 2: Note agent ID**

**Step 3: Continue to next task**

---

### Task 3: Dispatch Leonardo corpus agent

**Files:**
- Create: `scripts/cross_era_analysis/documents/leonardo_*.txt` (via agent)

**Step 1: Launch third general-purpose agent in parallel**

```
Goal: Retrieve text content for a cross-era structural detection
experiment on Leonardo da Vinci's forgotten paradigm (flight mechanics,
hydraulics, fluid dynamics) and mainstream paradigm controls.

Required documents (save to C:\Users\diren\Desktop\lsx-latentocean\scripts\cross_era_analysis\documents\):

1. leonardo_codex_flight_of_birds.txt — Codex on the Flight of Birds
   (1505). Text passages describing bird flight mechanics, wing motion,
   air pressure observations, the aerial screw sketch notes.
2. leonardo_hydraulics_notebooks.txt — Hydraulics and fluid motion
   passages from Codex Atlanticus and Codex Leicester. Focus on his
   observations about turbulence, eddies, water in motion, vortex
   patterns. Leonardo was the first to name and describe turbulenza.
3. leonardo_anatomy_notes.txt — Anatomical drawings and notes focused
   on biomechanical observations (heart valves, tendon structures,
   bone articulation). These anticipate modern biomechanics.
4. leonardo_optics_light.txt — Notebook passages on light, shadow,
   and perspective (control for optics paradigm).
5. leonardo_art_control.txt — Paragone / paintings theory (control —
   should cluster separately from engineering work).

Use these sources:
- https://www.loc.gov/collections/finding-our-place-in-the-cosmos-with-leonardo-da-vinci/articles-and-essays/leonardo-da-vinci-a-man-of-both-worlds/
- https://www.gutenberg.org/ebooks/5000 (Notebooks of Leonardo da Vinci,
  edited by Jean Paul Richter — 2 volumes, public domain)
- https://en.wikisource.org/wiki/Index:The_Notebooks_of_Leonardo_Da_Vinci.djvu
- https://archive.org/details/notebooksofleona01leon (Richter translation)

The Richter translation on Project Gutenberg (5000.txt) is the most
comprehensive public domain source. Fetch that file and extract relevant
passages by subject matter.

Report filenames saved, word counts, and sources used.
```

**Step 2: Note agent ID**

**Step 3: Continue to next task**

---

### Task 4: Dispatch modern descendants agent

**Files:**
- Create: `scripts/cross_era_analysis/documents/modern_*.txt` (via agent)

**Step 1: Launch fourth general-purpose agent in parallel**

```
Goal: Retrieve modern descendant paradigm documents for cross-era
structural matching against historical polymath work.

Required documents (save to C:\Users\diren\Desktop\lsx-latentocean\scripts\cross_era_analysis\documents\):

FOR NEWTON'S ALCHEMY PARADIGM - modern materials science / transition metals:
1. modern_materials_transition_metals.txt — Overview of transition metal
   chemistry: oxidation states, ligand field theory, coordination complexes.
   Any modern chemistry textbook excerpt will do.
2. modern_materials_phase_transitions.txt — Modern phase transition theory:
   first order, second order, critical phenomena.

FOR VON NEUMANN'S CELLULAR AUTOMATA - modern complexity / DNA computing:
3. modern_wolfram_new_kind_of_science.txt — Summary of Wolfram's
   classification of cellular automata (Classes 1-4, computational
   irreducibility). Available from wolframscience.com or Wikipedia.
4. modern_conway_game_of_life.txt — Description of Conway's Game of Life,
   glider guns, universal constructors, Turing completeness results.
5. modern_dna_computing.txt — Adleman's DNA computing paper summary
   (1994) or any modern DNA/molecular computing paper.

FOR LEONARDO'S FLIGHT/FLUIDS - modern aerodynamics / turbulence:
6. modern_reynolds_turbulence.txt — Reynolds' 1883 "An Experimental
   Investigation of the Circumstances..." paper summary, or modern
   turbulence theory overview.
7. modern_rotor_aerodynamics.txt — Modern helicopter rotor design
   principles, vortex dynamics, lift generation.
8. modern_navier_stokes.txt — Overview of Navier-Stokes equations,
   their development, modern computational fluid dynamics.

For each file, save 1000-2500 words of actual content. Use:
- Wikipedia for established scientific topics (fine for this purpose,
  will be content-rich)
- arXiv for modern technical papers
- Textbook excerpts where accessible

Report filenames and word counts.
```

**Step 2: Note agent ID**

**Step 3: Monitor all four agents, proceeding to Task 5 once at least three have completed**

---

## Phase 2: Corpus Processing

### Task 5: Verify all documents saved

**Files:**
- Check: `scripts/cross_era_analysis/documents/*.txt`

**Step 1: List all polymath-related files**

```bash
ls "C:/Users/diren/Desktop/lsx-latentocean/scripts/cross_era_analysis/documents/" | grep -E "newton|vn_|vonneumann|leonardo|modern_materials|modern_wolfram|modern_conway|modern_dna|modern_reynolds|modern_rotor|modern_navier"
```

**Step 2: Count files per category**

Expected:
- Newton: 4-6 files
- Von Neumann: 4-5 files
- Leonardo: 4-5 files
- Modern descendants: 6-8 files
- Total new files: 18-24

**Step 3: Report any missing documents and decide whether to re-dispatch**

If >25% of expected documents are missing, dispatch a follow-up agent. Otherwise proceed with what's available.

---

### Task 6: Extend manifest.json

**Files:**
- Modify: `scripts/cross_era_analysis/documents/manifest.json`

**Step 1: Read current manifest**

**Step 2: Append polymath entries**

For each saved polymath document, add a manifest entry:

```json
{
  "id": "newton_alchemy_keynes28",
  "title": "Keynes MS 28 Praxis (Newton, c. 1695)",
  "year": 1695,
  "type": "newton_alchemy",
  "file": "newton_alchemy_keynes28.txt"
}
```

Use these regime tags:
- `newton_alchemy`, `newton_mechanics`, `newton_optics`, `newton_theology_control`
- `vn_cellular_automata`, `vn_computing`, `vn_quantum`, `vn_game_theory`, `vn_monte_carlo_control`
- `leonardo_flight`, `leonardo_fluids`, `leonardo_anatomy`, `leonardo_optics_control`, `leonardo_art_control`
- `modern_materials`, `modern_complexity`, `modern_dna_computing`, `modern_aerodynamics`, `modern_fluid_dynamics`

**Step 3: Commit the updated manifest**

```bash
cd "C:/Users/diren/Desktop/lsx-latentocean"
git add scripts/cross_era_analysis/documents/manifest.json
git commit -m "Add polymath corpus manifest entries"
```

---

### Task 7: Extend the heterogeneous entity generator

**Files:**
- Create: `scripts/cross_era_analysis/build_polymath_entities.py`

**Step 1: Write the polymath entity generator**

Create a new Python file that defines heterogeneous entities (persons, concepts, events, locations) for each polymath regime. Follow the same structure as `build_heterogeneous_corpus.py`.

Structure:

```python
POLYMATH_ENTITIES = {
    "newton_alchemy": {
        "persons": [
            ("Isaac Newton", "English physicist, mathematician, and alchemist"),
            ("Robert Boyle", "Predecessor chemist whose work Newton studied"),
            ("George Starkey", "Alchemist whose manuscripts Newton copied extensively"),
        ],
        "locations": [
            ("Trinity College Cambridge", "Newton's alchemical laboratory location"),
            ("The Royal Mint", "Where Newton served as Warden and Master"),
        ],
        "concepts": [
            ("Philosophical Mercury", "Alchemical substance Newton sought to prepare"),
            ("Green Lion", "Alchemical symbol for a specific reagent"),
            ("Transmutation", "The alchemical transformation of base metals to gold"),
            ("Philosopher's Stone", "The mythical substance enabling transmutation"),
        ],
        "events": [
            ("Newton begins alchemical studies", "c. 1669, shortly after receiving his degree"),
            ("Newton's Praxis manuscript", "c. 1695, late alchemical synthesis"),
        ],
        "writings": [
            ("Keynes MS 28 Praxis", "Newton's alchemical synthesis manuscript"),
            ("Index Chemicus", "Newton's alphabetical index of alchemical terms"),
        ],
    },
    # ... add vn_cellular_automata, leonardo_flight, etc.
}
```

**Step 2: Save the file and run it to generate entities**

**Step 3: Commit**

```bash
git add scripts/cross_era_analysis/build_polymath_entities.py
git commit -m "Add polymath heterogeneous entity generator"
```

---

### Task 8: Run combined corpus builder

**Files:**
- Create: `scripts/cross_era_analysis/output/polymath_corpus.json`

**Step 1: Chunk all new polymath documents (15 words per chunk)**

Reuse the chunker from `chunk_aggressive.py`. Target: 1000-2000 new entities from the polymath corpus.

**Step 2: Combine with existing heterogeneous corpus**

Merge chunks + polymath entities into a single `polymath_corpus.json` file with entities + relationships.

**Step 3: Verify entity count >1500 for BTUT activation**

```bash
python -c "import json; d=json.load(open('output/polymath_corpus.json')); print('entities:', len(d['entities']), 'relationships:', len(d['relationships']))"
```

Expected: 1500+ entities, 1000+ relationships.

**Step 4: Commit the generated corpus**

---

## Phase 3: BTUT Run

### Task 9: Upload corpus to production worker

**Files:**
- Upload: `output/polymath_corpus.json` to production

**Step 1: SCP corpus file to EC2**

```bash
scp -i "C:/Users/diren/Downloads/latentocean-key.pem" "scripts/cross_era_analysis/output/polymath_corpus.json" ubuntu@32.192.140.145:/tmp/
```

**Step 2: Copy into worker container**

```bash
ssh -i "C:/Users/diren/Downloads/latentocean-key.pem" ubuntu@32.192.140.145 \
  "cd /opt/latentocean && docker compose cp /tmp/polymath_corpus.json worker:/app/scripts/polymath_corpus.json"
```

**Step 3: Verify file present in container**

---

### Task 10: Run standalone BTUT on polymath corpus

**Files:**
- Create: `scripts/cross_era_analysis/run_polymath_btut.py`
- Output: `/tmp/polymath_btut_result.json` on production

**Step 1: Create the runner script**

Mirror `run_heterogeneous_btut.py` but point at `polymath_corpus.json`:

```python
import json, time, sys
sys.path.insert(0, "/app")
from app.services.btut.pipeline import run_btut_pipeline

with open("/app/scripts/polymath_corpus.json", "r") as f:
    data = json.load(f)

entities = data["entities"]
edges = data["relationships"]
unique_types = list(set(e.get("type", "unknown") for e in entities))
print(f"Loaded {len(entities)} entities, {len(edges)} edges, types={unique_types}")

t0 = time.time()
result = run_btut_pipeline(
    entities=entities,
    edges=edges,
    unique_types=unique_types,
    target_survivors=600,
    progress_callback=lambda msg: print(f"  [{time.time()-t0:.1f}s] {msg}"),
)

print(f"Complete in {time.time()-t0:.1f}s")
print(f"Survivors: {len(result.get('survivors', []))}")
print(f"Summary: {result.get('summary', {})}")

with open("/tmp/polymath_btut_result.json", "w") as f:
    json.dump(result, f, default=str)
```

**Step 2: SCP and copy into worker**

**Step 3: Execute**

```bash
ssh -i "C:/Users/diren/Downloads/latentocean-key.pem" ubuntu@32.192.140.145 \
  "cd /opt/latentocean && docker compose exec -T worker python /app/scripts/run_polymath_btut.py"
```

**Step 4: Verify success**

Expected output:
- "Loaded N entities, M edges"
- "Resolution 4/8/16: flip_rate=..., unique_fp=..."
- "Combined: 48-bit fingerprint, X unique patterns"
- "Clusters: Y"
- "Selected: Z survivors"

If unique_fp count is <200 or clusters <20, BTUT may not have enough signal. Re-evaluate corpus size.

---

### Task 11: Pull BTUT result locally

**Files:**
- Create: `scripts/cross_era_analysis/output/polymath_btut_result.json`

**Step 1: Copy from worker to host**

```bash
ssh -i "C:/Users/diren/Downloads/latentocean-key.pem" ubuntu@32.192.140.145 \
  "docker compose -f /opt/latentocean/docker-compose.yml cp worker:/tmp/polymath_btut_result.json /tmp/polymath_btut_result.json"
```

**Step 2: SCP to local**

```bash
scp -i "C:/Users/diren/Downloads/latentocean-key.pem" ubuntu@32.192.140.145:/tmp/polymath_btut_result.json \
  "scripts/cross_era_analysis/output/polymath_btut_result.json"
```

**Step 3: Verify file size and structure**

```bash
python -c "import json; d=json.load(open('scripts/cross_era_analysis/output/polymath_btut_result.json')); print('survivors:', len(d['survivors']), 'summary:', d['summary'])"
```

---

## Phase 4: Analysis

### Task 12: Extract per-figure anomalies

**Files:**
- Create: `scripts/cross_era_analysis/analyze_polymath_anomalies.py`

**Step 1: Write analysis script that for each polymath identifies:**

1. Top 10 highest-composite survivors in their regimes
2. Which regime (alchemy vs mechanics vs optics etc.) contains the most anomalies
3. Cross-era fingerprint overlap with modern descendants
4. Cluster composition for polymath entities

Follow the pattern from `analyze_heterogeneous_btut.py`.

**Step 2: Run it**

```bash
python scripts/cross_era_analysis/analyze_polymath_anomalies.py
```

**Step 3: Save output to `output/polymath_anomalies_report.json`**

---

### Task 13: Extend keyword discriminator for polymath regimes

**Files:**
- Create: `scripts/cross_era_analysis/polymath_discriminator.py`

**Step 1: Define paradigm-specific keyword groups**

```python
POLYMATH_KEYWORDS = {
    # Newton alchemy
    "alch_transmutation": ["transmutation", "transmute", "base metal", "gold", "philosopher's stone"],
    "alch_mercury": ["mercury", "quicksilver", "philosophical mercury", "green lion"],
    "alch_procedure": ["calcination", "sublimation", "putrefaction", "fixation", "projection"],

    # Modern materials (Newton alchemy descendants)
    "mat_transition_metals": ["transition metal", "oxidation state", "ligand", "coordination complex"],
    "mat_phase_transition": ["phase transition", "critical point", "order parameter"],

    # Von Neumann CA
    "vn_self_reproduction": ["self-reproduction", "self-replication", "universal constructor", "self-description"],
    "vn_state_machine": ["state machine", "finite automaton", "cellular", "automaton"],

    # Modern complexity (VN CA descendants)
    "comp_cellular_automata": ["cellular automata", "game of life", "glider", "wolfram class"],
    "comp_emergence": ["emergence", "emergent", "complexity class", "computational irreducibility"],

    # Leonardo flight/fluids
    "leo_flight": ["wing", "flight", "bird", "aerial screw", "lift", "air pressure"],
    "leo_turbulence": ["eddy", "vortex", "turbulenza", "whirlpool", "water motion"],

    # Modern aerodynamics/fluids (Leonardo descendants)
    "aero_lift": ["lift coefficient", "angle of attack", "airfoil", "rotor"],
    "fluid_turbulence": ["reynolds number", "navier-stokes", "turbulence", "vortex dynamics"],
}
```

**Step 2: Run the discriminator on polymath corpus**

**Step 3: Save per-document classification**

---

### Task 14: Cross-validate BTUT anomalies with keyword discriminator

**Files:**
- Create: `scripts/cross_era_analysis/cross_validate_polymath.py`

**Step 1: For each top-15 BTUT anomaly:**

- Get its dominant regime from BTUT (by cluster composition and score)
- Get its dominant regime from the keyword discriminator
- Compare

**Step 2: Compute agreement rate**

Expected: >80% agreement for a paradigm-shifting result.

**Step 3: Save cross-validation report**

---

### Task 15: Deep-read top flagged documents for smoking guns

**Files:**
- Read: each top-flagged document's source text
- Create: `docs/findings/2026-04-10-newton-secret-draft.md`
- Create: `docs/findings/2026-04-10-vonneumann-secret-draft.md`
- Create: `docs/findings/2026-04-10-leonardo-secret-draft.md`

**Step 1: For each figure, identify the top 3 flagged documents**

**Step 2: Read each document's full text looking for:**

- Specific numerical values, ratios, dimensions
- Named procedures that match modern reproducible processes
- Technical terminology used in modern paradigm but not in the figure's era
- Cross-references to other flagged documents

**Step 3: Document findings in draft files**

Each finding should include:
- The exact passage from the source (verbatim quotation with citation)
- The modern paradigm descendant that matches
- The BTUT fingerprint evidence of the match
- The keyword discriminator independent confirmation
- A bounded claim that can be verified by anyone reading the primary sources

**Step 4: Reject any claim that cannot be traced to a specific line of specific source**

---

## Phase 5: Synthesis

### Task 16: Final synthesis with bounded claims

**Files:**
- Create: `docs/findings/2026-04-10-polymath-secrets-synthesis.md`

**Step 1: Write summary of investigation**

Include:
- Corpus size and composition
- BTUT result metrics (entities, clusters, unique fingerprints)
- Top anomalies per figure
- Cross-era matches
- Keyword discriminator agreement rate

**Step 2: Present per-figure bounded claims**

For each figure:
- The specific document flagged
- The smoking gun passage (verbatim quote)
- The modern paradigm descendant
- The verifiable claim

**Step 3: Honest limitations section**

- What the method detects vs what it doesn't
- Confidence levels per claim
- What would make the claims stronger
- What would falsify them

**Step 4: Commit all finding documents**

```bash
git add docs/findings/
git commit -m "Polymath secret detection: Newton Von Neumann Leonardo findings"
```

---

## Rollback Plan

If any phase fails:

- **Phase 1 failure (corpus acquisition)**: Re-dispatch agents with narrower scope (single figure at a time). If still failing, reduce to a single figure (e.g., Von Neumann — most accessible sources).

- **Phase 2 failure (corpus too small)**: Chunk more aggressively (8-word chunks) or add more modern descendant documents.

- **Phase 3 failure (BTUT error)**: Check worker container logs, verify PYTHONPATH, re-run with reduced entity count.

- **Phase 4 failure (no clear anomalies)**: This is a REAL negative result and should be reported honestly. Do not fabricate findings.

- **Phase 5 failure (no smoking guns)**: Report that the method found cross-era matches but no specific verifiable secrets. This is still a valuable methodological result.

## Success Criteria

**Minimum success**: Corpus built, BTUT run, at least one figure produces a specific flagged document with BTUT + keyword discriminator agreement.

**Target success**: All three figures produce bounded verifiable claims traceable to specific passages.

**Paradigm-shifting success**: Claims are specific enough that a domain expert (historian of science, materials chemist, aerodynamicist) would find them novel and worth investigating further.

---

## Execution Notes

- **Parallel dispatch**: Phase 1 tasks 1-4 should be dispatched in a single message with multiple Agent tool calls.
- **Frequent commits**: After each phase, commit progress.
- **Honest reporting**: If any prediction fails, document the failure. Do not overstate confidence.
- **Reference existing patterns**: Reuse `run_heterogeneous_btut.py`, `analyze_heterogeneous_btut.py`, `chunk_aggressive.py` — don't rewrite working code.
