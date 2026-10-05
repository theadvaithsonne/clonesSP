import mongoose, { Schema, Document } from "mongoose";

/**
 * Deferred deep link handoff — one row per "this visitor is about to install
 * the app, and this is where they were headed".
 *
 * Android does not need this: the Play Store carries our `referrer` payload
 * through the install and hands it back via the Install Referrer API, so the
 * link travels with the install itself. iOS has no equivalent — an App Store
 * install starts the app with no memory of the page that sent them — so we
 * reconstruct the association the way the commercial attribution SDKs do:
 * the web writes an intent keyed on a coarse device fingerprint, and the
 * app's first launch claims the newest unclaimed intent that matches.
 *
 * The fingerprint is deliberately weak (hashed IP + platform + OS version +
 * screen + timezone). It is NOT an identifier and cannot be reversed into
 * one; it exists only to pick one row out of the handful created on the same
 * network in the last hour. Because it is weak, `claimIntent` refuses to
 * guess: when two candidates tie on score it returns nothing rather than
 * credit the wrong affiliate.
 */
export interface IInstallIntent extends Document {
  /** In-app path to redeem after install, e.g. `/hq/garage-app?ref=aff_x`. */
  link: string;
  /** Pulled out of the link so attribution reporting doesn't have to re-parse it. */
  affiliateId?: string | null;
  /**
   * Which app the web parked this for. Garage Shop (app.garage.store), Garage
   * HQ (com.garageapp.hq), NetworkChains ("nc", a third-party client of
   * this backend that shares its auth) and GarageIRL ("pay",
   * com.garagepayseller.app) all run this exchange against the same backend,
   * and a phone can install any of them within the hour — an HQ office invite
   * must never be redeemed by a fresh Shop install on the same network, or an
   * NC affiliate link by either. Rows written before this field existed are
   * Shop's.
   */
  app: "store" | "hq" | "nc" | "pay";
  platform: "ios" | "android";
  ipHash: string;
  userAgent: string;
  osVersion?: string | null;
  /** "<width>x<height>" in CSS px on web, in points in the app. */
  screen?: string | null;
  timezone?: string | null;
  locale?: string | null;
  claimedAt?: Date | null;
  /**
   * Hash of the fingerprint the CLAIMING app sent (see `claimerKey`). A
   * re-claim is only answered for the same key, so it hands a device back the
   * row IT redeemed — never one another phone on the same network redeemed.
   */
  claimerKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const InstallIntentSchema = new Schema<IInstallIntent>(
  {
    link: { type: String, required: true, maxlength: 2000 },
    affiliateId: { type: String, default: null },
    app: { type: String, enum: ["store", "hq", "nc", "pay"], default: "store" },
    platform: { type: String, required: true, enum: ["ios", "android"] },
    ipHash: { type: String, required: true },
    userAgent: { type: String, default: "" },
    osVersion: { type: String, default: null },
    screen: { type: String, default: null },
    timezone: { type: String, default: null },
    locale: { type: String, default: null },
    claimedAt: { type: Date, default: null },
    claimerKey: { type: String, default: null },
  },
  { timestamps: true },
);

// The claim lookup: everything unclaimed from this network+platform for one
// app, newest first. `claimedAt` is in the key so the index still serves the
// filter.
InstallIntentSchema.index(
  { ipHash: 1, platform: 1, app: 1, claimedAt: 1, createdAt: -1 },
  { name: "install_intent_claim_lookup_v2" },
);

// An intent is only matchable for MATCH_WINDOW_MS (1h). Keeping rows a little
// past that is harmless and useful for debugging a missed attribution, but
// there is no reason to retain them for a day.
InstallIntentSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 3, name: "install_intent_ttl_3h" },
);

export const InstallIntent = mongoose.model<IInstallIntent>(
  "InstallIntent",
  InstallIntentSchema,
);
