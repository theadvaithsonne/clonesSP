import { Schema, model, Document, Types } from "mongoose";

/**
 * A product the host put on screen during a live session ("live selling").
 *
 * The pin itself is live-room state (see services/mediasoup.ts →
 * `room.pinnedProduct`) and disappears with the room. This collection is the
 * durable trace of it: one row per (workshopId, sessionDate, itemType, itemId),
 * so the founder analytics can answer "how many products were featured in this
 * session" long after the stream ended, and a purchase claiming to come from a
 * session can be verified against what was actually pinned.
 *
 * `sessionDate` is the UTC-midnight day key, matching WorkshopSessionOverride
 * and the session rows the analytics emits.
 */
export interface IWebinarProductPin extends Document {
  _id: Types.ObjectId;
  workshopId: Types.ObjectId;
  orgId: Types.ObjectId;
  sessionDate: Date;
  itemType: string;
  itemId: Types.ObjectId;
  itemName?: string;
  price?: number;
  currency?: string;
  /** First and last time this item was on screen during the session. */
  firstPinnedAt: Date;
  lastPinnedAt: Date;
  /** How many times the host pinned it during the session. */
  pinCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const WebinarProductPinSchema = new Schema<IWebinarProductPin>(
  {
    workshopId: {
      type: Schema.Types.ObjectId,
      ref: "Workshop",
      required: true,
      index: true,
    },
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    sessionDate: { type: Date, required: true },
    itemType: { type: String, required: true },
    itemId: { type: Schema.Types.ObjectId, required: true },
    itemName: { type: String },
    price: { type: Number },
    currency: { type: String },
    firstPinnedAt: { type: Date, required: true },
    lastPinnedAt: { type: Date, required: true },
    pinCount: { type: Number, default: 1 },
  },
  { timestamps: true }
);

// One row per item per session — repeat pins bump lastPinnedAt / pinCount.
WebinarProductPinSchema.index(
  { workshopId: 1, sessionDate: 1, itemType: 1, itemId: 1 },
  { unique: true }
);

export const WebinarProductPin = model<IWebinarProductPin>(
  "WebinarProductPin",
  WebinarProductPinSchema
);
