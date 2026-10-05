# `server/services/cryptoWallet.ts`

> Self-hosted HD wallet — BIP39 seed → chain-specific addresses.

**Kind:** backend service · **Lines:** 241

<!-- docgen:auto -->

## Purpose
Self-hosted HD wallet — BIP39 seed → chain-specific addresses.

One 12/24-word mnemonic (env `CRYPTO_WALLET_MNEMONIC`) derives an
unlimited tree of addresses. Each `CryptoPaymentRequest` gets its own
derived address via `cryptoAddressAllocator`; that address IS the
invoice identifier at settlement time (no more amount-tail jitter).

Derivation paths follow BIP44:
  EVM  (Polygon + BSC, same key):  m/44'/60'/0'/0/{index}
  Tron:                            m/44'/195'/0'/0/{index}

SECURITY — the mnemonic is EXISTENTIAL. Never log it, never persist
it, never send it to another process. The HDNode singleton is held in
RAM after boot; a process restart re-reads it from env. Rotation =
generate a new mnemonic + re-derive all future addresses under it
(existing pending rows stay bound to their old addresses until they […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `isHdEnabled` | function | `isHdEnabled(): boolean` — True when the mnemonic is set AND derivation actually works. | 86 |
| `DerivedAddress` | interface |  | 90 |
| `deriveEvmAddress` | function | `deriveEvmAddress(index: number): DerivedAddress` — Derive an EVM address at BIP44 path `m/44'/60'/0'/0/{index}`. | 104 |
| `deriveTronAddress` | function | `deriveTronAddress(index: number): DerivedAddress` — Derive a Tron address at BIP44 path `m/44'/195'/0'/0/{index}`. | 131 |
| `deriveBitcoinAddress` | function | `deriveBitcoinAddress(index: number): DerivedAddress` — Derive a Bitcoin address at BIP84 path `m/84'/0'/0'/0/{index}`. | 183 |
| `deriveAddressForChain` | function | `deriveAddressForChain(chain: "polygon" \| "bsc" \| "tron" \| "ethereum" \| "bitcoin", index: number): DerivedAddress` — Derive whichever address matches the chain. | 233 |

## Interfaces

- **Environment via `server/config/env.ts`:** `env.CRYPTO_WALLET_MNEMONIC`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
- **Packages:**
  - `ethers` — `HDNodeWallet`, `Mnemonic`, `keccak256`, `getBytes`
  - `bs58check`

## Used by

- `server/scripts/derive-test-addresses.ts`
- `server/services/cryptoAddressAllocator.ts`
