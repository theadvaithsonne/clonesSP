import { Schema, model, Types } from "mongoose";

const Bat246PlayerBoardSchema = new Schema(
  {
    playerId: { type: Types.ObjectId, ref: "bat246Players", required: true },
    boardId: { type: Types.ObjectId, ref: "bat246Boards", required: true },
    position: { type: String, required: true },
    status: { type: String, enum: ["active", "left"], default: "active" },
    joinedAt: { type: Date, required: true },
    leftAt: { type: Date, default: null },
  },
  { timestamps: true }
);

Bat246PlayerBoardSchema.index({ boardId: 1, status: 1 });
Bat246PlayerBoardSchema.index({ playerId: 1, status: 1 });
Bat246PlayerBoardSchema.index({ boardId: 1, playerId: 1 }, { unique: true });

export const Bat246PlayerBoard = model("bat246PlayerBoards", Bat246PlayerBoardSchema);
