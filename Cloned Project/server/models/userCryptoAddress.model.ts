// Persistent per-user crypto deposit address — the "your BTC deposit
// address" model every exchange uses. One row per (userId, orgId,
// currency, chain). Allocated proactively by
// `ensureCryptobrandWallets` at office-join time; used by the
// wallet-topup flow to route incoming on-chain deposits to the
// correct user's native-currency StoreWallet.
//
// Distinct from `CryptoPaymentRequest` — that model is per-invoice
// (single-use address, invoice-bound). This one is per-user
// (long-lived address, reusable across every top-up).
//
// The address itself is HD-derived from the same seed as every other
// crypto address in the system (env.CRYPTO_WALLET_MNEMONIC). The
// `hdIndex` field pins WHICH index in the tree owns this address so
// the sweeper can re-derive the signing key when consolidating funds
// into the treasury.

import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

export type UserCryptoAddressCurrency = "BTC" | "ETH" | "USDT";
export type UserCryptoAddressChain =
  | "bitcoin"
  | "ethereum"
  | "polygon"
  | "bsc"
  | "tron";

const UserCryptoAddressSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    // Wallet's currency face — one wallet per (user, currency) in
    // StoreWallet, mirrored here so lookups from the wallet layer
    // are trivial.
    currency: {
      type: String,
      enum: ["BTC", "ETH", "USDT"],
      required: true,
    },
    // The chain the address lives on. For USDT this varies per
    // (Tron / Polygon / BSC); for BTC and ETH it's fixed.
    chain: {
      type: String,
      enum: ["bitcoin", "ethereum", "polygon", "bsc", "tron"],
      required: true,
    },
    // Same as `currency` today (only 1 coin per currency), but kept
    // explicit so future stablecoins (e.g. USDC as its own wallet
    // later) don't need a schema migration.
    coin: {
      type: String,
      enum: ["BTC", "ETH", "USDT"],
      required: true,
    },
    address: { type: String, required: true },
    // Which HD counter index in cryptoAddressCounter for this chain
    // burned to produce `address`. Sweeper re-derives the signing
    // key via deriveAddressForChain(chain, hdIndex).
    hdIndex: { type: Number, required: true },
    derivationPath: { type: String, required: true },
    isActive: { type: Boolean, default: true, index: true },
    // Session-scoped fast-poll window. Set to `now + 15 min` whenever
    // the FE hits GET /wallet/store/topup-address or GET
    // /wallet/store/topup-transactions for this address — those are
    // the natural "user is watching" signals. Backend watchers only
    // include this row in their address cache while `activePollUntil
    // > now`; outside that window the slower `cryptoHdAddressReconciler`
    // is the safety net (deposits still credit, just with higher
    // latency). Kept nullable so legacy rows written before this field
    // existed simply aren't fast-polled until the user next opens the
    // deposit sheet — no back-fill required.
    activePollUntil: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

// Unique per (user, org, currency, chain) — one address per wallet.
// Enforces "one BTC address per user forever" at the DB level.
UserCryptoAddressSchema.index(
  { userId: 1, orgId: 1, currency: 1, chain: 1 },
  { unique: true },
);

// Reverse lookup: watcher sees an incoming Transfer to some address
// on some chain → find the owning user in one query.
UserCryptoAddressSchema.index({ address: 1, chain: 1 }, { unique: true });

export type IUserCryptoAddress = InferSchemaType<typeof UserCryptoAddressSchema>;

export const UserCryptoAddress: Model<IUserCryptoAddress> =
  (mongoose.models.UserCryptoAddress as Model<IUserCryptoAddress>) ||
  mongoose.model<IUserCryptoAddress>(
    "UserCryptoAddress",
    UserCryptoAddressSchema,
  );
