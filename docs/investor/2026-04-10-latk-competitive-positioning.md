# LATK Competitive Positioning

**Date:** 2026-04-10
**Audience:** G42 / Mubadala technical diligence
**Purpose:** Honest comparison of BTUT+LATK against the real alternatives a DD team will ask about

---

## The Question A DD Team Will Ask

> "Why can't I get the same result by putting all 50,000 arXiv abstracts into FAISS and doing a nearest-neighbor lookup? Or by hitting OpenAI's embedding API and storing the results in Pinecone?"

This doc answers that question honestly, not defensively.

---

## The Five Closest Alternatives

### 1. Vanilla vector database (FAISS / Milvus / Pinecone / pgvector)

**What it does**: stores every embedding vector in a data structure optimized for fast k-NN retrieval. FAISS does billion-vector ANN search in milliseconds.

**What it wins at**:
- Raw nearest-neighbor query speed at scale (FAISS HNSW is 10-100× faster per query than BTUT's dense scan)
- Mature ecosystem, well-documented, battle-tested in production
- Exact k-NN guarantee available as a config toggle

**What it doesn't do**:
- **Discard data.** FAISS stores every vector you give it. A billion vectors at float32×768d = 3 TB of RAM/disk. BTUT reduces to the signal-rich 2-5% — 20-50× less storage at comparable query-routing fidelity.
- **Heterogeneous entity graphs.** FAISS is a vector store; it doesn't know about entity types, edges, or structural relationships. You can build that on top, but you're back to writing the stratified selection + graph projection code that BTUT already has.
- **Unsupervised signal-density ranking.** FAISS gives you "nearest k to query" but not "which of these vectors carry unique signal vs are redundant?" BTUT's 3-axis composite scoring (diversity + reconstruction + anomaly) explicitly ranks entities by signal density and keeps only the top quota per type + cluster.

**Honest comparison on the specific query "Zenneck surface wave wireless power" against the 1,851 heterogeneous corpus entities**: FAISS with sentence-BERT embeddings would probably return the same top-10 as LATK's 8D method does, *because* sentence-BERT is a much higher-dimensional learned embedding than LATK's 32D hand-crafted feature concatenation. But FAISS would keep all 1,851 vectors; LATK keeps 595. At the 50k physics scale (246k entities), the difference is 4,999 survivors vs 246k vectors — BTUT's 49× reduction is the point.

**If the goal is "query-time latency at a fixed corpus size," FAISS wins.** **If the goal is "preserve query-routing fidelity at fixed compressed size," BTUT wins.**

### 2. Sentence-BERT / OpenAI embeddings + FAISS

**What it does**: embed every document with a learned transformer-based embedding model (sentence-BERT, OpenAI text-embedding-3-large, BGE, E5), store in FAISS, query with the same embedding model.

**What it wins at**:
- Semantic similarity out of the box. The Saussure→Humboldt→Chomsky chain is almost certainly reconstructable with sentence-BERT + FAISS because sentence-BERT's embedding space encodes generic semantic similarity.
- Zero engineering effort — pip install, load model, index, query.
- Continuously improving — new embedding models ship every few months.

**What it doesn't do**:
- **Per-token API cost at scale.** OpenAI's text-embedding-3-large is $0.00013 per 1k tokens. 246,000 entities × ~200 tokens avg = ~49M tokens = **$6.37** for the physics smoke slice. 5M entities = **~$130**. 200M entities = **~$5,200**. 2B entities = **~$52,000**. These are the embedding API fees *alone*, not counting storage or query costs. At Phase 3 scale this is real money.
- **Domain-specific entity graph structure.** Sentence-BERT sees each document as a bag of words; it doesn't know that a paper has authors, or that an author has affiliations, or that a concept is cited by a patent. BTUT's embedder has dedicated sub-engines for text, numeric attributes, time-series attributes, and graph walks, fused together.
- **Unsupervised data reduction.** Same critique as FAISS. Sentence-BERT embeds everything; it doesn't rank entities by signal density or prune the corpus.
- **Provenance and cross-era tracing.** BTUT preserves the per-survivor entity name, type, cluster, and 8D position so LATK can reconstruct the lineage chain explicitly. Sentence-BERT + FAISS gives you "here are the 10 nearest vectors" without domain-structured context.

**Honest comparison on the linguistics lattice**: sentence-BERT + FAISS would very likely reproduce the Saussure→Humboldt→Chomsky→distributional semantics→Transformer chain we demonstrated because sentence-BERT's training data includes all of these concepts and their well-known semantic relationships. **If a G42 engineer's first question is "why didn't you just use sentence-BERT?", the honest answer is: for the linguistics toy corpus, you could have, and the results would be comparable. For a 5M-entity multi-source physics corpus where the API cost starts to matter and the heterogeneous entity structure is load-bearing, the trade-offs shift.**

### 3. LLM-based retrieval (GPT-4 / Claude with long context + semantic search)

**What it does**: load the corpus into a long-context LLM or a retrieval-augmented generation (RAG) system; ask the LLM "what is the lineage of this quote?"

**What it wins at**:
- Flexible natural language querying — ask any question, get a reasoned answer.
- Zero indexing work.
- Handles nuance and context the BTUT geometric embedding can't.

**What it doesn't do**:
- **Work at all above ~200K token context window.** 50k arXiv abstracts × ~200 tokens = 10M tokens, 50× the max context of Claude Opus. The physics corpus cannot fit. RAG mitigates but introduces its own retrieval layer which... needs a vector DB. Back to the FAISS conversation.
- **Give you reproducible rankings.** An LLM's answer for "what is Saussure's lineage" will be consistent-sounding but non-deterministic across runs and depends on prompt tuning. BTUT's 8D distance is a fixed number for a fixed lattice.
- **Work without per-query cost.** GPT-4 / Claude pricing at 10K-100K prompt tokens per query is $0.10-$1.00 per query. BTUT queries are free after indexing.
- **Surface the "what novel things are in the corpus" task.** Asking an LLM "what's new here" on a corpus it wasn't trained on is fundamentally unreliable. BTUT's anomaly score is a concrete measurable signal.

**Honest comparison**: for a one-off query on a small corpus, GPT-4 would probably give a better answer than LATK. For a public API that needs to return reproducible, sub-second, low-cost answers across millions of queries, LLM-based retrieval is the wrong tool.

### 4. Graph-based retrieval (Neo4j + Cypher + embeddings)

**What it does**: store entities and relationships in a graph database, use embeddings on node properties, query via Cypher path-finding + vector similarity hybrid.

**What it wins at**:
- Explicit graph structure. You can ask "find the shortest path between Saussure and Transformer NLP through the citation graph."
- Mature query language.
- Good for queries where the **edges** are the signal.

**What it doesn't do**:
- **Unsupervised cross-era discovery.** Graph path queries require you to *already know* the start and end nodes. LATK's novelty query takes arbitrary text and finds the relevant graph nodes without any starting hint.
- **Scale beyond ~100M-ish nodes** without significant engineering. Neo4j is not designed for billion-node graphs.
- **Signal-density ranking.** Same as FAISS — graph DBs store everything.

**Honest comparison**: LATK's heterogeneous corpus format (writing / chunk / concept / event / location / person entities + typed edges) is basically a denormalized graph. You could store the same data in Neo4j. The question is whether your dominant query pattern is "find path from A to B" (graph wins) or "given this text, find the relevant nodes in an unsupervised way" (LATK wins). For cross-era lineage routing as we define it, the second pattern dominates.

### 5. The "just fine-tune a model" alternative

**What it does**: fine-tune a learned embedding model on the target corpus (contrastive learning on known lineage pairs, or masked-LM pretraining on the corpus text, or whatever). Use the fine-tuned embeddings with FAISS.

**What it wins at**:
- Higher retrieval quality on the target task after fine-tuning.
- Leverages the full power of modern transformer architectures.

**What it doesn't do**:
- **Work without labeled lineage pairs.** Contrastive fine-tuning needs positive examples. We don't have labeled (Saussure, Chomsky) pairs at scale; generating them is the hard problem.
- **Fit in the unsupervised constraint.** LATK's promise is "no supervision, no fine-tuning, works on arbitrary heterogeneous technical corpora out of the box." Fine-tuning violates that by definition.
- **Come cheap at scale.** Fine-tuning a sentence-BERT-class model on 200M documents is a $10K-100K GPU job by itself.

**Honest comparison**: if you have labeled lineage data, fine-tuning beats LATK. For the unsupervised cross-era case on heterogeneous technical corpora, LATK works directly.

---

## Summary Table

| Axis | FAISS | sBERT+FAISS | LLM RAG | Neo4j+emb | Fine-tuned | **BTUT+LATK** |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| **Query latency (warm, 250k corpus)** | ms | ms | seconds | ms-s | ms | **60-260ms** |
| **Corpus cost at 5M entities** | $0 | $130 API | $$$ per-query | $0 | $10K-100K GPU | **$0** |
| **Heterogeneous entity types + edges** | ❌ | ❌ | ❌ | ✓ | partial | **✓** |
| **Unsupervised signal-density reduction** | ❌ | ❌ | ❌ | ❌ | partial | **✓** |
| **Storage at 246k entities** | 3 GB @ 768d | 3 GB | N/A | ~500 MB | 3 GB | **~5 MB lattice** |
| **Reproducible deterministic rankings** | ✓ | ✓ | ❌ | ✓ | ✓ | **✓** |
| **Cross-era conceptual lineage without supervision** | partial | partial | unreliable | ❌ | needs labels | **✓** |
| **Provenance per survivor** | ✓ | ✓ | ❌ | ✓ | ✓ | **✓ (name + type + cluster + 8D)** |
| **Needs external API / paid model** | ❌ | ✓ | ✓ | ❌ | GPU | **❌** |
| **Maturity** | high | high | medium | high | medium | **low (Phase 1)** |

---

## Where BTUT+LATK Actually Wins

Three axes where the method has a defensible advantage:

1. **Extreme compression with preserved query-routing fidelity.** Vector DBs store everything. LATK keeps 2-5%. On a billion-vector corpus, this is the difference between 3 TB and 60 GB of lattice. Measured advantage over random subsampling at the 49× compression regime is +150%.

2. **Heterogeneous entity graph ingest as a first-class citizen.** The embedder has dedicated sub-engines for text + numeric + time-series + graph walks, with deterministic seeds so the same corpus always produces the same embedding. Vector DBs don't know about entity types; they treat everything as bag-of-vectors. LATK routes physics queries to writing+chunk entities automatically via per-lattice default type filters; tesla_crossera to patent_chunks; heterogeneous to a broader set including concepts and events.

3. **Unsupervised cross-era routing with dual-signal interpretation.** Given an arbitrary modern text, the combined method surfaces both the deep concept lineage (8D Euclidean, geometrically mediated) and the citation-chain lineage (48-bit hamming, token-level), as separate interpretable signals. No single retrieval method I've seen does this explicitly.

## Where BTUT+LATK Does Not Win

1. **Raw k-NN latency at fixed corpus size.** FAISS is faster per query. For a use case where you want "here are the k nearest neighbors in 2 ms," use FAISS.

2. **Semantic nuance on small corpora.** Sentence-BERT was trained on billions of sentence pairs and encodes rich semantic similarity. LATK's 32D hand-crafted embedding is crude compared to sentence-BERT's 768D learned representation. On a small corpus where compression is not needed, sentence-BERT + FAISS is very likely a better choice.

3. **Maturity, ecosystem, tooling.** FAISS, Milvus, and Pinecone have been in production for years at hyperscaler scale. BTUT is a Phase 1 research tool with a live smoke slice at 246k entities. The scaling to 5M+ is credible but not yet demonstrated.

4. **Generic retrieval.** If the target task is "find all documents mentioning X," sentence-BERT + FAISS dominates. LATK's value is specifically in the cross-era structural lineage use case with heterogeneous entity graphs.

---

## The Honest Summary for G42

BTUT+LATK is not trying to replace FAISS. It is a different tool for a different task: **unsupervised structural reduction of heterogeneous technical knowledge graphs to signal-dense lattices, with cross-era conceptual routing on top**. On generic k-NN, FAISS wins. On the specific task of "take heterogeneous technical corpus X, crystallize it to 2-5% survivors while preserving cross-era lineage routing fidelity, and serve the resulting lattice over a public API without per-query embedding costs," LATK is the working solution we can demo live right now, with measured results that beat the random baseline by 150% at the compression regime that matters.

If the G42 use case is generic high-recall retrieval over technical corpora, BTUT+LATK is the wrong tool; use sentence-BERT + FAISS or OpenAI embeddings + Pinecone. If the use case is **building a reduced, queryable, reproducible, zero-per-query-cost cross-era knowledge atlas over petabyte-scale heterogeneous technical corpora with explicit lineage routing as the headline operation**, BTUT+LATK is built for that specific thing.

The honest ask is "partner with us on Phase 1 completion so we can push from 246k entities live to 5M+ entities validated with historical ancestors, and then reconsider at each phase gate."
