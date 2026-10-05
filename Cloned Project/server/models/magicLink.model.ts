// src/models/magicLink.model.ts
//
// A shareable offer link: my.garage.app/magic-link/<token>
//
// Deliberately stores INTENT ONLY — target user + which plan — and never a
// price. Every page load and every checkout re-quotes live via
// services/comboCheckout.ts, which is what makes "the price changes the moment
// the 24-hour offer window lapses" fall out for free instead of needing a
// sweeper to rewrite stale links.
//
// Security posture is the same as an invoice link (`/invoice/<_id>`): the token
// is the only credential needed to VIEW, and payment is gated separately by the
// email OTP the invoice page already enforces. So a leaked link exposes a price
// quote, never a purchase.
//
// No `expiresAt`. The link is reusable and outlives the offer window on
// purpose; it just starts quoting normal prices once the window shuts.

import { Schema, model, Document, Types } from "mongoose";
import crypto from "crypto";

export const MAGIC_LINK_STATUSES = ["active", "consumed", "revoked"] as const;
export type MagicLinkStatus = (typeof MAGIC_LINK_STATUSES)[number];

export interface IMagicLink extends Document {
  token: string;
  userId: Types.ObjectId;
  thirdPartyClientId: Types.ObjectId;
  /**
   * The single plan this link sells. OMIT for a CATALOG link, which shows every
   * active term (monthly + each bundle) and lets the recipient choose — that is
   * what the automatic sign-up email sends.
   */
  termMonths?: number;
  createdByUserId: Types.ObjectId;
  status: MagicLinkStatus;
  /** The invoice whose payment consumed this link. */
  consumedInvoiceId?: Types.ObjectId;
  consumedAt?: Date;
  accessCount: number;
  lastAccessedAt?: Date;
  emailSentAt?: Date;
  /**
   * When the same link went out over WhatsApp. Separate from `emailSentAt`
   * because the two channels are attempted independently — one failing must
   * not make the other look unsent, and the reminder sweep keys its own
   * schedule off the email.
   */
  whatsappSentAt?: Date;
  /**
   * Which countdown reminders have been handled, as "hours to go" marks
   * (18 / 12 / 6 / 1). Append-only; a mark present here is never re-sent.
   *
   * Marks are recorded even when their email is deliberately suppressed —
   * see services/magicLinkReminders.ts, which collapses a backlog into a
   * single send so an outage can't cause four emails at once.
   */
  /**
   * Countdown marks already handled, PER CHANNEL.
   *
   * Separate arrays rather than one shared list because the channels have to
   * fail independently: if WhatsApp is down at the 12h mark, that must not
   * retire the 12h email as well. `remindersSent` stays the email list so
   * existing rows keep their meaning.
   */
  remindersSent: number[];
  remindersSentWhatsapp?: number[];
  createdAt: Date;
  updatedAt: Date;
}

const MagicLinkSchema = new Schema<IMagicLink>(
  {
    token: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    thirdPartyClientId: { type: Schema.Types.ObjectId, required: true },
    // Absent = catalog link (all active terms shown, recipient picks).
    termMonths: { type: Number, min: 1, max: 60 },
    // Audit. Any logged-in user can mint a link that emails a stranger, so
    // knowing who did it is the backstop against abuse.
    createdByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: MAGIC_LINK_STATUSES as unknown as string[],
      default: "active",
      index: true,
    },
    consumedInvoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
    consumedAt: { type: Date },
    accessCount: { type: Number, default: 0 },
    lastAccessedAt: { type: Date },
    emailSentAt: { type: Date },
    whatsappSentAt: { type: Date },
    remindersSent: { type: [Number], default: [] },
    remindersSentWhatsapp: { type: [Number], default: [] },
  },
  { timestamps: true }
);

// "Does this user already have a link for this plan?" — the dedupe lookup on
// create, so re-sending doesn't mint a second token for the same offer.
MagicLinkSchema.index({ userId: 1, thirdPartyClientId: 1, termMonths: 1 });
// Rate-limit lookup: how many has this creator minted recently?
MagicLinkSchema.index({ createdByUserId: 1, createdAt: -1 });
// The reminder sweep's working set: active links whose first email has gone.
MagicLinkSchema.index({ status: 1, emailSentAt: 1 });

export const MagicLink = model<IMagicLink>("MagicLink", MagicLinkSchema);

/**
 * House id idiom, matching utils/shareableToken.ts and utils/guestToken.ts:
 * randomBytes → base64url → truncate, behind a semantic prefix.
 *
 * 9 bytes is 72 bits of entropy before truncation to 12 chars (~71 bits kept),
 * which is the same strength those two already rely on for public URLs.
 */
export function generateMagicLinkToken(): string {
  return `ml_${crypto.randomBytes(9).toString("base64url").substring(0, 12)}`;
}
