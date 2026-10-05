// src/models/chatStar.model.ts
//
// Starred (saved) messages, synced across devices.
//
// Only the POINTER is stored — `convKey` + `messageId`. The message body is
// resolved at read time from Message/GroupMessage, so an edited message shows
// its current text and a deleted one can be dropped. Storing a snapshot (what
// the phone does today) is what makes on-device stars drift from reality.

import { Schema, model, Types } from "mongoose";

export interface IChatStar {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  convKey: string;
  messageId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ChatStarSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    convKey: { type: String, required: true, trim: true },
    // Refs either a Message or a GroupMessage — which one is implied by the
    // convKey prefix, so no separate discriminator is stored.
    messageId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

// A message can only be starred once by a given user.
ChatStarSchema.index({ userId: 1, messageId: 1 }, { unique: true });
// Listing: a user's stars newest first, optionally filtered to one conversation.
ChatStarSchema.index({ userId: 1, createdAt: -1 });
ChatStarSchema.index({ userId: 1, convKey: 1, createdAt: -1 });

export const ChatStar = model<IChatStar>("ChatStar", ChatStarSchema);
