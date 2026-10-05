// Per-invoice deposit-address allocator.
//
// Every call bumps the chain's monotonic counter atomically and returns
// a fresh HD-derived address. Called at invoice-mint time when the
// buyer commits to (chain, coin) and HD is enabled for that chain.
//
// Contract:
//   • Same index → same derived address (deterministic from the seed).
//   • Indices are never reused. Legacy pending requests keep their
//     shared-platform addresses; new requests get new derived ones.
//   • Atomicity: `findOneAndUpdate($inc, upsert)` — the only safe
//     allocation primitive. See `cryptoAddressCounter.model.ts`.
//
// Feature-flagged via `CRYPTO_HD_ENABLED_CHAINS`. `isHdChainEnabled`
// gates the mint-path fork; if a chain isn't in the list (or the
// mnemonic is unset), callers fall back to the shared-address flow.

import { env } from "../config/env";
import {
  CryptoAddressCounter,
  type ICryptoAddressCounter,
} from "../models/cryptoAddressCounter.model";
import { deriveAddressForChain, isHdEnabled, type DerivedAddress } from "./cryptoWallet";

export type HdChain = "polygon" | "bsc" | "tron" | "ethereum" | "bitcoin";

function parseEnabledChains(): Set<HdChain> {
  const raw = env.CRYPTO_HD_ENABLED_CHAINS || "";
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const valid = new Set<HdChain>();
  for (const p of parts) {
    if (
      p === "polygon" ||
      p === "bsc" ||
      p === "tron" ||
      p === "ethereum" ||
      p === "bitcoin"
    ) {
      valid.add(p);
    }
  }
  return valid;
}

/**
 * True when HD-derived addresses should be minted for this chain.
 * Callers fall back to the legacy shared-address path when this is
 * false — no drift for anyone we haven't enabled.
 */
export function isHdChainEnabled(chain: string): boolean {
  if (!isHdEnabled()) return false;
  const lc = chain.toLowerCase() as HdChain;
  return parseEnabledChains().has(lc);
}

/**
 * Allocate a fresh derived address for `chain`. Atomic — the returned
 * `derivationIndex` is exclusive to this call.
 *
 * Throws when HD is disabled or the chain isn't recognized. Callers
 * should check `isHdChainEnabled` first for a clean fallback path.
 */
export async function allocateAddress(
  chain: HdChain,
): Promise<DerivedAddress> {
  if (!isHdEnabled()) {
    throw new Error(
      "cryptoAddressAllocator: HD wallet is not initialized (CRYPTO_WALLET_MNEMONIC unset)",
    );
  }
  if (
    chain !== "polygon" &&
    chain !== "bsc" &&
    chain !== "tron" &&
    chain !== "ethereum" &&
    chain !== "bitcoin"
  ) {
    throw new Error(`cryptoAddressAllocator: unsupported chain ${chain}`);
  }

  // Atomic increment with upsert. RESERVED: index 0 is the gas-float
  // wallet (cryptoGasFloat pulls native-coin refills from it). If we
  // ever hand out index 0 as a deposit address, that customer's
  // deposit lands on the same address the gas float service pulls
  // from — which caused the Sep-2026 stranded-USDT incident (the
  // very first BSC HD invoice ever minted got index 0, so its
  // deposit and the drum were the same wallet). Fix: skip index 0
  // by starting the counter at 1. Costs one derivation slot per
  // chain — cheap and correct.
  const doc: ICryptoAddressCounter | null = await CryptoAddressCounter.findOneAndUpdate(
    { chain },
    { $inc: { nextIndex: 1 } },
    { new: true, upsert: true },
  ).lean();
  if (!doc) {
    throw new Error(
      `cryptoAddressAllocator: counter upsert returned null for chain ${chain}`,
    );
  }
  let consumedIndex = (doc.nextIndex || 1) - 1;
  if (consumedIndex === 0) {
    // Skip index 0 (gas-float wallet). Bump the counter one more
    // time and use index 1 instead. Same $inc atomicity guarantee.
    const doc2: ICryptoAddressCounter | null = await CryptoAddressCounter.findOneAndUpdate(
      { chain },
      { $inc: { nextIndex: 1 } },
      { new: true },
    ).lean();
    if (!doc2) {
      throw new Error(
        `cryptoAddressAllocator: counter re-bump returned null for chain ${chain}`,
      );
    }
    consumedIndex = (doc2.nextIndex || 2) - 1;
  }

  const derived = deriveAddressForChain(chain, consumedIndex);

  // Gas-float top-up used to fire here (pre-emptive MATIC/BNB/TRX send
  // so the derived address could pay its own sweep gas). Removed as
  // part of the crypto extraction: the sibling garage-crypto-backend's
  // sweeper now pulls gas from the treasury lazily at sweep time
  // (recoverLeftoverNative + on-demand refill), so the pre-emptive
  // send here became redundant. Counter still skips index 0 — the
  // reserved gas-float wallet — so a fresh setup that WANTS pre-emptive
  // funding can still add it back safely.

  return derived;
}
