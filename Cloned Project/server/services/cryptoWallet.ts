// Self-hosted HD wallet — BIP39 seed → chain-specific addresses.
//
// One 12/24-word mnemonic (env `CRYPTO_WALLET_MNEMONIC`) derives an
// unlimited tree of addresses. Each `CryptoPaymentRequest` gets its own
// derived address via `cryptoAddressAllocator`; that address IS the
// invoice identifier at settlement time (no more amount-tail jitter).
//
// Derivation paths follow BIP44:
//   EVM  (Polygon + BSC, same key):  m/44'/60'/0'/0/{index}
//   Tron:                            m/44'/195'/0'/0/{index}
//
// SECURITY — the mnemonic is EXISTENTIAL. Never log it, never persist
// it, never send it to another process. The HDNode singleton is held in
// RAM after boot; a process restart re-reads it from env. Rotation =
// generate a new mnemonic + re-derive all future addresses under it
// (existing pending rows stay bound to their old addresses until they
// expire).
//
// Address enumeration is public — anyone who knows `m/44'/60'/0'/0/{n}`
// can predict our next N deposit addresses. That's fine for a payment
// processor (addresses are meant to receive); do NOT store non-payment
// value on these derived addresses.

import { HDNodeWallet, Mnemonic, keccak256, getBytes } from "ethers";
import bs58check from "bs58check";
import { env } from "../config/env";

// NOTE — `bitcoinjs-lib` and the `tiny-secp256k1` ecc provider are
// LAZY-loaded inside `deriveBitcoinAddress` (and other BTC-only entry
// points). Not to route around an ESM crash any more — we switched off
// `@bitcoinerlab/secp256k1` to `tiny-secp256k1` precisely because the
// former did a top-level `require()` of ESM-only `@noble/curves` which
// hard-crashed the process on the very first Bitcoin call under
// Node ≥22 CJS. `tiny-secp256k1` ships a dual CJS+ESM build with WASM
// under the hood, so it loads cleanly on any Node ≥14.
//
// The lazy require stays in place as belt-and-braces: it keeps
// Bitcoin's WASM initialization off the boot path, so USDT / ETH /
// Tron flows never pay for machinery they don't use.
type BitcoinLib = typeof import("bitcoinjs-lib");
let cachedBitcoinLib: BitcoinLib | null = null;
function loadBitcoinLib(): BitcoinLib {
  if (cachedBitcoinLib) return cachedBitcoinLib;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bitcoin = require("bitcoinjs-lib") as BitcoinLib;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ecc = require("tiny-secp256k1");
  bitcoin.initEccLib(ecc);
  cachedBitcoinLib = bitcoin;
  return bitcoin;
}

const EVM_PATH_PREFIX = "m/44'/60'/0'/0";
const TRON_PATH_PREFIX = "m/44'/195'/0'/0";
// BIP84 native SegWit (bech32, `bc1q…`) — ~40% cheaper on-chain fees
// than legacy P2PKH (BIP44, `1…`). Standard in every modern wallet
// (Ledger, Trezor, Sparrow, BlueWallet, MetaMask via Wallet Connect).
const BTC_PATH_PREFIX = "m/84'/0'/0'/0";

// Derived once at first use; cached for the process lifetime. The
// mnemonic string is discarded after conversion — only the HDNode
// (which still carries key material) sits in RAM.
let cachedRoot: HDNodeWallet | null = null;
let cachedTronRoot: HDNodeWallet | null = null;
let cachedBtcRoot: HDNodeWallet | null = null;

function loadRootOrNull(): HDNodeWallet | null {
  if (cachedRoot) return cachedRoot;
  const phrase = env.CRYPTO_WALLET_MNEMONIC?.trim();
  if (!phrase) return null;
  try {
    const mnemonic = Mnemonic.fromPhrase(phrase);
    // Master node at m/. Path-append per derivation below.
    cachedRoot = HDNodeWallet.fromMnemonic(mnemonic, "m");
    return cachedRoot;
  } catch (err) {
    console.error(
      "[cryptoWallet] Failed to derive HDNode from CRYPTO_WALLET_MNEMONIC:",
      (err as Error).message,
    );
    return null;
  }
}

/** True when the mnemonic is set AND derivation actually works. */
export function isHdEnabled(): boolean {
  return loadRootOrNull() !== null;
}

export interface DerivedAddress {
  address: string;
  privateKey: string;
  derivationIndex: number;
  path: string;
}

/**
 * Derive an EVM address at BIP44 path `m/44'/60'/0'/0/{index}`.
 *
 * Same private key controls the same 0x address on every EVM chain
 * (Polygon, BSC, Ethereum, etc.) — callers can reuse one index across
 * Polygon and BSC without derivation collisions.
 */
export function deriveEvmAddress(index: number): DerivedAddress {
  const root = loadRootOrNull();
  if (!root) {
    throw new Error(
      "cryptoWallet: HD derivation disabled (CRYPTO_WALLET_MNEMONIC unset or invalid)",
    );
  }
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`cryptoWallet: invalid derivation index ${index}`);
  }
  const path = `${EVM_PATH_PREFIX}/${index}`;
  const child = root.derivePath(path.slice(2)); // ethers wants the path without the leading "m/"
  return {
    address: child.address,
    privateKey: child.privateKey,
    derivationIndex: index,
    path,
  };
}

/**
 * Derive a Tron address at BIP44 path `m/44'/195'/0'/0/{index}`.
 *
 * Same curve as EVM (secp256k1), different address format:
 *   keccak256(uncompressed_pubkey[1:]) → last 20 bytes → prepend 0x41 →
 *   base58check-encode → "T…" string.
 */
export function deriveTronAddress(index: number): DerivedAddress {
  // Cache a separate Tron sub-root — cheap, but avoids re-walking the
  // full path every call.
  if (!cachedTronRoot) {
    const root = loadRootOrNull();
    if (!root) {
      throw new Error(
        "cryptoWallet: HD derivation disabled (CRYPTO_WALLET_MNEMONIC unset or invalid)",
      );
    }
    // Tron BIP44 up to but not including the address index.
    cachedTronRoot = root.derivePath(TRON_PATH_PREFIX.slice(2));
  }
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`cryptoWallet: invalid derivation index ${index}`);
  }
  const path = `${TRON_PATH_PREFIX}/${index}`;
  const child = cachedTronRoot.deriveChild(index);

  // publicKey is a 33-byte compressed pubkey (0x02/0x03 prefix + 32
  // bytes). Tron address derivation needs the uncompressed form
  // (65 bytes, 0x04 prefix + 64 bytes) with the leading byte stripped.
  // ethers exposes `signingKey.publicKey` (uncompressed) directly.
  const uncompressedPubkey = child.signingKey.publicKey; // "0x04……" (130 hex chars)
  const pubkeyBytes = getBytes(uncompressedPubkey); // 65 bytes
  const pubkeyNoPrefix = pubkeyBytes.slice(1); // 64 bytes

  const hash = keccak256(pubkeyNoPrefix); // "0x…" 32 bytes hex
  const hashBytes = getBytes(hash);
  const addressBytes = new Uint8Array(21);
  addressBytes[0] = 0x41; // Tron mainnet prefix
  addressBytes.set(hashBytes.slice(-20), 1);

  const address = bs58check.encode(addressBytes);
  return {
    address,
    privateKey: child.privateKey,
    derivationIndex: index,
    path,
  };
}

/**
 * Derive a Bitcoin address at BIP84 path `m/84'/0'/0'/0/{index}`.
 *
 * Native SegWit (bech32, `bc1q…`) — the modern default. Same secp256k1
 * curve as EVM, just a different address encoding:
 *   pubkey (33 bytes compressed) → hash160 → bech32 with witness v0.
 *
 * Uses `bitcoinjs-lib`'s `payments.p2wpkh` — battle-tested, same
 * function Sparrow Wallet / Ledger Live / Trezor Suite call.
 */
export function deriveBitcoinAddress(index: number): DerivedAddress {
  if (!cachedBtcRoot) {
    const root = loadRootOrNull();
    if (!root) {
      throw new Error(
        "cryptoWallet: HD derivation disabled (CRYPTO_WALLET_MNEMONIC unset or invalid)",
      );
    }
    cachedBtcRoot = root.derivePath(BTC_PATH_PREFIX.slice(2));
  }
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`cryptoWallet: invalid derivation index ${index}`);
  }
  const path = `${BTC_PATH_PREFIX}/${index}`;
  const child = cachedBtcRoot.deriveChild(index);

  // ethers gives us the compressed pubkey as a 0x-prefixed hex string.
  // bitcoinjs-lib wants a Uint8Array/Buffer of the raw 33 bytes.
  const pubkeyHex = child.publicKey.startsWith("0x")
    ? child.publicKey.slice(2)
    : child.publicKey;
  const pubkey = Buffer.from(pubkeyHex, "hex");
  if (pubkey.length !== 33) {
    throw new Error(
      `cryptoWallet: expected 33-byte compressed pubkey for BTC, got ${pubkey.length}`,
    );
  }

  const bitcoin = loadBitcoinLib();
  const { address } = bitcoin.payments.p2wpkh({
    pubkey,
    network: bitcoin.networks.bitcoin, // mainnet
  });
  if (!address) {
    throw new Error(`cryptoWallet: p2wpkh returned no address at index ${index}`);
  }

  return {
    address,
    privateKey: child.privateKey,
    derivationIndex: index,
    path,
  };
}

/** Derive whichever address matches the chain. All EVM chains
 *  (polygon, bsc, ethereum) share the same secp256k1 derivation and
 *  produce the same 0x address at the same index — one seed, three
 *  chains, one address per index. Bitcoin has its own tree at
 *  m/84'/0'/0'/0/i (native SegWit bech32). */
export function deriveAddressForChain(
  chain: "polygon" | "bsc" | "tron" | "ethereum" | "bitcoin",
  index: number,
): DerivedAddress {
  if (chain === "tron") return deriveTronAddress(index);
  if (chain === "bitcoin") return deriveBitcoinAddress(index);
  return deriveEvmAddress(index); // polygon + bsc + ethereum share EVM tree
}
