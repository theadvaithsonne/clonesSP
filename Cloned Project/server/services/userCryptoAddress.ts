// Persistent per-user crypto deposit-address allocator.
//
// Runs from `ensureCryptobrandWallets` at office-join time. Provisions
// ONE address per (userId, orgId, currency, chain):
//   - BTC on bitcoin
//   - ETH on ethereum
//   - USDT on tron, USDT on polygon, USDT on bsc  (3 rows for the
//     single logical USDT wallet — chain-selector at top-up time)
//
// The allocator is idempotent — running it twice for the same user
// leaves the same 5 addresses in the DB. Uses the shared
// `cryptoAddressAllocator.allocateAddress(chain)` under the hood, so
// the HD counter marches monotonically across invoice-payment
// allocations and wallet-topup allocations. Sweeper distinguishes
// them by looking at which collection owns the address.
//
// EVM specifics: same private key produces the same 0x address on
// every EVM chain. For distinct-per-coin+chain UX (user sees three
// different 0x addresses for ETH, USDT-Polygon, USDT-BSC), we
// allocate three separate HD indices — not one.

import { allocateAddress } from "./cryptoAddressAllocator";
import {
  UserCryptoAddress,
  type UserCryptoAddressCurrency,
  type UserCryptoAddressChain,
} from "../models/userCryptoAddress.model";
import { Types } from "mongoose";

// The 5 (currency, chain) pairs we allocate per cryptobrand user.
// Order stays stable so re-runs don't drift the HD index sequence
// across users on subsequent backfills.
const DEFAULT_USER_ADDRESS_SPEC: Array<{
  currency: UserCryptoAddressCurrency;
  chain: UserCryptoAddressChain;
  coin: UserCryptoAddressCurrency;
}> = [
  { currency: "BTC", chain: "bitcoin", coin: "BTC" },
  { currency: "ETH", chain: "ethereum", coin: "ETH" },
  { currency: "USDT", chain: "tron", coin: "USDT" },
  { currency: "USDT", chain: "polygon", coin: "USDT" },
  { currency: "USDT", chain: "bsc", coin: "USDT" },
];

export interface AllocateUserAddressesResult {
  created: number;
  skipped: number;
  errors: Array<{ currency: string; chain: string; error: string }>;
}

/**
 * Idempotently allocate every persistent deposit address for a
 * cryptobrand user. Existing rows for (userId, orgId, currency, chain)
 * are left alone; only missing pairs are provisioned.
 *
 * Safe to call multiple times — the `{userId, orgId, currency, chain}`
 * unique index catches duplicate-inserts, and we pre-check per pair
 * to avoid burning HD counter indices on already-provisioned users.
 */
export async function allocateUserAddressesFor(
  userId: string | Types.ObjectId,
  orgId: string | Types.ObjectId,
): Promise<AllocateUserAddressesResult> {
  const userObjId = new Types.ObjectId(String(userId));
  const orgObjId = new Types.ObjectId(String(orgId));
  const result: AllocateUserAddressesResult = {
    created: 0,
    skipped: 0,
    errors: [],
  };

  // Pull existing rows for this user in one query so we don't hit the
  // DB per (currency, chain) pair.
  const existing = await UserCryptoAddress.find({
    userId: userObjId,
    orgId: orgObjId,
  })
    .select("currency chain")
    .lean();
  const existingKey = new Set(
    existing.map((r: any) => `${r.currency}:${r.chain}`),
  );

  for (const spec of DEFAULT_USER_ADDRESS_SPEC) {
    const key = `${spec.currency}:${spec.chain}`;
    if (existingKey.has(key)) {
      result.skipped += 1;
      continue;
    }
    try {
      const derived = await allocateAddress(spec.chain);
      await UserCryptoAddress.create({
        userId: userObjId,
        orgId: orgObjId,
        currency: spec.currency,
        chain: spec.chain,
        coin: spec.coin,
        address: derived.address,
        hdIndex: derived.derivationIndex,
        derivationPath: derived.path,
        isActive: true,
      });
      result.created += 1;
    } catch (err: any) {
      // Duplicate-key = a parallel allocateUserAddressesFor for the
      // same user won the race. Treat as skipped, not error.
      if (err?.code === 11000) {
        result.skipped += 1;
        continue;
      }
      result.errors.push({
        currency: spec.currency,
        chain: spec.chain,
        error: err?.message || "unknown allocation error",
      });
    }
  }

  return result;
}

/**
 * Read one persistent address. Returns null when the user hasn't been
 * provisioned yet (allowing callers to lazy-provision on demand).
 */
export async function getUserAddress(
  userId: string | Types.ObjectId,
  orgId: string | Types.ObjectId,
  currency: UserCryptoAddressCurrency,
  chain: UserCryptoAddressChain,
): Promise<{
  address: string;
  chain: UserCryptoAddressChain;
  currency: UserCryptoAddressCurrency;
  coin: UserCryptoAddressCurrency;
  hdIndex: number;
} | null> {
  const row = await UserCryptoAddress.findOne({
    userId: new Types.ObjectId(String(userId)),
    orgId: new Types.ObjectId(String(orgId)),
    currency,
    chain,
    isActive: true,
  }).lean<{
    address: string;
    chain: UserCryptoAddressChain;
    currency: UserCryptoAddressCurrency;
    coin: UserCryptoAddressCurrency;
    hdIndex: number;
  } | null>();
  return row;
}

/**
 * List every address for a user (used by the FE wallet page + admin
 * lookups). Cheap query — one row per (currency, chain) pair.
 */
export async function listUserAddresses(
  userId: string | Types.ObjectId,
  orgId: string | Types.ObjectId,
): Promise<
  Array<{
    currency: UserCryptoAddressCurrency;
    chain: UserCryptoAddressChain;
    coin: UserCryptoAddressCurrency;
    address: string;
    hdIndex: number;
  }>
> {
  const rows = await UserCryptoAddress.find({
    userId: new Types.ObjectId(String(userId)),
    orgId: new Types.ObjectId(String(orgId)),
    isActive: true,
  })
    .select("currency chain coin address hdIndex")
    .lean();
  return rows as any;
}
