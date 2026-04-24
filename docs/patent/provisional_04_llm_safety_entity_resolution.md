# Provisional Patent Application

**Title:** Systems and Methods for Constraining Generative-Model Output to a Verified Fact Bundle via Numeric-Fidelity Validation with Deterministic-Template Fallback, and a Layered Family-Priority Entity-Resolution Cascade for Heterogeneous Code Spaces

**Filing type:** Provisional Application for Patent (35 U.S.C. § 111(b))

**Inventor(s):** [to be supplied by applicant]

**Assignee:** [to be supplied by applicant]

**Priority date:** [date of this provisional filing]

---

## I. Cross-References to Related Applications

This application is related in subject matter to commonly-owned
provisional applications provisional_01_btut_primitive,
provisional_02_tcd_jepa, and provisional_03_two_engine_composition,
each of which describes upstream deterministic substrates whose
outputs may, in some embodiments, serve as the verified fact
bundle of the present invention. The present invention may also
be practiced independently of any of those substrates.

## II. Field of the Invention

The present invention relates to systems for safely deploying
generative machine-learning models — including large language
models — in regulated and analytical contexts, and more
particularly (a) to systems and methods that constrain
generative-model output to a verified per-finding fact bundle
through automatic post-generation validation of numeric
fidelity, entity grounding, and external-causation absence, with
a deterministic-template fallback emitted whenever validation
fails; and (b) to systems and methods for resolving short-string
identifiers and codes to canonical entries across heterogeneous
overlapping ontologies through a layered cascade with
deterministic family-priority tie-breaking.

## III. Background

### A. Hallucination in generative-model deployment

Large language models, when deployed as the generative layer of
a commercial analytical product, are subject to several modes of
factual failure including but not limited to: numeric fabrication
(quoting figures not present in the input context); entity
substitution (referring to a different entity than the one in
context); causation invention (asserting cause-effect
relationships not supported by the input); marketing-tone drift
(employing hype vocabulary in violation of analytical-tone
specifications); and concept misnaming (referring to one input
concept by the name of another).

Existing mitigation strategies — including system-prompt-only
guardrails, embedding-similarity rejection, chain-of-thought
self-critique, retrieval-augmented generation, and reinforcement
learning from human feedback — each mitigate some failure modes
but are widely understood to be insufficient as a single line of
defense in regulated-deployment contexts. None offers a
deterministic-by-construction fallback path: when the generative
output fails post-hoc validation, conventional systems either
return the failed output anyway, retry generation (potentially
many times with no guaranteed convergence), or return an error
to the user.

### B. Entity resolution across overlapping code spaces

Analytical systems operating over heterogeneous corpora —
financial filings tagged with SEC CIKs, biomedical literature
tagged with MeSH descriptors, trade records tagged with HS
commodity codes, patent filings tagged with CPC classes,
geographic data tagged with ISO-3166 country codes, and so on —
must resolve user-supplied short strings to canonical entries
across many of these code spaces simultaneously. Such strings
frequently exhibit collisions: the alias "pharma" appears in
both the SIC industry-classification taxonomy (2834,
"Pharmaceutical Preparations") and the HS commodity-code
taxonomy (chapter 30, "Pharmaceutical products"); the canonical
name "Georgia" denotes both an ISO-3166 country (GEO) and a
US state (GA).

Conventional entity resolvers — including dictionary lookups,
fuzzy-string matchers, and embedding-based retrievers — produce
non-deterministic outputs across collisions because tie-breaking
depends on filesystem iteration order, hash-table seeding, or
embedding-similarity ties resolved by undefined behavior. The
same input query, run on the same software in two different
operating-system environments, can return different family
assignments — a defect that breaks reproducibility of all
downstream analytics.

### C. The problem addressed

There exist needs for (i) a generative-model deployment pattern
that produces analytically-correct output by construction,
falling back to a deterministic template whenever the
generative output cannot be validated against the verified fact
bundle; and (ii) an entity-resolution cascade whose output is
deterministic across operating-system environments, hash-table
seedings, and other implementation-detail variations, even in
the presence of cross-family collisions in the code space.

## IV. Summary of the Invention

The present invention provides two interoperating but
independently-practicable systems.

### A. Constrained generative output with deterministic fallback

The first system, called herein the "Bundle-Grounded Narrative
Generator," accepts as input (i) a structured fact bundle
specifying the finding to be narrated and (ii) a deterministic
template capable of rendering the bundle into a fallback
narrative in the absence of any generative model. The system
operates as follows:

1. The fact bundle is rendered into a generative-model prompt
   using a fixed prompt template that explicitly enumerates the
   admissible facts and forbids the introduction of any
   un-bundled fact.

2. A generative model — operable in any of an air-gap mode
   (local model server such as Ollama), a hosted-API mode
   (Anthropic, OpenAI, etc.), or a disabled mode in which the
   deterministic template is returned directly — produces a
   candidate narrative.

3. The candidate narrative is subjected to multi-dimensional
   automatic post-generation validation, comprising at least:
   (a) numeric-fidelity validation, in which every numeric
   token in the narrative is required to trace to a numeric
   field of the bundle, with allowed analyst-rounding and
   percent-of-rank derivations; (b) entity-and-concept
   grounding validation, in which the bundle's resolved
   organizational entity and conceptual line-item must each
   appear, by name or recognized abbreviation, in the
   narrative; (c) external-causation absence validation, in
   which the narrative is rejected if it employs any phrasal
   pattern indicating causation by an external named event,
   actor, or date not present in the bundle; and (d)
   marketing-language absence validation, in which the
   narrative is rejected if it employs any of an enumerated
   set of hype words.

4. If all validations pass, the candidate narrative is emitted.
   Otherwise, the deterministic template is emitted in its
   place, accompanied by a structured record indicating which
   validations failed and which tokens triggered the failures.

5. In all cases, a binary safety verdict (hallucinated /
   not-hallucinated) is logged for monitoring; the
   not-hallucinated outcome is bit-deterministic for given
   bundle and template inputs.

### B. Layered entity-resolution cascade with family-priority tie-breaking

The second system, called herein the "Family-Priority Cascade
Resolver," accepts as input (i) a query string and (ii) one or
more bundled ontology files, each ontology containing entries
of `{code, canonical_name, family, aliases, parent, description}`
shape. The resolver computes a single best resolution as
follows:

1. **Stage 1 — Direct code lookup.** If the query exactly
   equals a registered code (case-insensitive), return that
   entry with confidence 1.0.

2. **Stage 2 — Prefix-stripped code lookup.** If the query
   matches a registered code after stripping a configurable set
   of source-namespace prefixes (e.g. `mesh_`, `commodity_`,
   `region_`, `state_`, `cpc_`, `sic_`, `country_`, `iso_`,
   `HS-`, etc.), return the matched entry with confidence 0.95.

3. **Stage 3 — Alias lookup.** If the prefix-stripped query
   matches a registered alias of any entry, return the
   highest-priority entry whose alias matched, with confidence
   0.9. Highest-priority is determined by an operator-supplied
   `FAMILY_PRIORITY` list whose lower-indexed families dominate
   higher-indexed ones.

4. **Stage 4 — Lexical similarity.** Score the prefix-stripped
   query against every (canonical_name, alias_1, alias_2, …)
   string of every entry, taking the maximum score per entry,
   under a hybrid scoring function combining (a) Jaccard
   token-set similarity, (b) character n-gram set similarity,
   and (c) normalized Levenshtein similarity; sort entries
   descending by score with `FAMILY_PRIORITY` as the
   deterministic tiebreaker; admit the top entry as a
   resolution if its score exceeds a configurable threshold,
   else return it as a candidate without claiming resolution.

5. **Stage 5 — Optional embedding fallback.** If stages 1–4
   fail to resolve, and an embedding subsystem is available,
   compute the cosine similarity of the query embedding to a
   precomputed and disk-cached embedding of every (canonical
   + alias) string; admit the top entry if its cosine similarity
   exceeds a configurable threshold.

The family-priority list is the central novel mechanism: by
specifying the priority order at construction time, the
resolver's behavior on cross-family collisions becomes
operator-determined rather than implementation-defined, and
identical across operating-system environments and hash-table
seedings.

In an embodiment, the resolver further records every alias
collision encountered during index construction in a debug
manifest, permitting later audit of which queries are
priority-disambiguated and against which alternatives.

## V. Brief Description of the Drawings

**Figure 1.** Bundle-Grounded Narrative Generator data flow:
fact bundle → prompt template → generative model → validator
chain → emit-narrative or emit-template decision.

**Figure 2.** Detailed validator chain showing the five
post-generation checks (numeric fidelity, length, marketing-free,
entity-grounded, no-external-causation) and their respective
heuristics.

**Figure 3.** Provider-agnostic generative-model dispatcher with
three illustrated providers (air-gap local, hosted API #1,
hosted API #2) and a disabled-mode bypass returning the
deterministic template directly.

**Figure 4.** Family-Priority Cascade Resolver pipeline: query
→ direct code → prefix-stripped → alias → lexical+lev hybrid →
optional embedding → resolution.

**Figure 5.** Illustration of family-priority tie-breaking on
the alias "pharma" colliding between SIC 2834 and HS 30, with
the family priority list `[country, us_state, mesh, sic, cpc, hs]`
yielding deterministic SIC-2834 selection.

**Figure 6.** Illustration of family-priority tie-breaking on
the canonical name "Georgia" colliding between ISO-3166 GEO
and US-state GA, yielding deterministic GEO selection under
the same family-priority list.

## VI. Detailed Description

### A. Bundle-Grounded Narrative Generator: bundle structure

The fact bundle is a structured object with at minimum the
following fields:

```
{
    entity_raw:        string,        // raw identifier from the source
    entity_resolved:   string,        // human-readable entity name
    composite:         float in [0,1],
    anomaly:           float in [0,1],
    reconstruction:    float in [0,1],
    diversity:         float in [0,1],
    peer_rank:         int (optional),
    universe_size:     int (optional),
    cluster_rank:      int (optional),
    cluster_size:      int (optional),
    corpus_id:         string (optional),
    corpus_domain:     string (optional),
    reproducibility_digest: SHA256 (optional),
    null_test:         { z_score: float, p_value: string,
                         iterations: int } (optional),
    top_line_concept:  string (optional),
    concept_gloss:     string (optional)
}
```

The bundle is constructed by an upstream component that has the
authority to assert each field; the bundle's content is the
authoritative fact set against which the narrative is later
validated.

### B. Provider-agnostic generative-model dispatcher

The dispatcher selects among configured providers based on a
single environment variable or configuration field. In a
preferred embodiment the providers include:

- **Air-gap provider.** Issues a chat-completion request to a
  locally-running model server (e.g., Ollama) over a Unix
  socket or loopback HTTP; no network egress occurs.
- **Hosted API provider #1.** Issues a request to a remote
  hosted model API requiring an API key.
- **Hosted API provider #2.** As above, with a different vendor.
- **Disabled.** No generation is attempted; the deterministic
  template is returned directly.

The dispatcher's configuration is read at request time, allowing
the operator to switch providers without redeploying the
application.

### C. Validator chain: numeric-fidelity check

The numeric-fidelity check operates as follows:

1. Compute the set `B` of admissible numeric tokens from the
   bundle. Each numeric field contributes its value formatted
   to one decimal, two decimals, three decimals, and as the
   nearest integer; values in [0, 1] additionally contribute
   their percent representation. Counted fields (peer_rank,
   universe_size, etc.) contribute their integer representation.
   Derived statistics — for example, `round(peer_rank /
   universe_size · 100)` and its one-decimal form — are
   admitted as bundle-traceable.
2. Extract every numeric token from the narrative via a fixed
   regular expression matching signed decimals.
3. For each extracted token, ignore (i) integer year-like
   tokens in `[1900, 2100]` and (ii) trivial integers `0` and
   `1`. For all remaining tokens, require membership in `B`.
4. Emit `numeric_fidelity_ok = true` if and only if every
   non-ignored token is in `B`; otherwise emit `false` along
   with a list of the offending tokens.

### D. Validator chain: external-causation check

The external-causation check searches the narrative for any
phrase from an enumerated forbidden-phrase list, including but
not limited to "stems from," "in response to," "caused by,"
"due to the," "because of the," "as a result of," "in the
wake of," "attributable to," and "owing to the." A
non-empty match indicates a causation claim that the bundle
cannot underwrite, and the narrative is rejected.

The forbidden-phrase list is intentionally narrower than the set
of all causation phrasings in natural English; specifically,
analytical attributive phrases such as "driven by" are
*excluded* from the forbidden list because empirical observation
has shown them to occur regularly in legitimate analytical prose
(e.g., "driven by isolation from peer fingerprint space"
refers to an intrinsic bundle property rather than an external
event).

### E. Validator chain: entity-and-concept grounding check

The entity-and-concept grounding check requires that both (i)
the bundle's organization name (or a recognized abbreviation,
ticker, or capitalized two-word fragment thereof) and (ii) the
bundle's concept (the line-item being narrated, including
camel-case-split variants and substring matches on words of
length ≥ 4) appear in the narrative. The check fails if either
side is missing — a generated narrative that names the right
organization but discusses the wrong concept (e.g., naming
"JPMorgan Chase & Co." but describing its "Revenue" when the
bundle is about "Goodwill") is rejected.

### F. Deterministic template

The deterministic template is a pure function of the bundle that
emits a grounded analyst-style narrative employing only bundle
fields, employing no causation phrasing, and respecting tone
constraints. The template's output is bit-identical for
bit-identical bundle input. In `LO_NARRATIVE_MODE=off`
configuration, the dispatcher returns the template output
directly without invoking any generative model.

### G. Family-Priority Cascade Resolver: data structures

The resolver is constructed from a list of ontologies, each
ontology being a list of entries of the shape

```
{
    code:            string,
    canonical_name:  string,
    family:          string,
    aliases:         list<string>,
    parent:          string | null,
    description:     string | null
}
```

A `FAMILY_PRIORITY` list orders families by deterministic
preference; for example,

```
FAMILY_PRIORITY = ["country", "us_state", "mesh", "sic", "cpc", "hs"]
```

specifies that a tie among ontologies on alias "pharma" resolves
to the SIC entry rather than the HS entry, because `sic` precedes
`hs` in the priority list.

### H. Family-Priority Cascade Resolver: index construction

The code index is populated by mapping each entry's lower-cased
code to the entry; the alias index is populated as follows:

```
for entry e in all_entries:
    for alias a in e.aliases:
        key = a.lower()
        if key not in alias_index:
            alias_index[key] = e
        else:
            existing = alias_index[key]
            if family_rank(e.family) < family_rank(existing.family):
                alias_index[key] = e
            // record collision in the debug manifest regardless
```

The `family_rank` function is a constant-time lookup that
returns the index of the family in the `FAMILY_PRIORITY` list,
or a sentinel large integer for unrecognized families. The
alias-index construction is deterministic given (a) the set of
ontology entries and (b) the family-priority list, regardless
of the iteration order of individual entries.

### I. Family-Priority Cascade Resolver: lexical scoring

The Stage 4 lexical scoring computes, for each entry `e` and
each candidate string `t ∈ {e.canonical_name} ∪ e.aliases`,
the hybrid score

```
score(query, t) = w_J · jaccard(tokens(query), tokens(t))
                + w_C · char_ngram_sim(query, t, n=3)
                + w_L · levenshtein_sim(query, t)
```

with `w_J + w_C + w_L = 1` (e.g. 0.4, 0.2, 0.4); the entry's
score is the maximum over its candidate strings. Entries with
score above a candidate-floor threshold (e.g. 0.10) are sorted
descending by score and ascending by family rank; the top entry
is admitted as a resolution if its score exceeds a resolve
threshold (e.g. 0.35).

### J. Family-Priority Cascade Resolver: optional embedding stage

In a preferred embodiment, an optional Stage 5 embedding-search
fallback may be activated by the operator. When activated, an
embedding model (e.g., `all-MiniLM-L6-v2`) computes an
embedding of every (canonical + alias) string at construction
time, persists those embeddings in a content-addressed disk
cache keyed by a hash of the ontology contents, and at
resolution time computes the cosine similarity between the query
embedding and the cached set, admitting the top entry if its
cosine exceeds a configurable threshold. Family-priority is
applied as a deterministic tiebreaker on equal cosines.

The embedding stage is opt-in to preserve the deterministic
behavior of stages 1–4 in default deployments; when disabled,
the resolver remains air-gap-deployable with no model
dependencies.

### K. Composition with upstream substrates

In a preferred embodiment, both subsystems of the present
invention compose with the upstream substrates referenced in
the cross-references section. Specifically:

- The Bundle-Grounded Narrative Generator may consume bundles
  produced by the Substrate Engine, using the bundle's
  reproducibility digest as part of the deterministic-fallback
  template's identity.
- The Family-Priority Cascade Resolver may resolve raw
  fingerprint identifiers — for example, `fact_320193_Revenue`
  in the SEC EDGAR domain — to a human-readable
  `entity_resolved` field of the bundle that the narrative
  generator subsequently consumes.

The two subsystems are independent and may be used standalone.

## VII. Claims

The following claims are illustrative and non-limiting.

1. A computer-implemented system for safely deploying a
   generative machine-learning model, comprising:
   (a) a fact-bundle interface receiving a structured set of
       facts including at least one numeric field and at least
       one named-entity field;
   (b) a provider-agnostic generative-model dispatcher
       configured to issue a generation request to any of an
       air-gap local-model provider, a hosted-API provider, or
       a disabled-mode bypass returning a deterministic
       template;
   (c) a multi-dimensional post-generation validator chain
       comprising at least a numeric-fidelity validator
       requiring each numeric token of the generated output to
       trace to said fact bundle, an entity-and-concept
       grounding validator requiring both the bundle's
       organizational entity and conceptual line-item to
       appear in the generated output, and an
       external-causation validator rejecting outputs
       containing any of an enumerated set of causation
       phrases; and
   (d) an emission selector configured to emit the generated
       output if and only if all validators pass, and otherwise
       to emit a deterministic template, in either case
       accompanied by a binary safety verdict.

2. The system of claim 1 wherein the numeric-fidelity validator
   admits as bundle-traceable the value `round(peer_rank /
   universe_size · 100)` whenever `peer_rank` and
   `universe_size` are present in the fact bundle.

3. The system of claim 1 wherein the entity-and-concept
   grounding validator admits as a name-match any contiguous
   pair of capitalized tokens of length at least three drawn
   from the bundle's organization name.

4. The system of claim 1 wherein the external-causation
   validator's enumerated phrase list excludes attributive
   phrases of the form "driven by" while including dated- or
   actor-bearing phrases including "stems from," "in response
   to," and "as a result of."

5. The system of any preceding claim wherein the binary safety
   verdict is bit-deterministic for given bundle and template
   inputs.

6. A computer-implemented system for resolving short-string
   identifiers to canonical entries across a plurality of
   overlapping ontologies, comprising:
   (a) a plurality of ontology entries each comprising a code,
       a canonical name, a family identifier, and zero or more
       aliases;
   (b) an operator-supplied family-priority list specifying a
       deterministic ordering over family identifiers;
   (c) an index-construction module configured to build a
       code index and an alias index over said entries, said
       alias index resolving cross-family collisions by
       selecting the entry whose family appears earliest in
       said family-priority list; and
   (d) a layered resolution cascade configured, for a query
       string, to apply in order: a direct code lookup; a
       prefix-stripped code lookup; an alias lookup; a lexical
       similarity scoring combining Jaccard, character-n-gram,
       and Levenshtein components with the family-priority list
       as deterministic tiebreaker; and optionally a semantic
       embedding fallback whose embedding outputs are
       persistently cached and keyed by a hash of the ontology
       contents.

7. The system of claim 6 wherein the lexical similarity scoring
   computes its score per entry as the maximum over (a) the
   entry's canonical name and (b) each of the entry's aliases.

8. The system of claim 6 wherein the prefix-stripped code
   lookup applies a regular expression matching at least
   `mesh_`, `commodity_`, `region_`, `state_`, `cpc_`, `sic_`,
   `country_`, `iso_`, `HS-`, and `noaa_` prefixes,
   case-insensitively.

9. The system of claim 6 wherein the embedding fallback is
   opt-in via configuration and is silently disabled when
   embedding-library dependencies are unavailable, in which
   case the cascade terminates after stage 4 with no error.

10. The system of any preceding claim further configured to
    record every cross-family alias collision in a debug
    manifest at index-construction time, said manifest
    queryable at runtime to disclose which inputs are
    priority-disambiguated.

11. A computer-implemented method comprising the operations
    recited in any of claims 1–10.

12. A non-transitory computer-readable medium storing
    instructions that, when executed by one or more processors,
    cause said processors to perform the operations recited in
    any of claims 1–10.

13. The system of any preceding claim wherein the fact bundle
    of claim 1 is produced by, or the ontology of claim 6 is
    consumed by, an upstream deterministic structural-
    fingerprint engine as disclosed in commonly-owned
    provisional application provisional_01_btut_primitive.

## VIII. Abstract

A two-part safety system for analytical generative deployments
is disclosed. The first part comprises a fact-bundle interface
feeding a provider-agnostic generative-model dispatcher (with
air-gap, hosted-API, and disabled-mode embodiments) whose output
is subjected to a multi-dimensional post-generation validator
chain — numeric-fidelity, entity-and-concept grounding,
external-causation absence, and marketing-tone absence — and
emitted only when all validators pass; otherwise, a deterministic
template grounded in the same bundle is emitted in place. The
second part comprises a layered entity-resolution cascade —
direct code, prefix-stripped code, alias, hybrid lexical
(Jaccard plus character-n-gram plus Levenshtein), and optional
semantic embedding — operating across a plurality of overlapping
ontologies with deterministic family-priority tie-breaking,
producing bit-identical outputs across operating-system
environments and hash-table seedings. The two parts are
independently practicable and compose with upstream deterministic
substrates.

---

*This document is a provisional application drafted by the
applicant for filing under 35 U.S.C. § 111(b). It has not been
reviewed by registered patent counsel. Applicant is advised to
have counsel review the application before filing, and to convert
to a non-provisional application under 35 U.S.C. § 111(a) within
twelve (12) months of the filing date in order to preserve the
priority claim.*
