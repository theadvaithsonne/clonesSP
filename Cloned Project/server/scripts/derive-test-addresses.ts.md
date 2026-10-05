# `server/scripts/derive-test-addresses.ts`

> Dry-run: derive the first N addresses per chain from a supplied mnemonic and print them.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 75

<!-- docgen:auto -->

## Purpose
Dry-run: derive the first N addresses per chain from a supplied
mnemonic and print them. Use this BEFORE flipping the HD flag on to
verify our derivation matches MetaMask + TronLink (or any hardware
wallet) for the same seed at the same paths.

If the addresses don't match, DO NOT SHIP — the seed you gave the
treasury team controls a different set of addresses than the ones
we're about to hand customers as deposit addresses.

Usage:
  CRYPTO_WALLET_MNEMONIC="word1 word2 ..." \
    ./node_modules/.bin/tsx src/scripts/derive-test-addresses.ts [count]

Default count = 5. Never commit an actual mnemonic to git — this
script only reads from env at runtime.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/cryptoWallet.ts` — `deriveEvmAddress`, `deriveTronAddress`, `deriveBitcoinAddress`, `isHdEnabled`
- **Packages:**
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/derive-test-addresses.ts`.
