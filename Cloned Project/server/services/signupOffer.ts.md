# `server/services/signupOffer.ts`

> src/services/signupOffer.ts

**Kind:** backend service · **Lines:** 146

<!-- docgen:auto -->

## Purpose
src/services/signupOffer.ts

Fires once per new account: mints a CATALOG magic link (every active
NetworkChain term on one page) and emails it, so the 24-hour free-first-month
window that opens at sign-up is actually put in front of the user.

Called from a post-save hook on the User model, which is why everything here
is defensive: this must never be able to fail an account creation. Every
failure path logs and returns rather than throwing, and the caller invokes it
fire-and-forget.

Idempotent on (userId, client, catalog-link): re-running finds the existing
link and skips the send, so a retried signup can't double-mail anyone.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `setSignupOffersEnabled` | function | `setSignupOffersEnabled(on: boolean)` | 34 |
| `sendSignupOffer` | function | `async sendSignupOffer(input: { userId: string; email?: string \| null; name?: stri…): Promise<{ sent: boolean; reason?: string }>` — Send the sign-up offer to a brand-new user. | 45 |

## Interfaces

- **Database (Mongoose models used):**
  - `ThirdPartyClient` (server/models/thirdPartyClient.model.ts) — reads: `findOne`
  - `MagicLink` (server/models/magicLink.model.ts) — reads: `findOne`; **writes:** `create`
- **Environment via `server/config/env.ts`:** `env.FRONTEND_URL`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/thirdPartyClient.model.ts` — `ThirdPartyClient`
  - `server/models/magicLink.model.ts` — `MagicLink`, `generateMagicLinkToken`
  - `server/services/comboCheckout.ts` — `quoteAllPlans`
  - `server/services/mailer.ts` — `sendMail`, `offerMagicLinkTemplate`, `EMAIL_FROM_NOTIFICATION`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/bat246/scripts/addTestUsers10to19.ts`
- `server/models/user.model.ts`
- `server/routes/auth.ts`
- `server/scripts/seedBat246Distributors.ts`
