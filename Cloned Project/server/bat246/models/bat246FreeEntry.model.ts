import { Schema, model, Types } from "mongoose";

const Bat246FreeEntrySchema = new Schema(
  {
    playerId: { type: Types.ObjectId, ref: "bat246Players", required: true, index: true },
    triggerType: {
      type: String,
      enum: ["residualPayout", "cpdSales"],
      required: true,
    },
    triggerBoardId: { type: Types.ObjectId, ref: "bat246Boards", required: true },
    assignedToBoardId: { type: Types.ObjectId, ref: "bat246Boards", default: null },
    status: {
      type: String,
      enum: ["pending", "active", "used", "expired"],
      default: "pending",
    },
    restrictionEndsAt: { type: Date, default: null },
    usedAt: { type: Date, default: null },
    grayCardTransfer: {
      fromPlayerId: { type: Types.ObjectId, ref: "bat246Players", default: null },
      toPlayerId: { type: Types.ObjectId, ref: "bat246Players", default: null },
    },
    earnedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export const Bat246FreeEntry = model("bat246FreeEntries", Bat246FreeEntrySchema);
