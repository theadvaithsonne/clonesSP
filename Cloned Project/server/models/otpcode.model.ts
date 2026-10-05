// roam-backend/src/models/otpcode.model.ts

import { Schema, model, models, Types } from "mongoose";

const OtpCodeSchema = new Schema(
  {
    email: { type: String, required: true, index: true },
    code: { type: String, required: true },
    purpose: {
      type: String,
      enum: [
        "login",
        "invite",
        "guest-login",
        "insurance_login",
        // Post-signup phone verification — OTP delivered over SMS (2Factor),
        // still keyed on the signed-in user's email so verify reuses the
        // same email+code+purpose lookup.
        "phone-verify",
        // Proving ownership of an EXISTING account's email in order to merge
        // a phone-signup account into it. Deliberately its own purpose so an
        // ordinary login code can never authorise a merge.
        "account-associate",
        // Proving ownership of a NEW email before saving it onto an account
        // that has none (a phone signup). Separate from "account-associate" so
        // a merge code can never be replayed to claim an address, or vice versa.
        "email-add",
      ],
      required: true,
      index: true,
    },
    orgId: { type: Types.ObjectId, ref: "Organization" },
    expiresAt: { type: Date, required: true },  
  },
  { timestamps: true }
);

// This is the correct TTL index definition, we keep this one.
OtpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpCode = models.OtpCode || model("OtpCode", OtpCodeSchema);