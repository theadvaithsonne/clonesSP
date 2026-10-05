import { Schema, model, Types } from "mongoose";

const Bat246MovementSchema = new Schema(
  {
    fromBoardId: { type: Types.ObjectId, ref: "bat246Boards", required: true },
    toBoardId: { type: Types.ObjectId, ref: "bat246Boards", required: true },
    playerId: { type: Types.ObjectId, ref: "bat246Players", required: true },
    playerName: { type: String },
    fromPosition: { type: String, required: true },
    toPosition: { type: String, required: true },
    reason: {
      type: String,
      enum: [
        "split",
        "warp",
        "progression",
        "cpdPlacement",
        "dugoutToOnDeck",
        "lbMove",
        "hpLBQualified",
        "hpLeft",
      ],
      required: true,
    },
    timestamp: { type: Date, required: true },
  },
  { timestamps: false }
);

Bat246MovementSchema.index({ fromBoardId: 1, timestamp: -1 });
Bat246MovementSchema.index({ playerId: 1, timestamp: -1 });

export const Bat246Movement = model("bat246Movements", Bat246MovementSchema);
