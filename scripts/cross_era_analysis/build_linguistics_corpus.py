"""Build the linguistics cross-era corpus for the fifth-domain BTUT validation.

Corpus: Panini (4th c BCE) -> Port-Royal (1660) -> Humboldt (1836) ->
Saussure (1916) -> Chomsky (1956/1957) -> BNF (1960) -> Modern NLP
(distributional semantics, Transformer, BERT).

Pairs the historical linguistics documents with modern descendants for
cross-era structural matching via BTUT.
"""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

CORPUS_DIR = Path(__file__).parent / "documents"
OUT = Path(__file__).parent / "output"


# File -> regime mapping
FILE_TO_REGIME = {
    # Historical linguistics
    "linguistics_panini_ashtadhyayi": "historical_panini_grammar",
    "linguistics_portroyal_grammar": "historical_portroyal_grammar",
    "linguistics_humboldt_language": "historical_humboldt_language",
    "linguistics_saussure_course": "historical_saussure_structuralism",
    "linguistics_bhartrihari_vakyapadiya": "historical_bhartrihari_philosophy",
    "linguistics_bloomfield_language": "historical_bloomfield_structuralism",
    # Modern linguistics and formal grammar
    "modern_chomsky_syntactic_structures": "modern_chomsky_generative",
    "modern_chomsky_hierarchy": "modern_chomsky_hierarchy",
    "modern_chomsky_minimalism": "modern_chomsky_minimalism",
    "modern_backus_naur_form": "modern_formal_grammar_bnf",
    "modern_distributional_semantics": "modern_distributional_semantics",
    "modern_transformer_attention": "modern_transformer_nlp",
    "modern_bert_language_models": "modern_transformer_nlp",
    "modern_panini_computational_linguistics": "modern_computational_linguistics",
}


def get_regime(filename_stem: str) -> str | None:
    return FILE_TO_REGIME.get(filename_stem)


def chunk_text(text: str, target_words: int = 15) -> list[str]:
    words = text.split()
    chunks = []
    for i in range(0, len(words), target_words):
        chunk = " ".join(words[i : i + target_words])
        if len(chunk.split()) >= 5:
            chunks.append(chunk)
    return chunks


# Heterogeneous entities per linguistics regime
LINGUISTICS_ENTITIES = {
    "historical_panini_grammar": {
        "persons": [
            ("Panini", "4th-6th century BCE Sanskrit grammarian, author of Ashtadhyayi"),
            ("Patanjali", "Commentator on Panini, author of Mahabhashya"),
            ("Katyayana", "Sanskrit grammarian whose varttikas supplement Panini"),
            ("George Cardona", "Modern scholar of Panini's grammar"),
            ("Paul Kiparsky", "Modern phonologist who analyzed Panini's rule ordering"),
            ("Frits Staal", "Dutch scholar who linked Panini to formal language theory"),
            ("Subhash Kak", "Computer scientist who analyzed Panini's system as formal grammar"),
        ],
        "locations": [
            ("Gandhara", "Ancient region where Panini likely worked"),
            ("Indian grammatical tradition", "The scholarly lineage in which Panini stands"),
        ],
        "concepts": [
            ("Sutra", "Compact aphoristic rule in Sanskrit grammatical tradition"),
            ("Paribhasha", "Meta-rule governing rule application in Panini's system"),
            ("Pratyahara", "Abbreviatory device for naming ranges of phonemes"),
            ("Samjna", "Technical term used in Panini's meta-language"),
            ("Anubandha", "Marker letter attached to phonemes for meta-grammatical purposes"),
            ("Siddha", "Rule-ordering principle that a rule has already applied"),
            ("Antaranga", "Rule-ordering principle favoring inner-scope rules"),
        ],
        "events": [
            ("Ashtadhyayi composed", "The 4,000-sutra grammar composed c. 4th century BCE"),
            ("Panini rediscovered by Western scholars", "19th century Indology brings Panini to European attention"),
            ("Panini linked to formal language theory", "1960s-80s scholars draw parallels with Chomsky hierarchy"),
        ],
        "writings": [
            ("Ashtadhyayi", "Panini's foundational Sanskrit grammar in 8 chapters"),
            ("Mahabhashya", "Patanjali's commentary on Panini and Katyayana"),
        ],
    },
    "historical_portroyal_grammar": {
        "persons": [
            ("Antoine Arnauld", "French theologian and philosopher, co-author of Port-Royal Grammar"),
            ("Claude Lancelot", "French philologist, co-author of Port-Royal Grammar"),
            ("Rene Descartes", "Philosopher whose rationalism influenced the Port-Royal grammarians"),
        ],
        "locations": [
            ("Port-Royal Abbey", "Jansenist center near Paris where the grammar was written"),
        ],
        "concepts": [
            ("General grammar", "The view that there is a universal grammar underlying all languages"),
            ("Deep structure implicit", "The Port-Royal view that sentences have underlying logical propositions"),
            ("Compositional meaning", "The assumption that sentence meaning is composed from part meanings"),
            ("Cartesian rationalism", "Philosophical framework emphasizing universal rational structures"),
        ],
        "events": [
            ("Port-Royal Grammar published", "1660 anonymous publication of Grammaire generale et raisonnee"),
            ("Chomsky rediscovers Port-Royal", "1966 Cartesian Linguistics makes them a precursor to generative grammar"),
        ],
        "writings": [
            ("Grammaire generale et raisonnee", "Port-Royal Grammar of 1660"),
            ("Cartesian Linguistics", "Chomsky's 1966 book on rationalist linguistic tradition"),
        ],
    },
    "historical_humboldt_language": {
        "persons": [
            ("Wilhelm von Humboldt", "Prussian philosopher and linguist, 1767-1835"),
            ("Alexander von Humboldt", "Wilhelm's brother, naturalist"),
        ],
        "locations": [
            ("Prussian Academy", "Humboldt's institutional base"),
        ],
        "concepts": [
            ("Energeia", "Humboldt's term for language as generative activity"),
            ("Ergon", "Humboldt's term for language as finished product"),
            ("Innere Sprachform", "Inner form of language reflecting cognitive organization"),
            ("Infinite use of finite means", "Humboldt's phrase for the generative property of language"),
            ("Linguistic typology", "Classification of languages by morphological structure"),
            ("Language and worldview", "The claim that language shapes thought"),
        ],
        "events": [
            ("Ueber die Verschiedenheit published", "1836 posthumous publication of Humboldt's masterwork"),
            ("Humboldt cited by Chomsky", "1965 Aspects credits Humboldt with generative insight"),
        ],
        "writings": [
            ("Ueber die Verschiedenheit des menschlichen Sprachbaues", "Humboldt's 1836 treatise on language"),
            ("On Language (English)", "Heath or Harris translations of Humboldt"),
        ],
    },
    "historical_saussure_structuralism": {
        "persons": [
            ("Ferdinand de Saussure", "Swiss linguist, 1857-1913, founder of structural linguistics"),
            ("Charles Bally", "Saussure's student who compiled the Course"),
            ("Albert Sechehaye", "Saussure's student who compiled the Course"),
            ("Roman Jakobson", "Structuralist linguist who extended Saussure's ideas"),
            ("J. R. Firth", "British linguist who operationalized relational meaning"),
            ("Zellig Harris", "American structuralist who developed distributional analysis"),
        ],
        "locations": [
            ("Geneva", "Where Saussure lectured on general linguistics"),
            ("Prague Linguistic Circle", "Structuralist school influenced by Saussure"),
        ],
        "concepts": [
            ("Sign", "Saussure's two-sided unit of signifier and signified"),
            ("Signifier", "Acoustic image side of the linguistic sign"),
            ("Signified", "Conceptual side of the linguistic sign"),
            ("Langue", "The shared language system"),
            ("Parole", "Individual speech acts"),
            ("Synchrony", "The study of language at a single moment"),
            ("Diachrony", "The study of language change over time"),
            ("Value", "Relational meaning in Saussure's system"),
            ("Arbitrariness of the sign", "No natural link between sound and meaning"),
            ("System of differences", "Saussure's view of language as purely relational"),
            ("Syntagmatic", "Relations among signs in the same sentence"),
            ("Paradigmatic", "Relations among signs that can substitute for each other"),
        ],
        "events": [
            ("Saussure lectures on general linguistics", "1906-1911 at University of Geneva"),
            ("Course in General Linguistics published", "1916 posthumous publication by Bally and Sechehaye"),
            ("Structuralism spreads to humanities", "1950s-70s Saussure becomes foundational for structuralist thought"),
        ],
        "writings": [
            ("Course in General Linguistics", "Saussure's 1916 posthumous book"),
            ("Cours de linguistique generale", "Original French title of Saussure's Course"),
        ],
    },
    "modern_chomsky_generative": {
        "persons": [
            ("Noam Chomsky", "American linguist, founder of generative grammar"),
            ("Zellig Harris", "Chomsky's dissertation advisor, structural linguist"),
            ("Morris Halle", "MIT phonologist, Chomsky collaborator"),
        ],
        "locations": [
            ("MIT Department of Linguistics", "Home of generative grammar since the 1950s"),
        ],
        "concepts": [
            ("Generative grammar", "Rule-based finite system generating infinite sentences"),
            ("Transformation", "Rule mapping one syntactic structure to another"),
            ("Deep structure", "Underlying syntactic representation"),
            ("Surface structure", "Phonetically realized syntactic representation"),
            ("Phrase structure rule", "Rewrite rule specifying phrasal composition"),
            ("Universal grammar", "Innate linguistic structures shared by all humans"),
            ("Language faculty", "Cognitive module for language in humans"),
            ("Principles and parameters", "Later framework where grammars differ by parameter settings"),
            ("Minimalism", "1990s+ framework emphasizing merge and economy"),
            ("Competence", "Speaker's internal grammatical knowledge"),
            ("Performance", "Actual speech behavior, noisy and imperfect"),
        ],
        "events": [
            ("Syntactic Structures published", "1957 foundational generative grammar book"),
            ("Aspects of the Theory of Syntax published", "1965 standard theory of generative grammar"),
            ("Cartesian Linguistics published", "1966 Chomsky's historical argument for rationalist roots"),
            ("Minimalist Program introduced", "1995 simplification of generative apparatus"),
        ],
        "writings": [
            ("Syntactic Structures", "Chomsky 1957 foundational text"),
            ("Aspects of the Theory of Syntax", "Chomsky 1965 standard theory"),
            ("The Minimalist Program", "Chomsky 1995 simplified framework"),
        ],
    },
    "modern_chomsky_hierarchy": {
        "persons": [
            ("Noam Chomsky", "Introduced the formal hierarchy in 1956"),
            ("Michael Rabin", "Automata theory pioneer"),
            ("Dana Scott", "Automata theory pioneer"),
            ("Stephen Kleene", "Regular languages and regular expressions"),
        ],
        "locations": [],
        "concepts": [
            ("Regular language", "Type 3, recognized by finite automata"),
            ("Context-free language", "Type 2, recognized by pushdown automata"),
            ("Context-sensitive language", "Type 1, recognized by linear-bounded automata"),
            ("Recursively enumerable", "Type 0, recognized by Turing machines"),
            ("Finite automaton", "Simplest computational model, regular languages"),
            ("Pushdown automaton", "Finite automaton with a stack, context-free languages"),
            ("Linear-bounded automaton", "Turing machine with tape bounded by input length"),
            ("Turing machine", "Universal computational model"),
            ("Rewrite rule", "Core primitive of formal grammar systems"),
        ],
        "events": [
            ("Chomsky hierarchy introduced", "1956 paper 'Three Models for the Description of Language'"),
        ],
        "writings": [
            ("Three models for the description of language", "Chomsky 1956 foundational formal language theory paper"),
        ],
    },
    "modern_formal_grammar_bnf": {
        "persons": [
            ("John Backus", "Invented BNF for ALGOL 58"),
            ("Peter Naur", "Refined BNF for ALGOL 60, gave it half its name"),
            ("Donald Knuth", "Disambiguated 'Backus Normal' vs 'Backus Naur' form"),
        ],
        "locations": [
            ("IBM", "Where Backus developed BNF for ALGOL"),
            ("International Conference on Information Processing Paris 1959", "Where Backus first presented BNF"),
        ],
        "concepts": [
            ("Production rule", "Rewrite rule in a context-free grammar"),
            ("Non-terminal symbol", "Symbol that can be rewritten"),
            ("Terminal symbol", "Symbol that cannot be rewritten"),
            ("Meta-syntax", "Notation for specifying syntaxes"),
            ("Meta-language", "Language used to describe other languages"),
        ],
        "events": [
            ("BNF introduced for ALGOL 58", "1959 Backus paper at IFIP Paris"),
            ("ALGOL 60 report published with BNF", "1960 Naur edition establishes BNF as standard"),
            ("Parallel to Panini recognized", "1960s-90s scholars note structural identity with Ashtadhyayi"),
        ],
        "writings": [
            ("ALGOL 60 Report", "Naur 1960 specification using BNF"),
            ("Backus 1959 ICIP paper", "Original introduction of BNF notation"),
        ],
    },
    "modern_distributional_semantics": {
        "persons": [
            ("Zellig Harris", "1954 paper on distributional structure"),
            ("J. R. Firth", "1957 'know a word by the company it keeps'"),
            ("Susan Dumais", "LSA co-developer"),
            ("Tomas Mikolov", "Word2Vec lead author"),
            ("Jeffrey Pennington", "GloVe co-author"),
            ("Christopher Manning", "GloVe co-author and modern NLP pioneer"),
        ],
        "locations": [
            ("Bell Labs", "Home of early LSA work"),
            ("Google Brain", "Home of Word2Vec development"),
            ("Stanford NLP", "Home of GloVe and many foundational NLP works"),
        ],
        "concepts": [
            ("Distributional hypothesis", "Words in similar contexts have similar meanings"),
            ("Word embedding", "Dense vector representation of a word"),
            ("Vector space model", "Geometric representation of semantic similarity"),
            ("Latent semantic analysis", "SVD-based dimensionality reduction for meaning"),
            ("Skip-gram", "Word2Vec training objective: predict context from word"),
            ("CBOW", "Word2Vec training objective: predict word from context"),
            ("Cosine similarity", "Angle-based similarity measure in vector space"),
            ("Analogical reasoning in embeddings", "king - man + woman = queen"),
        ],
        "events": [
            ("Harris distributional structure paper", "1954"),
            ("Firth synopsis of linguistic theory", "1957 with 'company it keeps' quote"),
            ("LSA introduced", "1988 Deerwester, Dumais, Furnas, Landauer, Harshman"),
            ("Word2Vec released", "2013 Mikolov et al."),
            ("GloVe released", "2014 Pennington, Socher, Manning"),
        ],
        "writings": [
            ("Harris Distributional Structure 1954", "Foundational distributional semantics paper"),
            ("Firth Synopsis 1957", "The 'company it keeps' paper"),
            ("Word2Vec 2013", "Mikolov et al. neural word embeddings"),
        ],
    },
    "modern_transformer_nlp": {
        "persons": [
            ("Ashish Vaswani", "Lead author of Attention Is All You Need"),
            ("Noam Shazeer", "Co-author of Transformer paper"),
            ("Jakob Uszkoreit", "Co-author of Transformer paper"),
            ("Jacob Devlin", "Lead author of BERT paper"),
            ("Alec Radford", "GPT series lead author at OpenAI"),
        ],
        "locations": [
            ("Google Brain Mountain View", "Where the Transformer was developed"),
            ("OpenAI San Francisco", "Where GPT models were developed"),
        ],
        "concepts": [
            ("Self-attention", "Mechanism computing weighted combinations of all positions"),
            ("Multi-head attention", "Parallel attention computations with different learned projections"),
            ("Positional encoding", "Injecting position information into permutation-invariant model"),
            ("Query Key Value", "Three learned projections used in attention computation"),
            ("Encoder-decoder", "Architecture with separate encoding and generation stages"),
            ("Masked language modeling", "BERT training objective: predict masked tokens"),
            ("Causal language modeling", "GPT training objective: predict next token"),
            ("Transfer learning", "Pre-training on unlabeled data then fine-tuning"),
            ("Attention is all you need", "The central claim of the 2017 Transformer paper"),
        ],
        "events": [
            ("Transformer paper published", "2017 Vaswani et al. Attention Is All You Need"),
            ("BERT released", "2018 Google bidirectional transformer"),
            ("GPT-3 released", "2020 OpenAI large-scale language model"),
            ("ChatGPT released", "2022 OpenAI conversational language model"),
        ],
        "writings": [
            ("Attention Is All You Need", "Vaswani et al. 2017 foundational Transformer paper"),
            ("BERT paper", "Devlin et al. 2018"),
            ("GPT-3 paper", "Brown et al. 2020"),
        ],
    },
}


def slugify(text: str) -> str:
    return re.sub(r"[^a-zA-Z0-9]+", "_", text).strip("_").lower()[:50]


def generate_entities(regime_to_anchor: dict) -> tuple[list[dict], list[dict]]:
    new_entities = []
    new_edges = []

    for regime, contents in LINGUISTICS_ENTITIES.items():
        anchor = regime_to_anchor.get(regime)
        regime_local = []

        for entity_type, items in contents.items():
            etype_singular = entity_type.rstrip("s")
            for name, description in items:
                eid = f"{regime}__{etype_singular}__{slugify(name)}"
                entity = {
                    "name": eid,
                    "type": etype_singular,
                    "attributes": {
                        "name": name,
                        "description": description,
                        "physics_regime": regime,
                        "entity_type": etype_singular,
                    },
                }
                new_entities.append(entity)
                regime_local.append(entity)

                if anchor:
                    new_edges.append({
                        "source": eid,
                        "target": anchor,
                        "type": "belongs_to_regime",
                        "weight": 0.6,
                    })

        # Intra-regime cross-type edges
        persons = [e for e in regime_local if e["type"] == "person"]
        writings = [e for e in regime_local if e["type"] == "writing"]
        events = [e for e in regime_local if e["type"] == "event"]
        concepts = [e for e in regime_local if e["type"] == "concept"]
        locations = [e for e in regime_local if e["type"] == "location"]

        for p in persons[:4]:
            for w in writings[:3]:
                new_edges.append({"source": p["name"], "target": w["name"], "type": "authored", "weight": 0.8})
            for e in events[:3]:
                new_edges.append({"source": p["name"], "target": e["name"], "type": "involved_in", "weight": 0.7})
            for c in concepts[:3]:
                new_edges.append({"source": p["name"], "target": c["name"], "type": "developed", "weight": 0.7})
            for loc in locations[:2]:
                new_edges.append({"source": p["name"], "target": loc["name"], "type": "worked_at", "weight": 0.6})

    return new_entities, new_edges


def main() -> None:
    entities = []
    chunks_by_regime = defaultdict(list)
    chunks_by_doc = defaultdict(list)

    for f in sorted(CORPUS_DIR.glob("*.txt")):
        stem = f.stem
        regime = get_regime(stem)
        if regime is None:
            continue

        with open(f, "r", encoding="utf-8") as fp:
            text = fp.read()
        # Strip header
        if text.startswith("SOURCE:"):
            lines = text.split("\n", 3)
            text = lines[3] if len(lines) >= 4 else ""

        chunks = chunk_text(text, target_words=15)
        if not chunks:
            continue

        print(f"  {stem[:40]:40s} regime={regime[:35]:35s} chunks={len(chunks)}")

        for i, chunk_text_ in enumerate(chunks):
            chunk_id = f"{stem}__c{i:03d}"
            entity = {
                "name": chunk_id,
                "type": "document_chunk",
                "attributes": {
                    "text": chunk_text_,
                    "parent_document": stem,
                    "physics_regime": regime,
                    "chunk_index": i,
                },
            }
            entities.append(entity)
            chunks_by_regime[regime].append(chunk_id)
            chunks_by_doc[stem].append(chunk_id)

    # Sequential edges
    relationships = []
    for doc_id, chunk_ids in chunks_by_doc.items():
        for i in range(len(chunk_ids) - 1):
            relationships.append({
                "source": chunk_ids[i],
                "target": chunk_ids[i + 1],
                "type": "next_chunk",
                "weight": 0.9,
            })

    # Heterogeneous entities
    regime_anchors = {r: ids[0] for r, ids in chunks_by_regime.items() if ids}
    het_entities, het_edges = generate_entities(regime_anchors)
    entities.extend(het_entities)
    relationships.extend(het_edges)

    print()
    print(f"Total entities: {len(entities)}")
    print(f"Heterogeneous entities added: {len(het_entities)}")
    print(f"Total edges: {len(relationships)}")
    print()

    regime_counts = Counter(e["attributes"]["physics_regime"] for e in entities)
    print("Entities per regime:")
    for r, c in sorted(regime_counts.items(), key=lambda x: -x[1]):
        print(f"  {r}: {c}")

    type_counts = Counter(e["type"] for e in entities)
    print()
    print("Entity types:")
    for t, c in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"  {t}: {c}")

    OUT.mkdir(exist_ok=True)
    output_path = OUT / "linguistics_corpus.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({"entities": entities, "relationships": relationships}, f, indent=2)
    print()
    print(f"Saved: {output_path}")
    print(f"File size: {output_path.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
