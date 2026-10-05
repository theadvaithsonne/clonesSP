// src/models/chatPin.model.ts
//
// Pinned chats, synced across a user's devices.
//
// Stored as ONE ordered array per user rather than a row per pin, because the
// order is the whole point and the client always writes the complete list.
// A row-per-pin shape would need an explicit `order` column plus a transaction
// to keep it consistent on reorder; an array is atomic for free.

import { Schema, model, Types } from "mongoose";

/** Client-side cap is 5; enforced server-side too so the array cannot grow. */
export const MAX_PINNED_CHATS = 5;

export interface IChatPin {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  pins: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ChatPinSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    // convKeys in display order: dm:<otherUserId> | group:<groupId>
    pins: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const ChatPin = model<IChatPin>("ChatPin", ChatPinSchema);
