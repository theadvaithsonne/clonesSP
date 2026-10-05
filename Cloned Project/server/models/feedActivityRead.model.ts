import { Schema, model, Types } from "mongoose";

/**
 * When a user last read their feed activity, PER ORG.
 *
 * Deliberately its own collection rather than a `lastActivityReadAt` field on
 * User: the activity endpoints are org-scoped (`?orgId=`), and a single field
 * would let reading activity in one org silently clear the unread badge in
 * another. Users belonging to more than one org are normal here, not an edge
 * case, so a single field would be a bug rather than a simplification.
 *
 * One document per {userId, orgId}. Written only when the user opens the
 * Activity screen (read-all), so this collection stays small and cold.
 */
export interface IFeedActivityRead {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  orgId: Types.ObjectId;
  /** Everything created after this instant counts as unread. */
  lastReadAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FeedActivityReadSchema = new Schema(
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
    lastReadAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
  },
  { timestamps: true }
);

// One marker per user per org. Unique so an upsert can never race into two
// rows, which would make the unread count depend on which one was read.
FeedActivityReadSchema.index({ userId: 1, orgId: 1 }, { unique: true });

export const FeedActivityRead = model<IFeedActivityRead>(
  "FeedActivityRead",
  FeedActivityReadSchema
);
