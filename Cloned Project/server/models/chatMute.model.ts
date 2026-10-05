// src/models/chatMute.model.ts
//
// Per-user, per-conversation notification mute.
//
// `convKey` is viewer-relative — `dm:<otherUserId>` or `group:<groupId>` —
// which is the same key the push payload already carries as `data.chatId`.
// Deliberately NOT the DM `convId` (`dm:<a>:<b>` sorted), because the client
// mutes "this chat" from its own point of view and never knows the sorted pair.
//
// `until: null` means muted indefinitely. A date in the past is treated as
// expired rather than cleaned up eagerly — the read path already has to compare
// against now, so a sweeper would buy nothing.

import { Schema, model, Types } from "mongoose";

export interface IChatMute {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  convKey: string;
  until: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ChatMuteSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    convKey: { type: String, required: true, trim: true },
    // null = muted with no expiry
    until: { type: Date, default: null },
  },
  { timestamps: true }
);

// One mute row per (user, conversation). Upserted by PUT /chat/mutes/:convKey.
ChatMuteSchema.index({ userId: 1, convKey: 1 }, { unique: true });

export const ChatMute = model<IChatMute>("ChatMute", ChatMuteSchema);

/**
 * Which of these users have an ACTIVE mute for this conversation?
 *
 * One query for the whole recipient list rather than one per recipient — the
 * group push path fans out to every member, and a per-recipient lookup there
 * would add a round trip per member per message.
 */
export async function mutedUserIds(
  userIds: string[],
  convKey: string
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const now = new Date();
  const rows = await ChatMute.find({
    userId: { $in: userIds.map((id) => new Types.ObjectId(id)) },
    convKey,
    $or: [{ until: null }, { until: { $gt: now } }],
  })
    .select("userId")
    .lean();
  return new Set(rows.map((r: any) => String(r.userId)));
}
