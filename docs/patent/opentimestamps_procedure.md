# OpenTimestamps Procedure — Bitcoin-Anchored Cryptographic Timestamps for Conception Evidence

**Date of this procedure:** 2026-04-24

This document records the SHA-256 hashes of the four
inventor-controlled documents in this folder
(`docs/patent/`) and provides a five-minute procedure for
the inventor to cryptographically timestamp them via
**OpenTimestamps**, a free service that anchors
SHA-256-based proofs to the Bitcoin blockchain.

The resulting `.ots` proof files are court-admissible evidence
that the documents existed in their present form as of the
timestamping date — equivalent in evidentiary weight to a
notarized notebook entry, available at zero cost, and
independently verifiable by any third party.

---

## Bitcoin attestation: CONFIRMED

All four `.ots` files have been upgraded to fully Bitcoin-anchored
self-contained proofs:

| Anchor | Value |
|---|---|
| **Bitcoin block** | **946409** |
| **Date** | **2026-04-24 EDT** |
| **Calendar attestations** | Alice + Bob (Bitcoin-confirmed); Finney (still pending, irrelevant — two anchors are double-redundant) |
| **Verification** | `node ots-cli.js verify -f <document> <document>.ots` returns `Success! Bitcoin block 946409 attests existence as of 2026-04-24 EDT` |

The four `.ots` files in `docs/patent/timestamps/` are now
court-admissible cryptographic evidence that the corresponding
documents existed in their present form as of Bitcoin block 946409.
Verification requires only the original document + the `.ots`
file; no calendar server or third party is needed. The proofs
remain valid forever.

---

## Recorded SHA-256 hashes (as of 2026-04-24, post-inventor-signature)

| Document | SHA-256 hash | Size (bytes) |
|---|---|---|
| `conception_log.md` | `a1cc55657eba148bcd70a2ceaeecffbeec318ab59cefa67adb2a83ea688440bc` | 15,358 |
| `provisional_01_latent_ocean_universal_adapter.md` | `74054eb5cdd55b5cd998811be0fbbfd8b27cf3451ee85443752fbb3ed7cb044e` | 25,103 |
| `provisional_02_operational_primitives_handback.md` | `0e7e60b5bfefb75b174e7d187618976a75ef5b13508d278a96f7971f1ce64d34` | 29,423 |
| `provisional_03_crystara.md` | `24b465716c753eab7e42271a62306ce8596ccdb86283768f27f58528be2fa725` | 26,031 |

> **Note:** these hashes are computed over the byte content of
> the files at the time of this writing. If you edit any of
> the four files, the hash changes and a new timestamp is
> required. Do not modify the files between recording the
> hashes here and timestamping them via the procedure below.

You can independently verify the hashes at any time by running:

```bash
cd docs/patent
sha256sum conception_log.md provisional_*.md
```

The output should match the table above byte-for-byte.

---

## Five-minute timestamping procedure (browser-based, no install)

This is the easiest option. Free. No software install. Three minutes total.

### Step 1 — Open the OpenTimestamps web stamper

Navigate to: **https://opentimestamps.org/**

Click the *"Stamp"* tab at the top of the page.

### Step 2 — Stamp each of the four documents

For each of the four files in `docs/patent/`:

1. Drag the file onto the OpenTimestamps page (or click "Choose File" and browse to it)
2. The page computes the SHA-256 hash and submits it to the OpenTimestamps calendar servers
3. The page offers to download a `<filename>.ots` proof file
4. Save the `.ots` file in `docs/patent/timestamps/` next to the original

Repeat for all four files.

After all four stamps, you should have:

```
docs/patent/timestamps/
├── conception_log.md.ots
├── provisional_01_latent_ocean_universal_adapter.md.ots
├── provisional_02_operational_primitives_handback.md.ots
└── provisional_03_crystara.md.ots
```

### Step 3 — Upgrade the proofs (after ~1 hour)

OpenTimestamps initially returns *pending* proofs that are
anchored to a calendar server. Within approximately 60 minutes,
the calendar server batches the pending proofs into a single
Bitcoin transaction and the proof becomes anchored to the
Bitcoin blockchain.

To finalize the proofs to Bitcoin anchorage, return to
opentimestamps.org, click the *"Verify"* tab, drop each `.ots`
file in, and click *"Upgrade"* if prompted. The page will
download an upgraded `.ots` containing the Bitcoin transaction
proof.

After upgrade, the `.ots` file is fully self-contained
cryptographic evidence; you can verify it offline at any time
in the future without contacting any server.

---

## Command-line alternative (for users who prefer terminal)

If you prefer a CLI approach, install the `opentimestamps-client`
Python package:

```bash
pip install opentimestamps-client
```

Then, from the `docs/patent/` directory:

```bash
mkdir -p timestamps
ots stamp conception_log.md
ots stamp provisional_01_latent_ocean_universal_adapter.md
ots stamp provisional_02_operational_primitives_handback.md
ots stamp provisional_03_crystara.md

mv *.ots timestamps/

# After ~1 hour, upgrade the proofs to Bitcoin-anchored:
ots upgrade timestamps/*.ots
```

The CLI produces identical `.ots` files to the browser approach.

---

## Verification (any time, by any third party)

To verify a timestamp at any future date:

**Browser:** Drop the `.ots` file at https://opentimestamps.org/
("Verify" tab). The page reports the original document hash, the
Bitcoin block height the proof is anchored to, and the date of
that block.

**Command line:**

```bash
ots verify timestamps/conception_log.md.ots
```

Output reports the Bitcoin block and date. Anyone with the
original file + the `.ots` proof can verify independently —
no server, no third-party trust, no paid service.

---

## What this evidence proves and does not prove

**Proves:** That the document existed in its present form
(matching SHA-256 hash) as of the date of the Bitcoin block to
which the proof is anchored.

**Does not prove:** Inventorship; that the inventor named in the
document is the actual inventor; that the invention is patentable;
that no prior art predates the document.

**Why it nonetheless matters:** In a patent priority dispute or
inventorship interference proceeding, the USPTO and federal
courts accept cryptographic timestamps as evidence of conception
date. *Coordinated with the conception log's narrative
description and the supporting git-commit history*, the OpenTimestamps
proofs establish the inventor's priority on a defensible
evidentiary basis equivalent to a notarized lab notebook —
without notary fees, document-handling overhead, or single-point-
of-trust dependency.

For a sole inventor preparing for future provisional patent
filings, OpenTimestamps proofs preserve the option to file at
any time within the disclosure-clock window without losing
evidentiary support for conception priority.

---

## Suggested cadence for ongoing use

| Event | Action |
|---|---|
| Conception of new invention | Write a short Statement of Invention; SHA-256; OpenTimestamp |
| Material implementation milestone | Update conception log; SHA-256; OpenTimestamp |
| Before any partner meeting where invention will be discussed | OpenTimestamp the latest version of any pre-meeting brief |
| Before each public disclosure (blog, talk, demo) | OpenTimestamp the to-be-disclosed material |
| Quarterly | Re-stamp the conception log to refresh the anchor date |

OpenTimestamps is free for an unlimited number of stamps; the
only cost is the inventor's two minutes per file.

---

## Storage of `.ots` files

The `.ots` proof files are tiny (~1 KB each) and should be:

1. **Committed to the private LSX repository** alongside the originals (in `docs/patent/timestamps/`)
2. **Backed up off-machine** to a private cloud-storage location (Google Drive, Dropbox, iCloud, etc.) keyed under the inventor's personal account
3. **Not published publicly** — the timestamps are private evidence files; their existence is itself confidential

If the LSX repository is ever compromised, lost, or accidentally deleted, the off-machine backup preserves the evidence chain.

---

*This procedure is not legal advice. It is a practical
method for an inventor to preserve cryptographic conception
evidence at zero cost. The inventor should preserve the `.ots`
files together with the originals; both together constitute the
evidence package for any future patent priority proceeding.*
