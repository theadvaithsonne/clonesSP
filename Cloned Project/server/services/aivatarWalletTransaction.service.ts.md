# `server/services/aivatarWalletTransaction.service.ts`

> Module exporting `recordTransaction`.

**Kind:** backend service · **Lines:** 52

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RecordTransactionParams` | interface |  | 9 |
| `recordTransaction` | function | `async recordTransaction(params: RecordTransactionParams): Promise<IAivatarWalletTransaction>` — Insert a transaction row for a wallet mutation. | 28 |

## Interfaces

- **Database (Mongoose models used):**
  - `AivatarWalletTransaction` (server/models/aivatarWalletTransaction.model.ts) — reads: `findOne`; **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/aivatarWalletTransaction.model.ts` — `AivatarWalletTransaction`, `AivatarWalletTransactionType`, `AivatarWalletTransactionSource`, `IAivatarWalletTransaction`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/services/aivatarWallet.service.ts`
