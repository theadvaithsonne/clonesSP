# `server/services/twoFactorSms.ts`

> src/services/twoFactorSms.ts

**Kind:** backend service · **Lines:** 112

<!-- docgen:auto -->

## Purpose
src/services/twoFactorSms.ts

Thin wrapper over 2Factor.in's transactional SMS OTP API. We generate the
OTP ourselves (services/otp.ts stores + verifies it against Mongo with a
10-minute TTL); 2Factor is used purely as the SMS delivery pipe. This is
the "send a specific OTP" endpoint — NOT AUTOGEN — so verification stays
local and we never depend on 2Factor holding session state.

Endpoint shape (from the working curl):
  https://2factor.in/API/V1/{API_KEY}/SMS/{phone}/{otp}/{template}
  → { "Status": "Success", "Details": "<tracking-session-id>" }

Config (config/env.ts):
  TWO_FACTOR_API_KEY       — required; SMS send is a no-op without it
  TWO_FACTOR_OTP_TEMPLATE  — DLT-approved template name (default "OTP1")

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `twoFactorConfigured` | function | `twoFactorConfigured(): boolean` | 18 |
| `normalizePhone` | function | `normalizePhone(raw: string): string \| null` — Normalise a phone number into the E.164 shape 2Factor expects (`+<countrycode><number>`). | 28 |
| `storablePhone` | function | `storablePhone(raw?: string \| null): string \| undefined` — The shape a phone number must be STORED in. | 66 |
| `sendOtpSms` | function | `async sendOtpSms(phone: string, code: string): Promise<string>` — Send a pre-generated OTP to a phone via 2Factor SMS. | 77 |

## Interfaces

- **Environment via `server/config/env.ts`:** `env.TWO_FACTOR_API_KEY`, `env.TWO_FACTOR_OTP_TEMPLATE`
- **Timers / queues:** `setTimeout` at L91
- **External hosts mentioned in the code:** `2factor.in`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
- **Packages:** none

## Used by

- `server/routes/affiliate.ts`
- `server/routes/auth.ts`
- `server/routes/downlines.ts`
- `server/routes/guestAuth.ts`
- `server/routes/invites.ts`
- `server/routes/profile.ts`
- `server/services/accountMerge.ts`
- `server/services/elevenZaWhatsapp.ts`
