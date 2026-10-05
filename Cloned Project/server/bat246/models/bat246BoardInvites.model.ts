import { Schema, model, Types } from "mongoose";

// Append-only audit log — one row per invite/remind email sent for the $650
// Board Entry product. Mirrors bat246PodInvites.model.ts exactly, for the
// "Invite To Board" / "Board Invite Status" columns. Never updated or
// deleted; full history for future reporting.
const schema = new Schema({
  targetUserId:    { type: Types.ObjectId, ref: "User",    required: true },
  targetEmail:     { type: String, required: true },
  invitedByUserId: { type: Types.ObjectId, ref: "User",    required: true },
  invitedByEmail:  { type: String, required: true },
  invitedByName:   { type: String, default: "" },
  productId:       { type: Types.ObjectId, ref: "Product", required: true },
  type:            { type: String, enum: ["invite", "remind"], required: true },
  sentAt:          { type: Date, default: () => new Date() },
}, { timestamps: false });

schema.index({ targetUserId: 1, sentAt: -1 });

export const Bat246BoardInvite = model("bat246BoardInvites", schema);
