# `server/scripts/verify-third-party-term-pricing.ts`

> Golden replay: prove the term-pricing change is a no-op for existing monthly subscriptions.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 119

<!-- docgen:auto -->

## Purpose
Golden replay: prove the term-pricing change is a no-op for existing monthly
subscriptions.

READ-ONLY. For each recent third-party child invoice, re-derives what
`priceThirdPartyChildCycle` would produce today and diffs it against what was
actually billed. Expect ZERO differences except GST for buyers whose profile
country changed since the parent was created — and that set is the exact,
quantified blast radius of the child-GST recompute.

Usage:
  npx tsx src/scripts/verify-third-party-term-pricing.ts [limit]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `find`, `findById`
- **Environment variables (`process.env`):** `MONGODB_URI`, `MONGO_URI`

## Dependencies

- **Internal:**
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/services/thirdPartyTerms.ts` — `priceThirdPartyChildCycle`
- **Packages:**
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/verify-third-party-term-pricing.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
