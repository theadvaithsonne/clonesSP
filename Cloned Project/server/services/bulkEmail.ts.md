# `server/services/bulkEmail.ts`

> Module exporting `emailShell`, `ctaButton`, `fallbackLink`, `greeting` and 10 more.

**Kind:** backend service · **Lines:** 1144

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FONT` | const | `` = `'Geist', 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Aria… `` | 105 |
| `emailShell` | function | `emailShell(headerHtml: string, bodyHtml: string): string` | 107 |
| `ctaButton` | function | `ctaButton(href: string, label: string): string` | 130 |
| `fallbackLink` | function | `fallbackLink(href: string): string` | 138 |
| `greeting` | function | `greeting(name: string): string` | 145 |
| `bodyText` | function | `bodyText(text: string): string` | 151 |
| `notifyNewOfficeCreated` | function | `notifyNewOfficeCreated(org: { _id: string; name: string; slug: string; city?: stri…)` | 615 |
| `notifyNewProductCreated` | function | `notifyNewProductCreated(product: { _id: string; name: string; price: number; curren…, orgName: string, orgId: string)` | 682 |
| `notifyNewPersonJoined` | function | `notifyNewPersonJoined(newUser: { email: string; name?: string; city?: string; ref…)` | 729 |
| `notifyNewServiceCreated` | function | `notifyNewServiceCreated(service: { _id: string; name: string; description?: string;…, orgName: string, orgId: string)` | 761 |
| `notifyNewCourseCreated` | function | `notifyNewCourseCreated(course: { _id: string; name: string; price?: number; curren…, orgName: string, orgId: string)` | 804 |
| `notifyNewWorkshopCreated` | function | `notifyNewWorkshopCreated(workshop: { _id: string; name: string; price?: number; curr…, orgName: string, orgId: string)` | 850 |
| `notifyNewCallCreated` | function | `notifyNewCallCreated(call: { _id: string; name: string; pricePerCall?: number; c…, orgName: string, orgId: string)` | 899 |
| `notifyNewChannelCreated` | function | `notifyNewChannelCreated(channel: { _id: string; name: string; price?: number; curre…, orgName: string, orgId: string)` | 947 |
| `notifyNewFeedPostCreated` | function | `notifyNewFeedPostCreated(post: { _id: string; content: string; postType?: string; ti…, author: { email: string; name: string }, org: { _id: string; name: string; slug: string })` | 1071 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `find`, `findOne`
- **Environment via `server/config/env.ts`:** `env.RESEND_API_KEY`, `env.ENABLE_BULK_EMAILS`, `env.FRONTEND_URL`, `env.FEED_POST_EMAIL_MUTED_AUTHORS`
- **Timers / queues:** `setTimeout` at L95

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/user.model.ts` — `User`
  - `server/services/mailer.ts` — `EMAIL_FROM_NOTIFICATION`
- **Packages:**
  - `resend` — `Resend`
  - `mongoose` — `Types`

## Used by

- `server/models/user.model.ts`
- `server/routes/call.ts`
- `server/routes/course.ts`
- `server/routes/feed.ts`
- `server/routes/org.ts`
- `server/routes/product.ts`
- `server/routes/service.ts`
- `server/routes/workshop.ts`
- `server/services/invoiceEmail.ts`
- `server/services/orgKycEmail.ts`
- `server/services/referralBonusEmail.ts`
- `server/services/teamforceOnboardingEmail.ts`
- `server/services/welcomeEmail.ts`
