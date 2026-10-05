# `server/services/cryptoAddressAllocator.ts`

> Per-invoice deposit-address allocator.

**Kind:** backend service · **Lines:** 133

<!-- docgen:auto -->

## Purpose
Per-invoice deposit-address allocator.

Every call bumps the chain's monotonic counter atomically and returns
a fresh HD-derived address. Called at invoice-mint time when the
buyer commits to (chain, coin) and HD is enabled for that chain.

Contract:
  • Same index → same derived address (deterministic from the seed).
  • Indices are never reused. Legacy pending requests keep their
    shared-platform addresses; new requests get new derived ones.
  • Atomicity: `findOneAndUpdate($inc, upsert)` — the only safe
    allocation primitive. See `cryptoAddressCounter.model.ts`.

Feature-flagged via `CRYPTO_HD_ENABLED_CHAINS`. `isHdChainEnabled`
gates the mint-path fork; if a chain isn't in the list (or the
mnemonic is unset), callers fall back to the shared-address flow.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `HdChain` | type |  | 25 |
| `isHdChainEnabled` | function | `isHdChainEnabled(chain: string): boolean` — True when HD-derived addresses should be minted for this chain. | 53 |
| `allocateAddress` | function | `async allocateAddress(chain: HdChain): Promise<DerivedAddress>` — Allocate a fresh derived address for `chain`. | 66 |

## Interfaces

- **Database (Mongoose models used):**
  - `CryptoAddressCounter` (server/models/cryptoAddressCounter.model.ts) — **writes:** `findOneAndUpdate`
- **Environment via `server/config/env.ts`:** `env.CRYPTO_HD_ENABLED_CHAINS`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/cryptoAddressCounter.model.ts` — `CryptoAddressCounter`, `ICryptoAddressCounter`
  - `server/services/cryptoWallet.ts` — `deriveAddressForChain`, `isHdEnabled`, `DerivedAddress`
- **Packages:** none

## Used by

- `server/services/cryptoPaymentRequest.ts`
- `server/services/userCryptoAddress.ts`
