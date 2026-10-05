import mongoose, { Schema } from "mongoose";

const UserNotificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    orgId: { type: Schema.Types.ObjectId, ref: "Organization" },
    type: {
      type: String,
      enum: [
        "dm",
        "group_message",
        "knock",
        "global_dm",
        "post_mention",
        "comment_mention",
        "coupon_gift",
        "reserve_offer",
        "franchise_offer",
        "franchise_global_offer",
        "permission_grant",
      ],
      required: true,
    },
    // For DM notifications
    dmFrom: { type: Schema.Types.ObjectId, ref: "User" },
    dmFromName: { type: String },
    dmFromEmail: { type: String },
    dmFromPicture: { type: String },
    dmText: { type: String },
    dmConvId: { type: String },
    dmMessageId: { type: Schema.Types.ObjectId },
    // For Group message notifications
    groupId: { type: Schema.Types.ObjectId, ref: "Group" },
    groupName: { type: String },
    groupFrom: { type: Schema.Types.ObjectId, ref: "User" },
    groupFromName: { type: String },
    groupFromEmail: { type: String },
    groupFromPicture: { type: String },
    groupText: { type: String },
    groupMessageId: { type: Schema.Types.ObjectId },
    // For Knock notifications
    knockFrom: { type: Schema.Types.ObjectId, ref: "User" },
    knockFromName: { type: String },
    knockFromEmail: { type: String },
    knockFromPicture: { type: String },
    knockSpaceId: { type: String },
    // For Global DM notifications
    globalDmFrom: { type: Schema.Types.ObjectId, ref: "User" },
    globalDmFromName: { type: String },
    globalDmFromEmail: { type: String },
    globalDmFromPicture: { type: String },
    globalDmText: { type: String },
    globalDmConvId: { type: String },
    globalDmMessageId: { type: Schema.Types.ObjectId },
    // For Post mention notifications
    postId: { type: Schema.Types.ObjectId, ref: "Post" },
    postAuthorId: { type: Schema.Types.ObjectId, ref: "User" },
    postAuthorName: { type: String },
    postAuthorEmail: { type: String },
    postAuthorPicture: { type: String },
    postContent: { type: String },
    channelId: { type: Schema.Types.ObjectId, ref: "Channel" },
    channelName: { type: String },
    // For Comment mention notifications
    commentId: { type: Schema.Types.ObjectId, ref: "PostComment" },
    commentAuthorId: { type: Schema.Types.ObjectId, ref: "User" },
    commentAuthorName: { type: String },
    commentAuthorEmail: { type: String },
    commentAuthorPicture: { type: String },
    commentContent: { type: String },
    // For Coupon gift notifications
    couponCode: { type: String },
    couponName: { type: String },
    assignmentId: { type: Schema.Types.ObjectId, ref: "CouponAssignment" },
    giftFromUserId: { type: Schema.Types.ObjectId, ref: "User" },
    giftFromName: { type: String },
    giftFromPicture: { type: String },
    giftFromType: { type: String, enum: ["garage_admin", "founder", "user"] },
    giftOrgName: { type: String },
    giftMessage: { type: String },
    // For Reserve offer notifications (paid reserve assign — recipient inbox).
    // Reuses giftFromUserId/Name/Picture/Message for the sender, adds the
    // pointer back to the offer so the inbox can deep-link.
    reserveOfferId: {
      type: Schema.Types.ObjectId,
      ref: "PendingReserveAssignment",
    },
    reserveItemType: {
      type: String,
      enum: ["course", "channel", "workshop", "call", "product"],
    },
    reserveItemName: { type: String },
    reservePriceUsd: { type: Number },
    // For Franchise offer notifications (buyer-initiated resale flow).
    // Reuses giftFromUserId/Name/Picture/Message for the sender. `event`
    // discriminates the exact moment being surfaced.
    franchiseOfferId: {
      type: Schema.Types.ObjectId,
      ref: "FranchiseOffer",
    },
    franchiseAssignmentId: {
      type: Schema.Types.ObjectId,
      ref: "FranchiseTerritoryAssignment",
    },
    franchiseTerritoryName: { type: String },
    franchiseOfferPriceUsd: { type: Number },
    franchiseOfferEvent: {
      type: String,
      enum: [
        "created", // to owner
        "accepted", // to winning buyer + audit to owner
        "rejected", // to buyer (explicit reject)
        "auto_rejected", // to buyer (someone else's offer won)
        "cancelled", // to owner (buyer withdrew)
        "expired", // to buyer + owner (TTL swept)
      ],
    },
    franchiseInvoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
    // For Franchise-GLOBAL offer notifications (System A — platform-scoped
    // catalog entities). Same lifecycle as `franchise_offer` above; separate
    // ID refs point to the global collections so deep-links land on the
    // right resource. Reuses `franchiseTerritoryName`, `franchiseOfferPriceUsd`,
    // `franchiseOfferEvent`, and `franchiseInvoiceId` above.
    franchiseGlobalOfferId: {
      type: Schema.Types.ObjectId,
      ref: "FranchiseGlobalOffer",
    },
    franchiseGlobalAssignmentId: {
      type: Schema.Types.ObjectId,
      ref: "FranchiseGlobalAssignment",
    },
    // For module-RBAC permission grants — a founder offered this member admin
    // rights on a product module. The offer is live until the member accepts
    // or declines it, or until it expires 24h after creation.
    grantId: { type: Schema.Types.ObjectId, ref: "PermissionGrant" },
    grantModule: { type: String },
    grantModuleLabel: { type: String },
    grantExpiresAt: { type: Date },
    grantedByName: { type: String },
    // Common fields
    read: { type: Boolean, default: false },
    cleared: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes for efficient querying
UserNotificationSchema.index({ userId: 1, cleared: 1, createdAt: -1 });
UserNotificationSchema.index({ userId: 1, orgId: 1, cleared: 1 });
UserNotificationSchema.index({ userId: 1, read: 1 });
UserNotificationSchema.index({ userId: 1, type: 1, cleared: 1, createdAt: -1 });

export const UserNotification =
  mongoose.models.UserNotification ||
  mongoose.model("UserNotification", UserNotificationSchema);
