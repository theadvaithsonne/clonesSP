// src/models/chatBlock.model.ts
//
// Server-enforced blocking, synced across devices.
//
// Direction matters: `userId` is the blocker, `blockedUserId` the blocked. A
// block is one-way — the blocked person is never told, and their send still
// acks `ok: true`, so the UI gives nothing away. The message is persisted as
// normal and simply not delivered or pushed to the blocker.

import { Schema, model, Types } from "mongoose";

export interface IChatBlock {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  blockedUserId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ChatBlockSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    blockedUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

ChatBlockSchema.index({ userId: 1, blockedUserId: 1 }, { unique: true });

export const ChatBlock = model<IChatBlock>("ChatBlock", ChatBlockSchema);

/** Has `blockerId` blocked `senderId`? */
export async function hasBlocked(
  blockerId: string,
  senderId: string
): Promise<boolean> {
  const row = await ChatBlock.findOne({
    userId: new Types.ObjectId(blockerId),
    blockedUserId: new Types.ObjectId(senderId),
  })
    .select("_id")
    .lean();
  return !!row;
}

/**
 * Of `candidateIds`, which have blocked `senderId`?
 * Batched for the group push path — same reasoning as `mutedUserIds`.
 */
export async function blockersOf(
  candidateIds: string[],
  senderId: string
): Promise<Set<string>> {
  if (candidateIds.length === 0) return new Set();
  const rows = await ChatBlock.find({
    userId: { $in: candidateIds.map((id) => new Types.ObjectId(id)) },
    blockedUserId: new Types.ObjectId(senderId),
  })
    .select("userId")
    .lean();
  return new Set(rows.map((r: any) => String(r.userId)));
}
