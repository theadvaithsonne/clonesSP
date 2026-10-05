// src/models/joinRequest.model.ts
import { Schema, model, Types } from "mongoose";

const JoinRequestSchema = new Schema(
  {
    guestUserId: {
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
    email: { type: String, required: true, index: true },
    name: { type: String },
    message: { type: String }, // Why they want to join
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    respondedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    respondedAt: { type: Date },
  },
  { timestamps: true }
);

// Prevent duplicate requests from same user to same org
JoinRequestSchema.index({ guestUserId: 1, orgId: 1 }, { unique: true });

// Compound index for efficient queries
JoinRequestSchema.index({ orgId: 1, status: 1, createdAt: -1 });

export const JoinRequest = model("JoinRequest", JoinRequestSchema);
