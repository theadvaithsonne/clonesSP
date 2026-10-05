# `server/services/otp.ts`

> Module exporting `generateOtp`, `createOtp`, `verifyOtp`.

**Kind:** backend service · **Lines:** 101

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `generateOtp` | function | `generateOtp(length = 6)` | 4 |
| `createOtp` | function | `async createOtp(email: string, purpose: \| "login" \| "invite" \| "garage-admin-login" \| "gar…, orgId?: string)` | 8 |
| `verifyOtp` | function | `async verifyOtp(email: string, code: string, purpose: \| "login" \| "invite" \| "garage-admin-login" \| "gar…)` | 44 |

## Interfaces

- **Database (Mongoose models used):**
  - `OtpCode` (server/models/otpcode.model.ts) — reads: `findOne`; **writes:** `findOneAndUpdate`, `deleteMany`

## Dependencies

- **Internal:**
  - `server/models/otpcode.model.ts` — `OtpCode`
- **Packages:** none

## Used by

- `server/controllers/garageAdmin.controller.ts`
- `server/routes/affiliate.ts`
- `server/routes/auth.ts`
- `server/routes/callCheckout.ts`
- `server/routes/channelCheckout.ts`
- `server/routes/courseCheckout.ts`
- `server/routes/guestAuth.ts`
- `server/routes/invites.ts`
- `server/routes/invoice.ts`
- `server/routes/joinRequests.ts`
- `server/routes/membership.ts`
- `server/routes/productCheckout.ts`
- `server/routes/publicMeet.ts`
- `server/routes/publicWebinar.ts`
- `server/routes/serviceCheckout.ts`
- `server/routes/workshopCheckout.ts`
- `server/scripts/test-auth-identifier-contract.ts`
