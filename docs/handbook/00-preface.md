---
slug: preface
number: 0
title: Preface
promise: "After reading this preface you know who the book is for, what background it assumes, and how to read it."
status: draft
---

# Preface

> After reading this preface you know who the book is for, what background it assumes, and how to read it.

## Who this book is for

The primary reader of this book has written code before. The book
assumes familiarity with variables, functions, control flow, files,
and the command line, at the level of a working data analyst or
software engineer. It does not assume the reader has run a clustering
pipeline, an embedding job, or an unsupervised learning analysis.
Every substrate-clustering concept this book uses is introduced as
it appears, with a worked example that the reader can run against a
bundled toy corpus.

The secondary reader is a domain expert without a programming
background: an auditor, a researcher, a journalist, a compliance
officer, a scientist who has heard the words "deterministic" and
"falsifiable" but has not seen a `.ocean` file. This reader is
welcome. Each chapter has a "Wider system" sidebar that summarizes
how that chapter's material fits the broader infrastructure story.
Reading just those sidebars, in order, produces a coherent picture
of why OCEAN exists and what it is for. The runnable snippets in
between can be skipped without losing the thread.

## What this book is not

This book is not the formal reference. The normative reference for
the OCEAN language is at `docs/OCEAN_LANG.md` in the LatentOcean
repository. That document is the language standard: every grammar
rule, every type rule, every operator signature, in the terse and
complete style of an ISO standard. When this book disagrees with
the formal reference, the formal reference wins.

This book is not the primitive spec. The fingerprint primitive that
underlies the proprietary embedding operator is documented at
`docs/PRIMITIVE_SPEC.md`. Appendix C of this book is a short companion
to that spec, but the spec itself is the contract.

This book is not the MCP server README. The OCEAN MCP server,
which exposes the language as a set of tools for AI coding agents,
is documented at `packages/ocean-mcp/README.md`. Chapter 12 of this
book covers how to use it, but the README is the install guide.

What this book is: the one document a reader picks up to learn OCEAN
from foundations, in the style of a "Programming Language" book
rather than a standard or a manual page.

## Three reading paths

Three documented paths through the book.

**"Write OCEAN today."** Chapters 1, 2, 4, 5, 6, 7, 8, 9, 10. Skim the
others. About three hours.

**"Understand the system."** Preface, chapter 1, every "Wider system"
sidebar in order, chapter 13, chapter 14. About one hour. This is
the domain-expert path.

**"The whole book."** Cover to cover. About six hours read, two days
work, if every exercise is attempted.

## Conventions

Fenced code blocks marked ```ocean are OCEAN source. Some of these
are runnable in the web view of this handbook; clicking the **Run**
button executes the snippet in a sandbox against one of the three
bundled toy corpora. Snippets that depend on a local corpus or on
premium operators are tagged static and do not have a Run button;
the reader runs them by copying to a `.ocean` file and using the
compiler.

The first introduction of a term that has a glossary entry is set
in italics, like _substrate_ or _module_. Appendix D defines every
italicized term.

The bundled toy corpora are described in Appendix B alongside the
operator catalog.

The complete grammar is in Appendix A. The reference card on
Appendix E fits on one printable page.

## Where to start

The reader who is here for a quick answer: chapter 1 takes 20
minutes and ends with a six-line program that runs end-to-end on a
real corpus.

The reader who is here for the full picture: the next paragraph is
the first sentence of chapter 1. Start there.
