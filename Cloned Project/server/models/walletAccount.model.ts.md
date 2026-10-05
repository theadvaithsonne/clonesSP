# `server/models/walletAccount.model.ts`

> src/models/walletAccount.model.ts Per-wallet payout account.

**Kind:** Mongoose model · **Lines:** 144

<!-- docgen:auto -->

## Purpose
src/models/walletAccount.model.ts
Per-wallet payout account. A wallet can hold at most one bank account AND
one crypto address (enforced by the unique index below). Replaces the
per-user BankDetails model — that data is migrated into affiliate-wallet
bank accounts (see scripts/migrateBankDetailsToWalletAccount.ts).

Keying by wallet:
  store           → { userId, orgId }      (one wallet per office)
  affiliate       → { userId, orgId: null }
  content_rewards → { userId, orgId: null }

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `WalletAccount`

- **Collection:** `walletaccounts` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `userId` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `walletType` | `String` | required, enum WALLET_ACCOUNT_WALLET_TYPES |
| `orgId` | `Schema.Types.ObjectId` | default null, ref "Organization" |
| `accountType` | `String` | required, enum WALLET_ACCOUNT_TYPES |
| `label` | `String` | default "" |
| `country` | `String` | default "" |
| `bankName` | `String` | default "" |
| `branchAddress` | `AddressSchema` | default () => ({}) |
| `routingNumber` | `String` | default "" |
| `accountNumber` | `String` | default "" |
| `swiftCode` | `String` | default "" |
| `ibanNumber` | `String` | default "" |
| `beneficiaryName` | `String` | default "" |
| `beneficiaryAddress` | `AddressSchema` | default () => ({}) |
| `cryptoNetwork` | `String` | default "" |
| `cryptoAddress` | `String` | default "" |
| `cryptoMemo` | `String` | default "" |
| `isActive` | `Boolean` | default true |

### Indexes

- `{ userId: 1, walletType: 1, orgId: 1, accountType: 1 }, { unique: true, name: "wallet_account_slot_unique" }` (L135)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WALLET_ACCOUNT_WALLET_TYPES` | const | `= [ "store", "affiliate", "content_rewards", ] as const` | 14 |
| `WalletAccountWalletType` | type |  | 19 |
| `WALLET_ACCOUNT_TYPES` | const | `= ["bank", "crypto"] as const` | 22 |
| `WalletAccountType` | type |  | 23 |
| `CRYPTO_NETWORKS` | const | `= [ "ethereum", "tron", "bitcoin", "solana", "bsc", "polygon", ] as const` | 25 |
| `CryptoNetwork` | type |  | 33 |
| `IWalletAccountAddress` | interface |  | 35 |
| `IWalletAccount` | interface |  | 44 |
| `WalletAccount` | model | `mongoose.model<IWalletAccount>( "WalletAccount", WalletAccountSchema )` | 140 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `Document`, `Types`

## Used by

- `server/controllers/garageAdmin.controller.ts`
- `server/routes/wallet.ts`
- `server/scripts/migrateBankDetailsToWalletAccount.ts`
- `server/services/walletAccount.ts`
- `server/services/withdrawal.ts`
