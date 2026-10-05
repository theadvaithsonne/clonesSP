# `server/services/welcomeEmail.ts`

> Module exporting `notifyReferrerOfNewSignup`, `notifyAffiliateOnboarded`, `sendWelcomeEmail`, `sendWelcomeEmailTest` and 1 more.

**Kind:** backend service · **Lines:** 1127

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DEFAULT_WELCOME_TEMPLATE_ID` | const | `= "__default__"` — Also the unset case: an org that has never been configured. | 35 |
| `notifyReferrerOfNewSignup` | function | `async notifyReferrerOfNewSignup(newUserId: string, referrerUserId: string, orgIdHint?: string \| null): Promise<void>` | 551 |
| `notifyAffiliateOnboarded` | function | `async notifyAffiliateOnboarded(newUserId: string, referrerUserId: string, _orgIdHint?: string \| null): Promise<void>` | 581 |
| `sendWelcomeEmail` | function | `async sendWelcomeEmail(userId: string, nonParentOrgId: string \| null): Promise<void>` | 714 |
| `sendWelcomeEmailTest` | function | `async sendWelcomeEmailTest(userId: string, orgId: string, templateHtml?: string): Promise<{ to: string }>` — Sends the organization's join-welcome email to one named user on demand — the "send a test to my inbox" button in Manage Organization. | 895 |
| `notifyFounderOnboarded` | function | `async notifyFounderOnboarded(founderUserId: string, orgId: string): Promise<void>` | 978 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`, `aggregate`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`, `findOne`
  - `Workshop` (server/models/workshop.model.ts) — reads: `find`
- **Environment via `server/config/env.ts`:** `env.FRONTEND_URL`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/services/mailer.ts` — `sendMail`, `EMAIL_FROM_NOTIFICATION`, `senderForOrg`
  - `server/services/affiliate.ts` — `ensureUserHasAffiliateId`
  - `server/services/bulkEmail.ts` — `emailShell`, `ctaButton`, `greeting`, `bodyText`
  - `server/config/env.ts` — `env`
  - `server/services/affiliateEmailTemplates.ts` — `buildReferrerEmail`, `buildManagerEmail`, `buildAdminEmail`, `buildWelcomeEmail`, `formatAffiliateLocation`, `PLATFORM_CC`
  - `server/services/founderEmailTemplates.ts` — `buildFounderReferrerEmail`, `buildFounderManagerEmails`, `buildFounderAdminEmail`, `buildFounderWelcomeEmail`, `formatCorporateLocation`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/affiliate.ts`
- `server/routes/auth.ts`
- `server/routes/callCheckout.ts`
- `server/routes/channelCheckout.ts`
- `server/routes/courseCheckout.ts`
- `server/routes/guestAuth.ts`
- `server/routes/invites.ts`
- `server/routes/org.ts`
- `server/routes/productCheckout.ts`
- `server/routes/publicMeet.ts`
- `server/routes/publicWebinar.ts`
- `server/routes/serviceCheckout.ts`
- `server/routes/workshopCheckout.ts`
- `server/scripts/backfill-referral-attribution.ts`
- `server/services/affiliate.ts`
