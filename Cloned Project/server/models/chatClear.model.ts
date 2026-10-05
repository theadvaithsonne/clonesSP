// src/models/chatClear.model.ts
//
// "Clear chat for me" — a per-user watermark, not a delete.
//
// Nothing is removed from Message/GroupMessage: the other participants must
// keep their copy. Reads for THIS user are filtered to `createdAt > clearedAt`,
// which is also why the value is a timestamp rather than a boolean — clearing
// twice moves the line forward, and messages sent after a clear reappear.

import { Schema, model, Types } from "mongoose";
import { dmConvId } from "../utils/conv";

export interface IChatClear {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  convKey: string;
  clearedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ChatClearSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    convKey: { type: String, required: true, trim: true },
    clearedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

ChatClearSchema.index({ userId: 1, convKey: 1 }, { unique: true });

export const ChatClear = model<IChatClear>("ChatClear", ChatClearSchema);

/**
 * The clear watermark for one conversation, or null if never cleared.
 * Returned as a plain Date so callers can drop it straight into a
 * `createdAt: { $gt: ... }` clause.
 */
export async function clearedAtFor(
  userId: string,
  convKey: string
): Promise<Date | null> {
  const row = await ChatClear.findOne({
    userId: new Types.ObjectId(userId),
    convKey,
  })
    .select("clearedAt")
    .lean<any>();
  return row?.clearedAt || null;
}

/**
 * `$nor` clauses that exclude every DM message sitting at or before one of the
 * caller's clear watermarks.
 *
 * Shaped for the DM list aggregations, which group by `convId` — so the
 * viewer-relative `dm:<otherId>` key is converted to the stored sorted
 * `dm:<a>:<b>` form here. Returns `[]` when nothing is cleared, so callers can
 * skip adding the clause entirely.
 */
export async function dmClearedNorClauses(
  userId: string
): Promise<Array<{ convId: string; createdAt: { $lte: Date } }>> {
  const rows = await ChatClear.find({
    userId: new Types.ObjectId(userId),
    convKey: { $regex: "^dm:" },
  })
    .select("convKey clearedAt")
    .lean();

  return (rows as any[]).map((r) => ({
    convId: dmConvId(userId, String(r.convKey).slice(3)),
    createdAt: { $lte: r.clearedAt },
  }));
}

/**
 * Watermarks for every conversation a user has cleared, keyed by convKey.
 * Used by the list endpoints (/last-messages, /unread), which would otherwise
 * need one lookup per conversation in the list.
 */
export async function clearedAtMap(
  userId: string
): Promise<Map<string, Date>> {
  const rows = await ChatClear.find({ userId: new Types.ObjectId(userId) })
    .select("convKey clearedAt")
    .lean();
  return new Map(rows.map((r: any) => [r.convKey, r.clearedAt]));
}
