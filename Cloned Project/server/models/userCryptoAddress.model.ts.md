# `server/models/userCryptoAddress.model.ts`

> Persistent per-user crypto deposit address — the "your BTC deposit address" model every exchange uses.

**Kind:** Mongoose model · **Lines:** 106

<!-- docgen:auto -->

## Purpose
Persistent per-user crypto deposit address — the "your BTC deposit
address" model every exchange uses. One row per (userId, orgId,
currency, chain). Allocated proactively by
`ensureCryptobrandWallets` at office-join time; used by the
wallet-topup flow to route incoming on-chain deposits to the
correct user's native-currency StoreWallet.

Distinct from `CryptoPaymentRequest` — that model is per-invoice
(single-use address, invoice-bound). This one is per-user
(long-lived address, reusable across every top-up).

The address itself is HD-derived from the same seed as every other
crypto address in the system (env.CRYPTO_WALLET_MNEMONIC). The
`hdIndex` field pins WHICH index in the tree owns this address so
the sweeper can re-derive the signing key when consolidating funds
into the treasury.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `UserCryptoAddress`

- **Collection:** `usercryptoaddresses` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `userId` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `orgId` | `Schema.Types.ObjectId` | required, index, ref "Organization" |
| `currency` | `String` | required, enum ["BTC", "ETH", "USDT"] |
| `chain` | `String` | required, enum ["bitcoin", "ethereum", "polygon", "bsc", "… |
| `coin` | `String` | required, enum ["BTC", "ETH", "USDT"] |
| `address` | `String` | required |
| `hdIndex` | `Number` | required |
| `derivationPath` | `String` | required |
| `isActive` | `Boolean` | index, default true |
| `activePollUntil` | `Date` | index, default null |

### Indexes

- `{ userId: 1, orgId: 1, currency: 1, chain: 1 }, { unique: true }` (L89)
- `{ address: 1, chain: 1 }, { unique: true }` (L96)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `UserCryptoAddressCurrency` | type |  | 20 |
| `UserCryptoAddressChain` | type |  | 21 |
| `IUserCryptoAddress` | type |  | 98 |
| `UserCryptoAddress` | const | `= (mongoose.models.UserCryptoAddress as Model<IUserCryptoAddress>) \|\| mongoose.model<IUse…` | 100 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `InferSchemaType`, `Model`

## Used by

- `server/routes/wallet.ts`
- `server/services/userCryptoAddress.ts`
