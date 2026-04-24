# OpenTimestamps Upgrade Log — Finney Calendar Attestation Tracking

**Goal:** Track the Finney (Eternity Wall) calendar's Bitcoin
attestation for each of the four `.ots` files, until all are
fully triple-anchored (Alice + Bob + Finney all Bitcoin-confirmed).

**Current state of all four .ots files** (Alice + Bob already
Bitcoin-confirmed at block 946409 on 2026-04-24):

| File | Alice | Bob | Finney |
|---|---|---|---|
| conception_log.md.ots | ✅ block 946409 | ✅ block 946409 | ⏳ pending |
| provisional_01_*.ots | ✅ block 946409 | ✅ block 946409 | ⏳ pending |
| provisional_02_*.ots | ✅ block 946409 | ✅ block 946409 | ⏳ pending |
| provisional_03_*.ots | ✅ block 946409 | ✅ block 946409 | ⏳ pending |

**Note:** Alice + Bob alone is already double-redundant Bitcoin
proof. Finney finalization is a "nice to have" third anchor; it
does not affect the proof's validity or evidentiary weight.

---

## Check log

| Timestamp (UTC) | conception_log | provisional_01 | provisional_02 | provisional_03 | Action taken |
|---|---|---|---|---|---|
| 2026-04-24 16:35 | Finney pending | Finney pending | Finney pending | Finney pending | Baseline; reschedule check in ~45 min |
