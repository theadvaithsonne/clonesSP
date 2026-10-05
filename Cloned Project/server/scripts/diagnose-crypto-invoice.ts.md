# `server/scripts/diagnose-crypto-invoice.ts`

> Ops-only helper for the crypto payment pipeline.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 228

<!-- docgen:auto -->

## Purpose
Ops-only helper for the crypto payment pipeline. Three modes:

  npx tsx src/scripts/diagnose-crypto-invoice.ts <invoiceIdOrNumber>
    Prints the invoice + every CryptoPaymentRequest attached to it
    (status, expected atomic amount, TTL). Best first stop when a
    payment "was received but the invoice isn't paid."

  npx tsx src/scripts/diagnose-crypto-invoice.ts \
    --reconcile <invoiceIdOrNumber> <requestId> <txHash> [<fromAddress>]
    Manually flips the named pending request to matched → runs the
    same markMatched path the poller would, so fulfillInvoice fires
    identically. Use ONLY after cross-checking the on-chain tx.
    Dry-run by default; pass --apply to persist.

  npx tsx src/scripts/diagnose-crypto-invoice.ts --sweep <isoDate>
    Expires every `pending` CryptoPaymentRequest created BEFORE the […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findById`, `findOne`
  - `CryptoPaymentRequest` (server/models/cryptoPaymentRequest.model.ts) — reads: `find`, `findById`; **writes:** `updateMany`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/cryptoPaymentRequest.model.ts` — `CryptoPaymentRequest`
- **Packages:**
  - `dotenv`
  - `mongoose` — `Types`

## Used by

Entry: run by hand: `npx tsx server/scripts/diagnose-crypto-invoice.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `CryptoPaymentRequest` (updateMany).
- Command-line flags referenced: `--apply`, `--sweep`, `--reconcile`.
