import { Schema, model, models, Types } from "mongoose";

/**
 * A comment on a deal. Same synthetic-id keying as DealReaction.
 *
 * Soft-deleted rather than removed: a deleted parent still has to anchor
 * its replies, and the feed shows "comment deleted" instead of dropping a
 * thread. `deletedAt` is the only delete; nothing here is ever hard-removed
 * by the API.
 */
const DealCommentSchema = new Schema(
  {
    dealId: { type: String, required: true, index: true },
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    /** One level of threading. Null = top-level. */
    parentId: { type: Types.ObjectId, ref: "DealComment", default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// The feed's own query: newest-first within a deal, excluding deleted.
DealCommentSchema.index({ dealId: 1, createdAt: -1 });

export const DealComment =
  models.DealComment || model("DealComment", DealCommentSchema);
