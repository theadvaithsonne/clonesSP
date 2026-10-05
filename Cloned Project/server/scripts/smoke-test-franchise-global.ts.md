# `server/scripts/smoke-test-franchise-global.ts`

> End-to-end smoke test for the /franchise-global API + fulfilment flow.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 374

<!-- docgen:auto -->

## Purpose
End-to-end smoke test for the /franchise-global API + fulfilment flow.

DRY-RUN by default: prints what WOULD happen at each step; does not persist.
`--apply` runs the writes for real (creates assignment + invoice + payment
fulfilment) against whatever MONGODB_URI is set.

The test drives the same code paths the HTTP endpoints call — bypasses
express so we can inspect state at each step.

Steps:
  1. Pick a global sub-territory with NO existing FranchiseGlobalAssignment
     (or user-specified via --entity=ID).
  2. Pick a test buyer user (must already exist as a Garage user).
  3. Simulate `POST /franchise-global/assignments`:
       - Create FranchiseGlobalAssignment (pending_payment)
       - Mint franchise_global invoice via createInvoice […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `dotenv`
  - `mongoose` — `Types`

## Used by

Entry: run by hand: `npx tsx server/scripts/smoke-test-franchise-global.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`.
