# `server/models/otpcode.model.ts`

> Mongoose model for short-lived one-time codes (login, invites, phone verification, account merge, email add), auto-deleted at expiry by a TTL index.

**Kind:** Mongoose model · **Lines:** 41

## Purpose
Garage logs users in and confirms sensitive identity changes with emailed or SMS'd one-time codes. Each issued code is a row here, keyed on an email plus a `purpose`, so the verify step can look up `email + code + purpose` and a code issued for one purpose can never be replayed for another.

## How it works
- Fields:
  - `email` (required, indexed) - the key the code is looked up by. Even phone-verification codes are keyed on the signed-in user's email.
  - `code` (required) - the one-time code as a string.
  - `purpose` (required, indexed) - one of:
    - `login`, `invite`, `guest-login`, `insurance_login`;
    - `phone-verify` - post-signup phone verification, delivered over SMS (2Factor);
    - `account-associate` - proves ownership of an **existing** account's email in order to merge a phone-signup account into it; a dedicated purpose so an ordinary login code can never authorise a merge;
    - `email-add` - proves ownership of a **new** email before saving it onto an account that has none; separate from `account-associate` so neither can be replayed as the other.
  - `orgId` (ref `Organization`, optional).
  - `expiresAt` (required).
  - `timestamps: true`.
- TTL index `{ expiresAt: 1 }` with `expireAfterSeconds: 0`: MongoDB deletes each row once `expiresAt` passes (the TTL monitor runs about once a minute, so rows can linger briefly; verify logic should still compare `expiresAt`).
- Registered with `models.OtpCode ||` so re-imports reuse the existing model.

## Exports
- `OtpCode` - the Mongoose model.

## Interfaces
- **Database:** `OtpCode` (collection `otpcodes`).

## Dependencies
- **Packages:** `mongoose` - `Schema`, `model`, `models`, `Types`.

## Used by
- `server/services/otp.ts` - issues and verifies codes.
- `server/routes/auth.ts` (mounted at `/auth`) - login/verify flows and the admin `GET /backend/auth/otp-codes` viewer (whose views are audited in `otpCodeAccessLog.model.ts`).
- `server/routes/affiliate.ts` - affiliate sign-in flows.
- `server/scripts/test-auth-identifier-contract.ts` - hand-run test script.

## Notes
- Because of the TTL, OTP rows are not a history. Durable records of phone verifications live in `phoneVerificationEvent.model.ts`.
- Codes are stored in plain text, and the garage-admin pages can list live codes, which is why access to them is audited.
