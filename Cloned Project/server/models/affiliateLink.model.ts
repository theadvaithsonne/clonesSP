import { Schema, model, Types } from "mongoose";

// AffiliateLink: a saved per-user referral URL for a sellable item. Created on
// demand when a member generates a link to share. Originally channel-only;
// now generalized to any itemType (channel | product | office) via
// (itemType, itemId) so the 1Network Links page can offer links across the
// whole catalog. One row per (userId, orgId, itemType, itemId) — a repeat call
// returns the existing link rather than spawning duplicates.
//
// `channelId` is retained (optional) for backward-compat on channel rows;
// for channels itemId === channelId. `clickCount`/`lastClickedAt` are bumped
// by the click-tracking pipeline (see routes/affiliate.ts recordClick).
export type AffiliateLinkItemType =
  | "channel"
  | "product"
  | "office"
  | "course"
  | "service"
  | "workshop"
  | "call";

export interface IAffiliateLink {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  orgId: Types.ObjectId;
  itemType: AffiliateLinkItemType;
  itemId: Types.ObjectId;
  channelId?: Types.ObjectId; // legacy/back-compat; == itemId for channels
  affiliateId: string;
  affiliateUrl: string;
  clickCount: number;
  lastClickedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AffiliateLinkSchema = new Schema(
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
    itemType: {
      type: String,
      enum: ["channel", "product", "office", "course", "service", "workshop", "call"],
      default: "channel",
      index: true,
    },
    itemId: { type: Schema.Types.ObjectId, index: true },
    channelId: { type: Schema.Types.ObjectId, ref: "Channel", index: true },
    affiliateId: { type: String, required: true, index: true },
    affiliateUrl: { type: String, required: true },
    clickCount: { type: Number, default: 0 },
    lastClickedAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// One link per (user, org, item). NOTE: this REPLACES the legacy unique index
// on { userId, orgId, channelId }. The swap (backfill itemId/itemType, drop old
// index, create this one) is performed by the migration script — autoIndex is
// on, so the migration MUST run before deploying this schema.
AffiliateLinkSchema.index(
  { userId: 1, orgId: 1, itemType: 1, itemId: 1 },
  { unique: true },
);

export const AffiliateLink = model<IAffiliateLink>(
  "AffiliateLink",
  AffiliateLinkSchema,
);
