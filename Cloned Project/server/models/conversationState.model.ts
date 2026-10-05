import { Schema, model, models, Types } from "mongoose";

/**
 * Per-user view state for a conversation (DM or group).
 *
 * Why a separate doc instead of a flag on Message/Group: archive,
 * mark-unread, and (later) pin/mute are all per-user decisions —
 * archiving a DM for myself doesn't archive it for the other party.
 * Group docs are shared, so we can't stash my archive flag there
 * either. One ConversationState row per (userId, convId) keeps each
 * user's inbox view independent without forking the data model.
 *
 * convId encoding:
 *   - DM:    `dm:<userId1>:<userId2>`   (alphabetically sorted)
 *   - Group: `group:<groupId>`
 *
 * Absent doc == default state (in inbox, not marked unread).
 */
const ConversationStateSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    convId: { type: String, required: true, index: true },
    kind: { type: String, enum: ["dm", "group"], required: true },

    // null/missing = in the main inbox. Set to a timestamp when the user
    // archived it; the archived tab orders newest-archive-first.
    archivedAt: { type: Date, default: null },

    // Manual "mark as unread" — independent of the message-level read
    // state. When set, the inbox treats the conversation as unread
    // until the user opens it again. Cleared by `/read` on the chat.
    markedUnreadAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Compound unique — at most one state doc per user/conversation pair.
ConversationStateSchema.index({ userId: 1, convId: 1 }, { unique: true });
// Query indexes for the inbox tabs ("show me my archived rows, newest
// first" + "show me my marked-unread rows for the badge count").
ConversationStateSchema.index({ userId: 1, archivedAt: -1 });
ConversationStateSchema.index({ userId: 1, markedUnreadAt: 1 });

export const ConversationState =
  models.ConversationState ||
  model("ConversationState", ConversationStateSchema);

/** Helper to build a stable conv id for a group. DM uses `dmConvId`. */
export function groupConvId(groupId: string | Types.ObjectId): string {
  return `group:${groupId.toString()}`;
}
