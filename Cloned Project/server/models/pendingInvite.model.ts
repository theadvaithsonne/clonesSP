import mongoose, { Schema, Document } from "mongoose";

/**
 * An invite waiting for the person it was meant for — "whoever signs up with
 * THIS phone number or email was invited by aff_x".
 *
 * The invite page on a phone asks the visitor for their number or address
 * before it sends them to the App Store / Play. The store hop drops the link,
 * and on iOS nothing about the device survives it reliably (see
 * installIntent.model.ts for the fingerprint guess this backs up). The person
 * does survive it: they register in the app with the same number, prove it by
 * OTP, and `finishLogin` finds this row and credits the sponsor.
 *
 * Unverified when written — anyone can type any number on a public page. That
 * is safe because nothing is granted until the OTP for that same identifier is
 * passed; the row only decides WHO gets credited for an account its owner
 * chose to create.
 *
 * One live row per identifier: a second invite for the same number overwrites
 * the first (last touch wins, the same rule the app applies to parked codes).
 */
export interface IPendingInvite extends Document {
  /** Canonical form from `services/identifier.ts` — lowercased email or E.164. */
  identifier: string;
  kind: "email" | "phone";
  /** The sponsor's affiliate code, e.g. `aff_t1qrarx`. */
  affiliateId: string;
  /** When the invite was last (re)written. Drives the 30-day window. */
  savedAt: Date;
  /** Set once a verified sign-in has used the row. */
  consumedAt?: Date | null;
  consumedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const PendingInviteSchema = new Schema<IPendingInvite>(
  {
    identifier: { type: String, required: true, maxlength: 320 },
    kind: { type: String, required: true, enum: ["email", "phone"] },
    affiliateId: { type: String, required: true, maxlength: 32 },
    savedAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
    consumedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

// The lookup: the live row for one identifier, newest first. The service does
// not rely on this being unique (autoIndex is off in production, so it only
// exists once `indexes:sync` has run) — it always sorts and takes the newest.
PendingInviteSchema.index(
  { identifier: 1, consumedAt: 1, savedAt: -1 },
  { name: "pending_invite_lookup" },
);

// Housekeeping only. The 30-day window is enforced in every query, so a row
// that outlives this (index not yet synced) is ignored, not honoured.
PendingInviteSchema.index(
  { savedAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 45, name: "pending_invite_ttl_45d" },
);

export const PendingInvite = mongoose.model<IPendingInvite>(
  "PendingInvite",
  PendingInviteSchema,
);
