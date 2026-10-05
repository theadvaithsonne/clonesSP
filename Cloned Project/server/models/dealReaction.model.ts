import { Schema, model, models, Types } from "mongoose";

/**
 * A reaction on a deal (Garage Connect → Deals tab).
 *
 * Deals are not stored rows — they are projections over the distribution
 * collections (see services/deals.ts). So reactions key off the SYNTHETIC
 * deal id (`up_<id>` / `cp_<id>`) rather than a foreign key, which is what
 * lets one reaction table serve both earning engines.
 *
 * One reaction per user per deal: reacting again replaces the type, which
 * is what the unique index enforces. Removing a reaction deletes the row
 * rather than storing a "none" type, so `countDocuments` is the count.
 */
const DealReactionSchema = new Schema(
  {
    dealId: { type: String, required: true, index: true },
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    /** Kept open-ended so the client can add emoji without a migration. */
    type: { type: String, required: true, default: "like", maxlength: 32 },
  },
  { timestamps: true }
);

DealReactionSchema.index({ dealId: 1, userId: 1 }, { unique: true });

export const DealReaction =
  models.DealReaction || model("DealReaction", DealReactionSchema);
