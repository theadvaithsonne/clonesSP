// src/models/invite.model.ts
import { Schema, model, Types } from "mongoose";

const InviteSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    email: { type: String, required: true, index: true },
    role: {
      type: String,
      enum: ["admin", "user", "founder", "stakeholder"],
      default: "stakeholder",
    },
    name: { type: String }, // NEW
    floorId: { type: Schema.Types.ObjectId }, // NEW (points to Floor _id)
    department: { type: String }, // NEW (dept name from floor)
    status: {
      type: String,
      enum: ["pending", "accepted", "revoked"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

InviteSchema.index({ orgId: 1, email: 1 }, { unique: true }); // avoid dup invites
export const Invite = model("Invite", InviteSchema);
