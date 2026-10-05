# `server/routes/magicLink.ts`

> src/routes/magicLink.ts

**Kind:** Express router · **Lines:** 627 · **Mounted at:** `/magic-link` (browser: `/backend/magic-link`)

<!-- docgen:auto -->

## Purpose
src/routes/magicLink.ts

Shareable NetworkChain offer links: my.garage.app/magic-link/<token>

  POST /magic-link              requireAuth  — mint a link and email it
  GET  /magic-link/:token       public       — live quote for the page
  POST /magic-link/:token/checkout  public   — mint the invoice, hand off

The GET and checkout are PUBLIC by design, matching how /invoice/<id> already
works: the token is enough to see a price, but paying is gated separately by
the email OTP the invoice page enforces against `customerEmail`. Minting an
unpaid invoice for someone is harmless; collecting money from them is not,
and that half is untouched.

Nothing about price is stored on the link. Every read re-quotes through
services/comboCheckout.ts, so a link emailed while the 24-hour offer window […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (3)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/` | `/backend/magic-link` | `requireAuth` | inline | 119 |
| GET | `/:token` | `/backend/magic-link/:token` | — | inline | 364 |
| POST | `/:token/checkout` | `/backend/magic-link/:token/checkout` | — | inline | 495 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 626 |

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findOne`
  - `MagicLink` (server/models/magicLink.model.ts) — reads: `countDocuments`, `findOne`; **writes:** `create`, `updateOne`
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `ThirdPartyClient` (server/models/thirdPartyClient.model.ts) — reads: `findById`
- **Environment via `server/config/env.ts`:** `env.FRONTEND_URL`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/config/env.ts` — `env`
  - `server/models/user.model.ts` — `User`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/thirdPartyClient.model.ts` — `ThirdPartyClient`
  - `server/models/magicLink.model.ts` — `MagicLink`, `generateMagicLinkToken`
  - `server/services/comboCheckout.ts` — `quoteComboCheckout`, `quoteAllPlans`, `createComboCheckoutInvoice`, `ComboCheckoutError`, `ComboQuote`
  - `server/services/comboActivation.ts` — `activateComboFreeFirstMonth`
  - `server/services/mailer.ts` — `sendMail`, `offerMagicLinkTemplate`, `EMAIL_FROM_NOTIFICATION`, `senderForHost`
  - `server/services/elevenZaWhatsapp.ts` — `sendMagicLinkWhatsapp`, `elevenZaMagicLinkConfigured`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/magic-link`.
