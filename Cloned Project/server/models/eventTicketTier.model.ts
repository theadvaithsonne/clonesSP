// src/models/eventTicketTier.model.ts
//
// One purchasable tier of an EventProgram ("Early bird", "VIP pass", …).
//
// `soldCount` is the authoritative inventory counter and is only ever moved
// with `$inc` inside a conditional update (see routes/publicEventManagement.ts)
// so two concurrent buyers can't both take the last seat.

import { Schema, model, Document, Types } from "mongoose";

export interface IEventTicketTier extends Document {
  _id: Types.ObjectId;
  eventId: Types.ObjectId;
  /**
   * "ticket" is admission; "addon" is something bought alongside it — a
   * workshop seat, a t-shirt, an airport transfer. They share this collection
   * because the inventory, sales-window, pricing and checkout rules are
   * identical; only where they surface differs.
   */
  kind: "ticket" | "addon";
  name: string;
  description?: string;
  perks: string[];
  price: number;
  currency: string;
  quantity: number;
  soldCount: number;
  salesStart?: Date;
  salesEnd?: Date;
  isVisible: boolean;
  isPaused: boolean;
  sortOrder: number;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const EventTicketTierSchema = new Schema<IEventTicketTier>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "EventProgram",
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ["ticket", "addon"],
      default: "ticket",
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500 },
    // Bullet points rendered on the public ticket card.
    perks: [{ type: String, trim: true }],
    price: { type: Number, required: true, min: 0, default: 0 },
    currency: { type: String, default: "USD", uppercase: true, trim: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    soldCount: { type: Number, default: 0, min: 0 },
    salesStart: { type: Date },
    salesEnd: { type: Date },
    isVisible: { type: Boolean, default: true },
    // Founder can freeze sales without hiding the tier — the public card still
    // renders but the buy button is disabled.
    isPaused: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    // Archive rather than delete: a sold tier is referenced by registrations.
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "event_ticket_tiers" }
);

EventTicketTierSchema.index({ eventId: 1, sortOrder: 1 });

export const EventTicketTier = model<IEventTicketTier>(
  "EventTicketTier",
  EventTicketTierSchema
);
