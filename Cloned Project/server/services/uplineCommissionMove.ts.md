# `server/services/uplineCommissionMove.ts`

> Re-point a member's ALREADY-PAID Unilevel Plus commission at their current upline.

**Kind:** backend service · **Lines:** 516

<!-- docgen:auto -->

## Purpose
Re-point a member's ALREADY-PAID Unilevel Plus commission at their current
upline.

Moving someone in the referral tree only changes who earns on their FUTURE
sales — the historical ledger is immutable by design. When an admin moves a
member whose $25 purchase has already distributed, the payout keeps following
the old chain. This service performs that correction, and is shared by:

  - POST /garage-admin/users/:id/move-upline   (opt-in `moveCommissions` flag)
  - scripts/move-unilevel-commission.ts        (CLI, dry-run by default)

WHAT IT DOES
  Phase 1 — reverse every wallet transaction the original distribution wrote,
            by posting opposite entries. Originals are never mutated; the
            distribution is marked status "reversed". Atomic.
  Phase 2 — re-run distributeUnilevelPlusCommission against the CURRENT tree […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CommissionMoveParty` | interface |  | 46 |
| `CommissionMoveReversalLine` | interface |  | 52 |
| `CommissionMovePayoutLine` | interface |  | 59 |
| `CommissionMoveStatus` | type |  | 66 |
| `CommissionMoveResult` | interface |  | 78 |
| `previewUnilevelCommissionMove` | function | `async previewUnilevelCommissionMove(buyerId: string): Promise<CommissionMoveResult>` — Read-only. What WOULD change if the commission were moved now. | 145 |
| `applyUnilevelCommissionMove` | function | `async applyUnilevelCommissionMove(buyerId: string, opts: { actor?: string } = {}): Promise<CommissionMoveResult>` — Apply the correction. | 226 |

## Interfaces

- **Database (Mongoose models used):**
  - `UnilevelPlusDistribution` (server/models/unilevelPlusDistribution.model.ts) — reads: `find`, `findById`; **writes:** `updateOne`
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `find`; **writes:** `create`, `deleteMany`
  - `AffiliateWallet` (server/models/affiliateWallet.model.ts) — reads: `findById`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/models/affiliateWallet.model.ts` — `AffiliateWallet`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/unilevelPlusDistribution.model.ts` — `UnilevelPlusDistribution`
  - `server/services/unilevelPlusCommission.ts` — `distributeUnilevelPlusCommission`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/controllers/garageAdmin.controller.ts`
