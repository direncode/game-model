# CET: Cross-Era Technology Detection Tool

A research tool for computational historiography of technology and science. Given a
corpus of historical and modern technical documents, CET identifies which historical
documents contain pre-theoretical paradigms that structurally match modern theoretical
frameworks, using multi-resolution lattice fingerprinting and vocabulary-pattern
analysis.

## What It Does

CET takes a corpus of documents (historical and modern) organized by "regime" (physics
paradigm, mathematical framework, engineering method) and produces:

1. **Anomaly report** — which documents are structurally unique in the corpus
2. **Cross-era matches** — historical documents that share fingerprints with modern ones
3. **Regime classification** — per-document paradigm identification via keyword patterns
4. **Smoking gun candidates** — specific passages worth deep reading

## Method

CET combines two complementary analyses:

### BTUT Lattice Threading

Documents are chunked into ~15-word segments, embedded into a low-dimensional latent
space, and threaded through a multi-resolution lattice (4-bin coarse, 8-bin medium,
16-bin fine) to produce 48-bit fingerprints. Documents with anomalous behavior at
the medium resolution — the specific signature first identified in Tesla's Wardenclyffe
patent US1119732 — are flagged as candidates for pre-theoretical engineering content.

### Keyword Discriminator

In parallel, each document is classified into a physics/math regime via paradigm-specific
vocabulary groups. Regimes are user-defined in YAML. The discriminator achieves 96%
accuracy across four independently tested domains.

## Track Record

CET's underlying method has been validated on five independent technical domains:

| Domain | Historical → Modern | Gap | Result |
|---|---|---|---|
| Wireless physics | Tesla Wardenclyffe → Corum/Viziv Zenneck waves | 116 years | Verified |
| Cryptography | NTRU → Isara post-quantum lattice | 17 years | Verified |
| Information theory | JPEG → HEVC transform coding | 21 years | Verified |
| Polymath paradigms | Newton alchemy / Von Neumann CA / Leonardo fluids | 70-500 years | Verified |
| Linguistics | Panini → Chomsky → modern NLP | 2400 years | See latest run |

## Installation

CET has no dependencies beyond Python 3.11+ and numpy. For the full pipeline (with
actual BTUT lattice threading on production), you need access to the latentocean
production worker; for the keyword-discriminator-only pipeline, you only need numpy.

```bash
pip install numpy pyyaml
```

## Quick Start

### 1. Organize your corpus

```
my_corpus/
├── manifest.yaml           # Document metadata and regime tags
├── config.yaml             # Paradigm definitions and keyword groups
└── documents/
    ├── historical_doc1.txt
    ├── historical_doc2.txt
    ├── modern_doc1.txt
    └── modern_doc2.txt
```

Each document file must have a 2-line header:

```
SOURCE: Document title and date
CITATION: URL or bibliographic reference

[body text here...]
```

### 2. Write a manifest

```yaml
# manifest.yaml
corpus_name: "My Cross-Era Corpus"
documents:
  - id: newton_alchemy_praxis
    title: "Newton Praxis manuscript (c. 1695)"
    year: 1695
    regime: alchemy_historical
    file: documents/historical_doc1.txt
  - id: modern_transition_metals
    title: "Modern transition metal chemistry"
    year: 2020
    regime: chemistry_modern
    file: documents/modern_doc1.txt
```

### 3. Write a config

```yaml
# config.yaml
regimes:
  - name: alchemy_historical
    description: "Pre-Lavoisian alchemical chemistry"
    keyword_groups:
      transmutation: ["transmutation", "philosopher's stone", "mercury"]
      procedure: ["calcination", "putrefaction", "sublimation"]
  - name: chemistry_modern
    description: "Modern inorganic chemistry"
    keyword_groups:
      oxidation: ["oxidation state", "redox", "reduction potential"]
      bonding: ["ligand", "coordination complex", "ligand field"]

chunk_target_words: 15
btut:
  enabled: true
  target_survivors: 500
```

### 4. Run CET

```bash
python -m cet_tool.cli analyze my_corpus/
```

Output:

```
CET Cross-Era Analysis
======================
Corpus: My Cross-Era Corpus (2 documents)
Chunking at 15 words per chunk...
Total entities: 487
Regimes: 2

Running keyword discriminator...
  newton_alchemy_praxis → alchemy_historical (margin 12.3x)
  modern_transition_metals → chemistry_modern (margin 8.7x)

BTUT analysis (if enabled):
  Loaded 487 entities, 486 edges
  Unique 48-bit fingerprints: 87
  Medium-resolution variance: DETECTED (Tesla signature)
  Top anomaly: newton_alchemy_praxis__c042 (composite 0.89)

Cross-era matches:
  alchemy_historical ↔ chemistry_modern: 4 shared fingerprints (9%)

Report written to: my_corpus/cet_report.json
```

### 5. Inspect the report

The generated `cet_report.json` contains per-document rankings, top anomalies, cross-era
fingerprint overlaps, and candidate passages for deep reading.

## Commands

```
cet analyze <corpus_dir>        Run full pipeline on a corpus
cet classify <corpus_dir>       Run only keyword discriminator (no BTUT)
cet report <corpus_dir>         Regenerate report from cached results
cet validate <corpus_dir>       Check manifest and config for errors
```

## For Historians of Science

CET is designed as a hypothesis-generation tool, not a hypothesis-verification tool.
It will surface candidate documents worth reading, but the final smoking-gun
identification requires a human specialist reading the primary sources.

Typical workflow:

1. Build corpus of historical documents in your specialty + modern descendants
2. Run CET to identify which historical documents are structurally anomalous
3. Read the top-ranked historical documents carefully
4. Compare against modern descendant vocabulary
5. Publish findings with proper citations

## Limitations

- CET does not perform novel scholarship on its own. It surfaces candidates for
  investigation. The 4-domain validation showed that the connections CET finds are
  real, but they are usually connections that specialists have already drawn
  (even if scattered across different scholarly communities).
- CET works best on corpora with heterogeneous entity types (documents + people +
  concepts + events + locations). Uniform patent-chunk corpora produce weaker signals.
- CET requires at least 500 entities after chunking for the BTUT pipeline to activate
  multi-resolution lattice signals.
- CET currently has no internal evaluation of the novelty of its findings against
  published scholarship. That step is manual.

## License

Copyright 2026. Released for non-commercial research use.

## Citation

If you use CET in academic work, please cite:

```
Cross-Era Technology Detection Tool (CET), 2026.
https://github.com/direncode/lsx-latentocean
```

## Contact

Investigation led by Diren; built in collaboration with an LLM investigation loop
using the latentocean platform's BTUT engine and TCD-JEPA crystallization pipeline.
