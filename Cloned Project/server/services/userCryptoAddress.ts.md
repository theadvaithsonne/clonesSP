# `server/services/userCryptoAddress.ts`

> Persistent per-user crypto deposit-address allocator.

**Kind:** backend service · **Lines:** 179

<!-- docgen:auto -->

## Purpose
Persistent per-user crypto deposit-address allocator.

Runs from `ensureCryptobrandWallets` at office-join time. Provisions
ONE address per (userId, orgId, currency, chain):
  - BTC on bitcoin
  - ETH on ethereum
  - USDT on tron, USDT on polygon, USDT on bsc  (3 rows for the
    single logical USDT wallet — chain-selector at top-up time)

The allocator is idempotent — running it twice for the same user
leaves the same 5 addresses in the DB. Uses the shared
`cryptoAddressAllocator.allocateAddress(chain)` under the hood, so
the HD counter marches monotonically across invoice-payment
allocations and wallet-topup allocations. Sweeper distinguishes
them by looking at which collection owns the address.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AllocateUserAddressesResult` | interface |  | 45 |
| `allocateUserAddressesFor` | function | `async allocateUserAddressesFor(userId: string \| Types.ObjectId, orgId: string \| Types.ObjectId): Promise<AllocateUserAddressesResult>` — Idempotently allocate every persistent deposit address for a cryptobrand user. | 60 |
| `getUserAddress` | function | `async getUserAddress(userId: string \| Types.ObjectId, orgId: string \| Types.ObjectId, currency: UserCryptoAddressCurrency, chain: UserCryptoAddressChain): Promise<{ address: string; chain: …` — Read one persistent address. | 126 |
| `listUserAddresses` | function | `async listUserAddresses(userId: string \| Types.ObjectId, orgId: string \| Types.ObjectId): Promise< Array<{ currency: UserCryptoAddressCurre…` — List every address for a user (used by the FE wallet page + admin lookups). | 158 |

## Interfaces

- **Database (Mongoose models used):**
  - `UserCryptoAddress` (server/models/userCryptoAddress.model.ts) — reads: `find`, `findOne`; **writes:** `create`

## Dependencies

- **Internal:**
  - `server/services/cryptoAddressAllocator.ts` — `allocateAddress`
  - `server/models/userCryptoAddress.model.ts` — `UserCryptoAddress`, `UserCryptoAddressCurrency`, `UserCryptoAddressChain`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/wallet.ts`
- `server/services/cryptobrandWallets.ts`
