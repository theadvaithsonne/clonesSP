# `server/services/elevenZaWhatsapp.ts`

> src/services/elevenZaWhatsapp.ts

**Kind:** backend service · **Lines:** 216

<!-- docgen:auto -->

## Purpose
src/services/elevenZaWhatsapp.ts

WhatsApp OTP delivery via 11za, the companion to services/twoFactorSms.ts.
Same division of labour: we generate and verify the OTP ourselves
(services/otp.ts, Mongo-backed with a TTL) and 11za is only the pipe.

Endpoint (from the published Postman collection, "Send Body Dynamic value
Template"):

  POST https://api.11za.in/apis/template/sendTemplate
  { authToken, originWebsite, sendto, templateName, language, name, data[] }
  → { "Message": "Message Sent", "Data": 1, "Status": 200, "IsSuccess": true }

Errors come back as HTTP 200 with `IsSuccess: false` and a human message
("Invalid authToken…", "Invalid customer mobile number…", "Invalid template
data…"), so the status code alone is not a success signal — `IsSuccess` is. […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `elevenZaConfigured` | function | `elevenZaConfigured(): boolean` | 26 |
| `elevenZaMagicLinkConfigured` | function | `elevenZaMagicLinkConfigured(): boolean` — Magic-link sends need no env-configured template name — both are constants. | 47 |
| `sendOtpWhatsapp` | function | `async sendOtpWhatsapp(phone: string, code: string, recipientName?: string \| null): Promise<string>` — Send a pre-generated OTP over WhatsApp. | 80 |
| `sendMagicLinkWhatsapp` | function | `async sendMagicLinkWhatsapp(input: { phone: string; recipientName?: string \| null; send…): Promise<string>` — Send a magic link over WhatsApp. | 164 |

## Interfaces

- **External HTTP calls:**
  - `POST https://api.11za.in/apis/template/sendTemplate` (L117)
- **Environment via `server/config/env.ts`:** `env.ELEVENZA_AUTH_TOKEN`, `env.ELEVENZA_OTP_TEMPLATE`, `env.ELEVENZA_ORIGIN_WEBSITE`, `env.ELEVENZA_OTP_LANGUAGE`
- **Timers / queues:** `setTimeout` at L115
- **External hosts mentioned in the code:** `api.11za.in`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/services/twoFactorSms.ts` — `normalizePhone`
- **Packages:** none

## Used by

- `server/routes/auth.ts`
- `server/routes/magicLink.ts`
- `server/services/magicLinkReminders.ts`
