# `server/services/aivatarWallet.service.ts`

> Module exporting `getOrCreateAivatarWallet`, `deductAivatarCreditsWithDebt`, `addAivatarCredits`, `clearAivatarDebt`.

**Kind:** backend service · **Lines:** 192

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ENRICH_COST_CENTS` | const | `= 10` | 5 |
| `MAX_DEBT_CENTS` | const | `= 200` | 6 |
| `WELCOME_BONUS_CENTS` | const | `= 2500` | 7 |
| `InsufficientBalanceError` | class | `extends Error` | 9 |
| `DebtLimitReachedError` | class | `extends Error` | 19 |
| `MutatorOptions` | interface |  | 29 |
| `getOrCreateAivatarWallet` | function | `async getOrCreateAivatarWallet(orgId: string): Promise<IAivatarWallet>` | 36 |
| `deductAivatarCreditsWithDebt` | function | `async deductAivatarCreditsWithDebt(orgId: string, amountCents: number, description: string, options: MutatorOptions = {}): Promise<{ wallet: IAivatarWallet; deductedFromBal…` | 45 |
| `addAivatarCredits` | function | `async addAivatarCredits(orgId: string, amountCents: number, description: string, options: MutatorOptions = {}): Promise<IAivatarWallet>` | 107 |
| `clearAivatarDebt` | function | `async clearAivatarDebt(orgId: string, options: MutatorOptions & { adminEmail: string; note: strin…): Promise<IAivatarWallet>` — Admin-only: zero out a wallet's debt without requiring a credit. | 159 |

## Interfaces

- **Database (Mongoose models used):**
  - `AivatarWallet` (server/models/aivatarWallet.model.ts) — reads: `findOne`; **writes:** `create`, `findOneAndUpdate`

## Dependencies

- **Internal:**
  - `server/models/aivatarWallet.model.ts` — `AivatarWallet`, `IAivatarWallet`
  - `server/services/aivatarWalletTransaction.service.ts` — `recordTransaction`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/garageAdminWallets.ts`
- `server/routes/org.ts`
- `server/routes/wallet.ts`
