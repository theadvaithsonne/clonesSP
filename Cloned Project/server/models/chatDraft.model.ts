// src/models/chatDraft.model.ts
//
// Unsent message drafts, so a draft started on the phone is there on the web.
//
// P2-4 in the spec and explicitly optional — drafts living only on the device
// is normal for chat apps. Built because it is three routes on the same shape
// as the rest of /chat/*; the client decides whether to use it.
//
// An empty string deletes the row rather than storing a blank, so `GET
// /chat/drafts` never returns entries the UI would have to filter out.

import { Schema, model, Types } from "mongoose";

/** Matches the message composer's own limit. */
export const MAX_DRAFT_LENGTH = 5000;

export interface IChatDraft {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  convKey: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChatDraftSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    convKey: { type: String, required: true, trim: true },
    text: { type: String, default: "", maxlength: MAX_DRAFT_LENGTH },
  },
  { timestamps: true }
);

ChatDraftSchema.index({ userId: 1, convKey: 1 }, { unique: true });

export const ChatDraft = model<IChatDraft>("ChatDraft", ChatDraftSchema);
