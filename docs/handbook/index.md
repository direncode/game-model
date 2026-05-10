---
slug: index
number: null
title: The OCEAN Handbook
promise: "Foundations-up reference for the OCEAN substrate-clustering language."
status: draft
---

# The OCEAN Handbook

> Foundations-up reference for the OCEAN substrate-clustering language.

## Table of contents

### Front matter

- [Preface](./00-preface) (audience, reading paths, conventions)

### Chapters

1. [What OCEAN Is](./01-what-ocean-is)
2. [Your First Pipeline](./02-your-first-pipeline)
3. [Source Files and Tokens](./03-source-files-and-tokens)
4. [The Pipeline Types](./04-the-pipeline-types)
5. [`load` and `Records`](./05-load-and-records)
6. [`embed` and `Z`](./06-embed-and-z)
7. [`cluster` and `Modules`](./07-cluster-and-modules)
8. [`align` and `find`](./08-align-and-find)
9. [`save` and the Determinism Contract](./09-save-and-the-determinism-contract)
10. [Control Flow](./10-control-flow)
11. [Functions, Modules, Stdlib](./11-functions-modules-stdlib)
12. [Tooling and the LSP](./12-tooling-and-the-lsp)
13. [Effective OCEAN](./13-effective-ocean)
14. [Interfacing OCEAN](./14-interfacing-ocean)

### Appendices

- [Appendix A: Grammar (EBNF)](./app-a-grammar)
- [Appendix B: Operator Catalog](./app-b-operator-catalog)
- [Appendix C: Primitive Spec Companion](./app-c-primitive-spec-companion)
- [Appendix D: Glossary](./app-d-glossary)
- [Appendix E: Reference Card](./app-e-reference-card)
- [Appendix F: Exercise Solutions](./app-f-exercise-solutions)

## Three reading paths

### Path 1: Write OCEAN today (about three hours)

Read chapters in this order, skipping the rest until later: 1, 2,
4, 5, 6, 7, 8, 9, 10. By the end you have run a complete pipeline,
read the artifact, understood the type system, and learned every
verb and the main control-flow forms.

### Path 2: Understand the system (about one hour)

For the reader who wants the big picture without writing code:
preface, chapter 1, every "Wider system" sidebar in order, chapter
13, chapter 14. This path produces a coherent picture of why OCEAN
exists and what it is for, without requiring any programming work.

### Path 3: The whole book (about six hours read, two days work)

Cover to cover, with every exercise attempted. This is the path for
the reader who plans to ship pipelines in production or who wants
to contribute to the language.

## Where to find the canonical reference

This handbook is the foundations-up book. For the normative
language specification, see [`docs/OCEAN_LANG.md`](../OCEAN_LANG.md).
For the fingerprint primitive contract, see
[`docs/PRIMITIVE_SPEC.md`](../PRIMITIVE_SPEC.md). For the MCP server
install guide, see [`packages/ocean-mcp/README.md`](../../packages/ocean-mcp/README.md).

## A note on versions

This handbook documents OCEAN 1.0. The version of OCEAN that
shipped with this handbook is the version printed by `ocean
version` from a fresh checkout of the LatentOcean repository.
Breaking changes to OCEAN bump the major version; new features bump
minor; bug fixes bump patch. The handbook tracks the language
version.
