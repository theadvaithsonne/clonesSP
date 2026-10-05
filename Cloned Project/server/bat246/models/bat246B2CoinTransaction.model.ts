import { Schema, model, Types } from "mongoose";

/**
 * Immutable log — one row per B2 Coins gift. This is the SINGLE source of
 * truth for "how much has person X given, ever, and from which
 * eligibility pool" — there is deliberately no separate running-total
 * field anywhere else (giver-side) that could silently drift out of sync
 * with this log. Both the overall lifetime-given figure and each pool's
 * own lifetime-given figure are computed by aggregating this collection
 * at check time (`computeLayawayEligibility` in bat246Layaway.service.ts).
 *
 * `breakdown` exists because caps STACK across simultaneously-qualifying
 * pools (see bat246Layaway.service.ts) — one gift can legitimately draw
 * from more than one pool if it exceeds a single pool's remaining room.
 * Pools are allocated largest-cap-first. The `"lineup1"` pool is the one
 * with a real side effect — see giveB2Coins()'s hook into
 * bat246LostMoneyAutoPay.service.ts's `roundAccumulated` mechanics.
 */
const B2CoinBreakdownEntrySchema = new Schema(
  {
    // "homePlate" | "podLastSale" | "leaderboard" | "matchingBonus" | "lineup1" | "adminBypass"
    pool: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const Bat246B2CoinTransactionSchema = new Schema(
  {
    fromUserId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    toUserId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    // Set only when this gift was given toward a specific product's entry
    // cost (the $650 board entry or $160 POD entry) — amount is always
    // server-derived from the real product price when this is set, never
    // trusted from the client.
    productId: { type: Types.ObjectId, ref: "Product", default: null },
    breakdown: { type: [B2CoinBreakdownEntrySchema], required: true },
    // Set when this gift fulfilled a Bat246LayawayRequest (via the
    // approve flow) rather than a direct give.
    requestId: { type: Types.ObjectId, ref: "bat246LayawayRequests", default: null },
    createdAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false }
);

Bat246B2CoinTransactionSchema.index({ fromUserId: 1, createdAt: -1 });
Bat246B2CoinTransactionSchema.index({ toUserId: 1, createdAt: -1 });

export const Bat246B2CoinTransaction = model("bat246B2CoinTransactions", Bat246B2CoinTransactionSchema);
