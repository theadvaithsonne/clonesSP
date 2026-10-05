import { Schema, model } from "mongoose";

/**
 * Who looked at live OTP codes, and when.
 *
 * The OTP Codes / Phone OTPs pages show login codes for any user — reading one
 * is enough to log in as that user — so every view by an admin is recorded.
 * The pages auto-refresh, so views are folded into one row per admin, page and
 * 10-minute window (`bucket`), with `views` counting the refreshes.
 */
const OtpCodeAccessLogSchema = new Schema(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "GarageAdmin", required: true },
    adminEmail: { type: String, required: true },
    isSuperAdmin: { type: Boolean, default: false },
    page: { type: String, enum: ["otp_codes", "phone_otp_codes"], required: true },
    /** Start of the 10-minute window. */
    bucket: { type: Date, required: true },
    views: { type: Number, default: 0 },
    /** Codes on screen at the last view (after hiding admin accounts). */
    codesShown: { type: Number, default: 0 },
    ip: { type: String, default: null },
    lastViewedAt: { type: Date },
  },
  { timestamps: true }
);

OtpCodeAccessLogSchema.index({ adminId: 1, page: 1, bucket: 1 }, { unique: true });
OtpCodeAccessLogSchema.index({ createdAt: -1 });

export const OtpCodeAccessLog = model(
  "OtpCodeAccessLog",
  OtpCodeAccessLogSchema,
  "otp_code_access_logs"
);
