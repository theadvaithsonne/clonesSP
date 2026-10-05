// Monotonic per-chain HD-derivation index. One row per chain.
//
// `cryptoAddressAllocator.allocateAddress(chain)` bumps `nextIndex`
// atomically (`findOneAndUpdate($inc, upsert)`) and returns the pre-
// increment value as the new address's derivation index.
//
// Never derive the next index from `count()` or `max()` of any other
// collection — same address on two concurrent invoices means the second
// buyer's deposit silently credits the first invoice. The `$inc` upsert
// is the ONLY safe primitive.
//
// EVM chains (polygon + bsc) share the same private key on the same
// index, but each still gets its own counter row — decoupling means we
// can flip HD on/off per chain independently, and a Polygon-only
// rollout doesn't burn BSC indices.

import { Schema, model, models } from "mongoose";

export interface ICryptoAddressCounter {
  chain: "polygon" | "bsc" | "tron" | "ethereum" | "bitcoin";
  nextIndex: number;
  updatedAt?: Date;
}

const CryptoAddressCounterSchema = new Schema<ICryptoAddressCounter>(
  {
    chain: {
      type: String,
      required: true,
      enum: ["polygon", "bsc", "tron", "ethereum", "bitcoin"],
      unique: true,
      index: true,
    },
    nextIndex: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const CryptoAddressCounter =
  (models.CryptoAddressCounter as any) ||
  model<ICryptoAddressCounter>(
    "CryptoAddressCounter",
    CryptoAddressCounterSchema,
  );
