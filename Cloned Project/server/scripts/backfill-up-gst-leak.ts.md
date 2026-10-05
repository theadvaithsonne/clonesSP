# `server/scripts/backfill-up-gst-leak.ts`

> BACKFILL: Reverse the GST leak on unilevel-plus commission distributions.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 410

<!-- docgen:auto -->

## Purpose
BACKFILL: Reverse the GST leak on unilevel-plus commission distributions.

Detection rule: any distribution where `saleAmount ≈ plan.productPrice × 1.18`.
That's the signature of the `invoice.ts:2457` bug (fixed) where the
tax-inflated `invoice.totalAmount` was used as the commission base.

Correction per flagged distribution:
  Only PERCENTAGE-based pool amounts are affected. Flat per-recipient
  amounts (infinity T1/T2 $0.60 each, pointValue $0.03) are correct.

  For each recipient in { direct, level, manager }:
      overpaid = amount - (amount / 1.18)
  → Debit `overpaid` from the recipient's AffiliateWallet.
  → Emit a WalletTransaction with type=debit, description tagged so it's
    visible in the user's ledger.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Raw collections:** `users`, `unilevelplusdistributions`, `unilevelplusplans`, `affiliatewallets`, `wallettransactions`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Types`
  - `dotenv`
  - `dns`

## Used by

Entry: run by hand: `npx tsx server/scripts/backfill-up-gst-leak.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`, `--allow-negative`.
