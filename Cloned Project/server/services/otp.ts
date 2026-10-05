// src/services/otp.ts
import { OtpCode } from "../models/otpcode.model";

export function generateOtp(length = 6) {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createOtp(
  email: string,
  purpose:
    | "login"
    | "invite"
    | "garage-admin-login"
    | "garage-admin-invite"
    | "guest-login"
    | "affiliate-invite"
    | "meet-host-verify"
    | "account-deletion"
    | "phone-verify"
  | "account-associate"
    | "email-add",
  orgId?: string
) {
  const E = email.trim().toLowerCase();
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  console.log("=== CREATE OTP DEBUG ===");
  console.log("Email:", E);
  console.log("Purpose:", purpose);
  console.log("Code:", code);
  console.log("Expires at:", expiresAt);

  const result = await OtpCode.findOneAndUpdate(
    { email: E, purpose },
    { $set: { code, orgId, expiresAt } },
    { upsert: true, new: true }
  );

  console.log("✅ OTP saved to database:", result);
  return code;
}

export async function verifyOtp(
  email: string,
  code: string,
  purpose:
    | "login"
    | "invite"
    | "garage-admin-login"
    | "garage-admin-invite"
    | "guest-login"
    | "affiliate-invite"
    | "meet-host-verify"
    | "account-deletion"
    | "phone-verify"
  | "account-associate"
    | "email-add"
) {
  const E = email.trim().toLowerCase();
  console.log("=== OTP VERIFICATION DEBUG ===");
  console.log("Email:", E);
  console.log("Code:", code);
  console.log("Purpose:", purpose);

  // Static OTP bypass for test / demo-review accounts (fixed code, no email sent).
  const STATIC_OTP_ACCOUNTS: Record<string, string> = {
    "undertaker@yopmail.com": "111111",
    "theonlannister.676730@gmail.com": "111111",
    "cindy.mokko420123@gmail.com": "111111",
    // Apple App Store review account — hand this email + code to App
    // Review in the App Store Connect notes. Dummy data only.
    "applereview@yopmail.com": "222222",
  };
  if (STATIC_OTP_ACCOUNTS[E] && code === STATIC_OTP_ACCOUNTS[E]) {
    console.log(`✅ Static OTP bypass for ${E}`);
    return "";
  }
  const row = await OtpCode.findOne({ email: E, code, purpose });
  console.log("OTP row found:", row ? "Yes" : "No");

  if (!row) {
    console.log("❌ No OTP row found");
    return false;
  }

  console.log("OTP expires at:", row.expiresAt);
  console.log("Current time:", new Date());
  console.log("Is expired:", row.expiresAt.getTime() < Date.now());

  if (row.expiresAt.getTime() < Date.now()) {
    console.log("❌ OTP expired");
    return false;
  }

  console.log("✅ OTP is valid, deleting...");
  await OtpCode.deleteMany({ email: E, purpose });
  console.log("✅ OTP deleted, returning:", row.orgId?.toString() || "");
  return row.orgId?.toString() || "";
}
