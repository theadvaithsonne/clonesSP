// src/models/eventRegistration.model.ts
//
// One attendee holding one ticket. `qrCodeToken` is the check-in credential
// and is the only thing the door scanner needs — it is unguessable and
// resolved by an unauthenticated public endpoint, so it must never be derived
// from the registration id.

import { Schema, model, Document, Types } from "mongoose";

export type EventRegistrationStatus =
  | "pending_approval"
  | "approved"
  | "rejected"
  | "cancelled";

export type EventPaymentStatus =
  | "free"
  | "paid"
  | "pending"
  | "refunded";

export interface IEventAttendee {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  country?: string;
}

/**
 * An extra bought alongside the ticket — a workshop seat, a t-shirt, a
 * transfer. Denormalised (name + unit price at time of purchase) so a later
 * price change or a deleted add-on can't rewrite what someone paid.
 */
export interface IEventRegistrationAddon {
  ticketTierId: Types.ObjectId;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface IEventRegistration extends Document {
  _id: Types.ObjectId;
  eventId: Types.ObjectId;
  ticketTierId: Types.ObjectId;
  userId?: Types.ObjectId;
  attendee: IEventAttendee;
  quantity: number;
  addons: IEventRegistrationAddon[];
  /**
   * Answers to the organizer's custom and consent fields, keyed by the
   * field key from `event_registration_forms`. Standard fields still land in
   * `attendee` — this is only for questions the schema has no column for.
   * Mixed type because a dropdown answers with a string, a multi-select with
   * an array and a consent checkbox with a boolean.
   */
  answers: Record<string, unknown>;
  status: EventRegistrationStatus;
  paymentStatus: EventPaymentStatus;
  amountPaid: number;
  currency: string;
  invoiceId?: Types.ObjectId;
  promoCode?: string;
  qrCodeToken: string;
  /**
   * When an unpaid checkout's seat hold lapses.
   *
   * Starting a paid checkout claims the seats immediately so two buyers can't
   * take the last one while one of them is on the payment page. If that buyer
   * then walks away, nothing would ever hand the seats back — the tier would
   * read as sold out with zero sales. Set on creation, cleared once the
   * invoice settles, and swept by `releaseExpiredHolds`.
   */
  holdExpiresAt?: Date | null;
  checkedInAt?: Date;
  rejectedReason?: string;
  /**
   * Paid after the seat hold lapsed and the seats had been resold, so no
   * ticket was issued. The money is real; an admin refunds it.
   */
  needsRefund?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AttendeeSchema = new Schema<IEventAttendee>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    company: { type: String, trim: true },
    jobTitle: { type: String, trim: true },
    country: { type: String, trim: true },
  },
  { _id: false }
);

const RegistrationAddonSchema = new Schema<IEventRegistrationAddon>(
  {
    ticketTierId: {
      type: Schema.Types.ObjectId,
      ref: "EventTicketTier",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 1, min: 1 },
    unitPrice: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const EventRegistrationSchema = new Schema<IEventRegistration>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "EventProgram",
      required: true,
      index: true,
    },
    ticketTierId: {
      type: Schema.Types.ObjectId,
      ref: "EventTicketTier",
      required: true,
      index: true,
    },
    // Optional: guest checkout registers by email alone.
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    attendee: { type: AttendeeSchema, required: true },
    quantity: { type: Number, default: 1, min: 1 },
    addons: { type: [RegistrationAddonSchema], default: [] },
    answers: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ["pending_approval", "approved", "rejected", "cancelled"],
      default: "pending_approval",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["free", "paid", "pending", "refunded"],
      default: "free",
      index: true,
    },
    // Denormalised so the organizer's revenue table doesn't have to join every
    // invoice, and so a refunded invoice can't silently rewrite history.
    amountPaid: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "USD", uppercase: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", index: true },
    promoCode: { type: String, trim: true, uppercase: true },
    qrCodeToken: { type: String, required: true, unique: true, index: true },
    holdExpiresAt: { type: Date, default: null },
    checkedInAt: { type: Date },
    rejectedReason: { type: String, trim: true, maxlength: 500 },
    needsRefund: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "event_registrations" }
);

EventRegistrationSchema.index({ eventId: 1, status: 1, createdAt: -1 });
EventRegistrationSchema.index({ eventId: 1, "attendee.email": 1 });
// Drives the lazy sweep in `releaseExpiredHolds`.
EventRegistrationSchema.index({ paymentStatus: 1, holdExpiresAt: 1 });

export const EventRegistration = model<IEventRegistration>(
  "EventRegistration",
  EventRegistrationSchema
);
