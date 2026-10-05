# `server/models/magicLink.model.ts`

> Mongoose model for shareable offer links (`my.garage.app/magic-link/<token>`) that quote a plan to a specific user, plus the token generator.

**Kind:** Mongoose model · **Lines:** 124

## Purpose
A magic link lets someone send a target user a personalised offer page. The model deliberately stores **intent only**: the target user, the third-party client (product) and optionally which plan term. It never stores a price. Every page load and every checkout re-quotes live through `services/comboCheckout.ts`. As a result, the price changes automatically when the 24-hour offer window lapses, with no sweeper needed to rewrite stale links.

## How it works
### Security model (from the header comment)
- The token is the only credential needed to *view* a link, the same posture as an invoice link (`/invoice/<_id>`).
- Payment is gated separately by the email OTP that the invoice page already enforces, so a leaked link exposes a price quote, never a purchase.
- There is no `expiresAt`. Links are reusable and outlive the offer window on purpose; they simply start quoting normal prices.

### Fields
- `token` - required, **unique**.
- `userId` (ref `User`, required) - the recipient.
- `thirdPartyClientId` (required ObjectId, no `ref`).
- `termMonths` (1-60, optional). If **absent**, this is a *catalog link* that shows every active term (monthly plus each bundle) and lets the recipient pick. That is what the automatic sign-up email sends.
- `createdByUserId` (ref `User`, required) - audit trail. Any logged-in user can mint a link that emails a stranger, so this is the backstop against abuse.
- `status` - `active` (default) | `consumed` | `revoked`, indexed.
- `consumedInvoiceId` (ref `Invoice`), `consumedAt` - the payment that consumed the link.
- `accessCount` (default 0), `lastAccessedAt` - view tracking.
- `emailSentAt`, `whatsappSentAt` - kept separate because the two channels are attempted independently; one failing must not make the other look unsent.
- `remindersSent: number[]` (email) and `remindersSentWhatsapp: number[]` - append-only lists of countdown marks already handled, as "hours to go" (18 / 12 / 6 / 1). The lists are per channel so a WhatsApp outage at the 12h mark does not retire the 12h email. Marks are recorded even when the email is deliberately suppressed: `services/magicLinkReminders.ts` collapses a backlog into a single send so an outage cannot trigger four emails at once.

### Indexes
- `{ userId: 1, thirdPartyClientId: 1, termMonths: 1 }` - dedupe lookup on create, so re-sending does not mint a second token for the same offer.
- `{ createdByUserId: 1, createdAt: -1 }` - rate-limit lookup: how many links has this creator minted recently.
- `{ status: 1, emailSentAt: 1 }` - the reminder sweep's working set (active links whose first email has gone).

### Token generation
`generateMagicLinkToken()` returns `ml_` + 12 base64url characters from `crypto.randomBytes(9)` (about 71 bits of entropy). This follows the same idiom as `utils/shareableToken.ts` and `utils/guestToken.ts`.

## Exports
- `MagicLink` - Mongoose model `"MagicLink"`.
- `generateMagicLinkToken(): string` - new random link token.
- `IMagicLink` - interface.
- `MAGIC_LINK_STATUSES`, `MagicLinkStatus`.

## Interfaces
- **Database:** `MagicLink` (collection `magiclinks`) - read/write.
- **Background work:** read and updated by the reminder sweep in `server/services/magicLinkReminders.ts`.

## Dependencies
- **Packages:** `mongoose`; `crypto` (Node built-in) - token randomness.

## Used by
- `server/routes/magicLink.ts` (mounted at `/magic-link`, browser `/backend/magic-link`) - mint, view and track links.
- `server/routes/platformOffices.ts` - mints links for platform offices.
- `server/services/signupOffer.ts` - mints the catalog link sent in the automatic sign-up email.
- `server/services/magicLinkReminders.ts` - countdown reminders.

## Notes
- The interface has two consecutive JSDoc blocks above `remindersSent`; the second one is the current description.
- Because no price is stored, anything that displays a link's price must re-quote it; never cache a quote on the document.
