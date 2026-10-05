# `server/models/cryptoAddressCounter.model.ts`

> Mongoose model holding one monotonic HD-wallet derivation index per blockchain, used to hand out a unique crypto deposit address for each payment.

**Kind:** Mongoose model · **Lines:** 50

## Purpose
Crypto payments give each invoice its own deposit address, derived from an HD (hierarchical deterministic) wallet at a numeric index. Two invoices must never get the same index, or the second buyer's deposit would silently credit the first invoice. This model keeps the next free index per chain, advanced only with an atomic `$inc` upsert.

## How it works
- `chain` - one of `polygon`, `bsc`, `tron`, `ethereum`, `bitcoin`; required and unique (one row per chain).
- `nextIndex` - next derivation index, default 0, min 0.
- Timestamps: only `updatedAt` is kept.
- Registered with a `models.CryptoAddressCounter || model(...)` guard to avoid re-registration errors.

`allocateAddress(chain)` in `server/services/cryptoAddressAllocator.ts` runs `findOneAndUpdate({chain}, {$inc: {nextIndex: 1}}, {upsert: true, new: true})` and uses the pre-increment value as the new address's index. Index 0 is reserved for the gas-float wallet: if the consumed index comes out as 0, the service bumps the counter again and uses 1 (added after a September 2026 incident in which a customer deposit landed on the gas-float address).

EVM chains (Polygon and BSC) derive the same key at the same index, but each still has its own counter row so HD can be turned on per chain and a Polygon-only rollout does not consume BSC indices.

## Exports
- `CryptoAddressCounter` - Mongoose model (`"CryptoAddressCounter"`, collection `cryptoaddresscounters`), typed `any` because of the registration guard.
- `ICryptoAddressCounter` - `{ chain, nextIndex, updatedAt? }`.

## Interfaces
- **Database:** `CryptoAddressCounter` (collection `cryptoaddresscounters`) - read/write.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/services/cryptoAddressAllocator.ts`.

## Notes
- Security- and money-critical invariant: never derive the next index from `count()` or `max()` of another collection, and never reset or lower `nextIndex`; reusing an index sends a new buyer's funds to an address already tied to another invoice.
- `chain` is declared both `unique` and `index`, which is redundant.
