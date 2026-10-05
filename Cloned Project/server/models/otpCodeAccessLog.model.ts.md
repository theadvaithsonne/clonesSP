# `server/models/otpCodeAccessLog.model.ts`

> Mongoose model that audits which garage admins viewed live login OTP codes, folded into 10-minute windows.

**Kind:** Mongoose model · **Lines:** 36

## Purpose
The garage-admin "OTP Codes" and "Phone OTPs" pages display current login codes for any user. Reading one is enough to log in as that user, so every view is recorded. Because those pages auto-refresh, views are aggregated into one row per admin, page and 10-minute window rather than one row per refresh.

## How it works
- Fields: `adminId` (ref `GarageAdmin`, required), `adminEmail` (required), `isSuperAdmin` (default `false`), `page` (`"otp_codes"` or `"phone_otp_codes"`), `bucket` (start of the 10-minute window, required), `views` (refresh count, default 0), `codesShown` (number of codes on screen at the last view, after admin accounts are hidden), `ip` (default `null`), `lastViewedAt`, plus `timestamps`.
- Indexes: unique `{ adminId: 1, page: 1, bucket: 1 }` (one row per admin/page/window, enabling upserts) and `{ createdAt: -1 }` for newest-first audit listing.
- Explicit collection name `otp_code_access_logs`.

## Exports
- `OtpCodeAccessLog` - the Mongoose model.

## Interfaces
- **Database:** `OtpCodeAccessLog` (collection `otp_code_access_logs`) - written by the auth routes.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/auth.ts` (mounted at `/auth`): its `logOtpView` helper computes `bucket = floor(now / 10 min)`, then `updateOne(..., { upsert: true })` with `$setOnInsert` (email, super-admin flag), `$inc: { views: 1 }` and `$set` (`codesShown`, `ip`, `lastViewedAt`). Called from `GET /backend/auth/otp-codes` and `GET /backend/auth/phone-otp-codes`, both behind `requireGarageAdminAuth` and `requireAdminPage(...)`. Logging failures are only console-logged and never fail the request.

## Notes
- This is a security audit trail; there is no TTL, so rows are retained indefinitely.
