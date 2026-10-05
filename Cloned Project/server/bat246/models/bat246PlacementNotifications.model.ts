import { Schema, model, Types } from "mongoose";

const schema = new Schema({
  // "placement" = AT BAT pending placement (has boardId + position)
  // "membership" = $20 annual membership purchased
  // "affiliate"  = $25 Unilevel Plus purchased
  notificationType:   { type: String, default: "placement" },
  boardId:            { type: Types.ObjectId, ref: "Bat246Board", default: null },
  boardTrackingNo:    { type: String, default: "" },
  position:           { type: String, default: null },
  qualifiedUserId:    { type: Types.ObjectId, ref: "User", required: true },
  qualifiedUserEmail: { type: String, required: true },
  qualifiedUserName:  { type: String, default: "" },
  uplineUserId:       { type: Types.ObjectId, ref: "User", required: true },
  uplinePosition:     { type: String, default: "" },
  isRead:             { type: Boolean, default: false },
  isActioned:         { type: Boolean, default: false },
  createdAt:          { type: Date, default: () => new Date() },
  // "layaway_request" — links back to the ask, and a display summary.
  // Previously passed to .create() but never declared here, so Mongoose's
  // default strict mode silently dropped both on every save (confirmed
  // against live data: every layaway_request notification in production
  // is missing them, which is why the bell's inline Approve/Deny buttons
  // have been non-functional). Fixed here.
  layawayRequestId:   { type: Types.ObjectId, ref: "bat246LayawayRequests", default: null },
  // "snapbackloan_request" — same relationship, for Snap Back Loan asks.
  snapBackLoanRequestId: { type: Types.ObjectId, ref: "bat246SnapBackLoanRequests", default: null },
  summary:            { type: String, default: "" },
});

schema.index({ uplineUserId: 1, isActioned: 1 });

export const Bat246PlacementNotification = model("bat246PlacementNotifications", schema);
