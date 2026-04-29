# Latent Ocean: Defense and Intelligence Tear Sheet — Source Hashes

**Computed:** 2026-04-28
**Algorithm:** SHA-256
**Tool:** Node v22.14.0 `crypto.createHash('sha256')`

## Canonical hashes

| File | SHA-256 |
|---|---|
| `docs/commercial/defense/master-tear-sheet.md` | `ab9c948c4b331abd6cebdfacaf4b04fa5cbaefccea7175af956b7f9e6e9d39de` |
| `docs/superpowers/specs/2026-04-28-defense-tear-sheet-design.md` | `990ad57108198d8e81b3e60e4be3f9783c0f8140473413f567efcd6fde3cb9ab` |

## Verification (re-compute)

    node -e "const c=require('crypto'),f=require('fs'); console.log(c.createHash('sha256').update(f.readFileSync('docs/commercial/defense/master-tear-sheet.md')).digest('hex'));"

Any divergence from the published value above means the file was modified after this hash was recorded.

## OpenTimeStamps anchoring

The markdown source is the canonical artifact. Anchoring is performed on the `.md` file directly (rendered derivatives such as PDF, HTML, or PPTX are downstream and may carry their own hashes independently). Once anchored, proof files sit alongside their source:

- `docs/commercial/defense/master-tear-sheet.md.ots`
- `docs/superpowers/specs/2026-04-28-defense-tear-sheet-design.md.ots`

To anchor (from a terminal where `ots` runs cleanly):

    ots stamp docs/commercial/defense/master-tear-sheet.md
    ots stamp docs/superpowers/specs/2026-04-28-defense-tear-sheet-design.md

Calendar servers (alice, bob, finney by default) accept the SHA-256 digest and return a calendar attestation. Bitcoin-block confirmation typically arrives within a few hours; `ots upgrade` then updates the proof files once the calendar attestations are committed to the chain.

## Local-machine note (2026-04-28)

The Python OpenTimeStamps client (`opentimestamps-client` 0.7.2) on the authoring machine currently fails to load due to an OpenSSL DLL resolution error inside `python-bitcoinlib`'s `bitcoin.core.key` import. The anchoring step should be run from a working terminal, either by repairing the Python install or by installing the JavaScript client (`npm install -g javascript-opentimestamps`).

This file records the canonical hashes so that anchoring can be performed asynchronously without losing the chain of custody between authorship time (2026-04-28) and Bitcoin attestation time. The hash above does not change when the OTS proof is later attached.

## IP posture

Trade secret with OpenTimeStamps cryptographic anchoring on public capability declarations. No patents filed. No patent-pending claims. The hash above is the public-time-anchor handle for this artifact's content; the underlying algorithmic and implementation work remains protected as trade secret in the source repository.
