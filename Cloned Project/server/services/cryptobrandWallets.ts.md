# `server/services/cryptobrandWallets.ts`

> Cryptobrand multi-currency wallet lifecycle.

**Kind:** backend service · **Lines:** 225

<!-- docgen:auto -->

## Purpose
Cryptobrand multi-currency wallet lifecycle.

Every member of an org where `officeCreatedFromCryptobrand === true`
gets one wallet per currency in CRYPTOBRAND_ALL_CURRENCIES. USD is
the parent (no parentWalletId); INR/ETH/BTC each carry
`parentWalletId` pointing at the USD wallet for the same
(userId, orgId) pair.

Contract:
  • `ensureCryptobrandWallets(userId, orgId)` — no-op on non-cryptobrand
    orgs; on cryptobrand orgs, upserts the USD wallet first (so it
    always exists to serve as parent) then the sibling currency
    wallets.
  • Idempotent — safe to call from multiple hot paths (org create,
    invite accept, join-request approve, fetch endpoint safety-net).
  • Never mutates balance — only creates missing shells.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EnsureResult` | interface |  | 26 |
| `ensureCryptobrandWallets` | function | `async ensureCryptobrandWallets(userId: string, orgId: string): Promise<EnsureResult>` — Ensure the caller has all cryptobrand-currency wallets for this org. | 36 |
| `ensureMultiCurrencyWalletsForInvoice` | function | `async ensureMultiCurrencyWalletsForInvoice(userId: string, invoiceId: string): Promise<EnsureResult>` — Ensure multi-currency wallets for `userId` in the invoice's issuing org — the invoice's own line items decide whether the ensure fires even when the org isn't marked as a cryptobrand office. | 164 |
| `ensureCryptobrandWalletsFireAndForget` | function | `ensureCryptobrandWalletsFireAndForget(userId: string, orgId: string, context: string): void` — Fire-and-forget wrapper for hot paths where wallet creation shouldn't block the caller's response. | 213 |

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`, `find`; **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/organization.model.ts` — `Organization`
  - `server/config/cryptobrandCurrencies.ts` — `CRYPTOBRAND_EXTRA_CURRENCIES`, `CRYPTOBRAND_ALL_CURRENCIES`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/bond.ts`
- `server/routes/garageAdminStoreWallets.ts`
- `server/routes/guestAuth.ts`
- `server/routes/hifiInvoice.ts`
- `server/routes/invites.ts`
- `server/routes/org.ts`
- `server/routes/wallet.ts`
- `server/scripts/backfill-user-crypto-addresses.ts`
- `server/services/wallet.ts`
