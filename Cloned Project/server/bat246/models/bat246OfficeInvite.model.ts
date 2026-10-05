import { Schema, model } from "mongoose";

/**
 * One row per email address ever invited via Inviteandplace's
 * "+ Invite to become Bat246 Distributor" button (office-invite) — a
 * brand-new prospect with no Garage account yet at invite time, so this is
 * keyed by email rather than userId.
 *
 * Consulted as a durable fallback wherever a signup/checkout step needs to
 * know "who invited this person into BAT246" but the current request has
 * no explicit `bat246Ref` — e.g. the prospect closed the browser mid-signup
 * without buying, then came back later through a route/link that doesn't
 * carry that URL param. Upserted, not appended: the most recent invite for
 * an email wins, matching how referral attribution is decided everywhere
 * else in bat246 (first successful write to
 * `Bat246Distributor.bat246RefUserId` sticks, via `$setOnInsert`).
 */
const schema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    inviterUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  },
  { timestamps: true },
);

export const Bat246OfficeInvite = model("bat246OfficeInvites", schema);
