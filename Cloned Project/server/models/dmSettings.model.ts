// src/models/dmSettings.model.ts
//
// Per-conversation settings for DMs — currently just disappearing messages.
//
// A DM has no conversation document in this codebase: it is only Message rows
// sharing a `convId` (`dm:<a>:<b>`, sorted). Group retention could hang off the
// Group doc; DM retention has nowhere to live, so this collection is that
// missing home. Keyed on the SORTED convId, not a viewer-relative convKey,
// because the setting is shared by both participants.

import { Schema, model, Types } from "mongoose";

/** Same ladder the group settings route accepts. 0 = off. */
export const RETENTION_DAY_OPTIONS = [0, 7, 30, 90, 180, 365] as const;

export interface IDmSettings {
  _id: Types.ObjectId;
  convId: string;
  messageRetentionDays: number;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const DmSettingsSchema = new Schema(
  {
    // dm:<userIdA>:<userIdB>, alphabetically sorted — see utils/conv.ts
    convId: { type: String, required: true, unique: true, trim: true },
    messageRetentionDays: {
      type: Number,
      default: 0,
      enum: RETENTION_DAY_OPTIONS as unknown as number[],
    },
    // Who last changed it — shown in the UI as "X turned this on".
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// The retention sweeper scans for conversations with retention switched on;
// without this it would walk every DM conversation that has ever had settings.
DmSettingsSchema.index({ messageRetentionDays: 1 });

export const DmSettings = model<IDmSettings>("DmSettings", DmSettingsSchema);
