import { Schema, model, Types } from "mongoose";

const schema = new Schema({
  userId:      { type: Types.ObjectId, ref: "User", required: true },
  userName:    { type: String, default: "" },
  userEmail:   { type: String, required: true },
  boardId:     { type: Types.ObjectId, ref: "Bat246Board", required: true },
  position:    { type: String, required: true }, // e.g. "atBat-0"
  refUserId:   { type: Types.ObjectId, ref: "User", required: true }, // invite link creator
  purchasedAt: { type: Date, default: () => new Date() },
  expiresAt:   { type: Date, required: true },   // purchasedAt + 24h
  isPlaced:    { type: Boolean, default: false },
}, { timestamps: false });

schema.index({ boardId: 1, position: 1, isPlaced: 1 });
schema.index({ userId: 1, isPlaced: 1 });

export const Bat246PendingPlacement = model("bat246PendingPlacements", schema);
