# `server/services/referralBonusEmail.ts`

> Module exporting `buildReferrerEmail`, `buildRefereeEmail`, `sendReferralBonusEmails`.

**Kind:** backend service · **Lines:** 220

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ReferralBonusEmailParty` | interface |  | 77 |
| `ReferralBonusEmailArgs` | interface |  | 84 |
| `buildReferrerEmail` | function | `buildReferrerEmail(a: ReferralBonusEmailArgs): { subject: string; html: string; text: string; }` — Split from the send so the rendered output can be inspected in tests. | 92 |
| `buildRefereeEmail` | function | `buildRefereeEmail(a: ReferralBonusEmailArgs): { subject: string; html: string; text: string; }` | 139 |
| `sendReferralBonusEmails` | function | `async sendReferralBonusEmails(a: ReferralBonusEmailArgs): Promise<{ referrerSent: boolean; refereeSent: boo…` — Sends both. Returns which ones actually went out so the payout row can be stamped — a silently missing notification is otherwise invisible. | 193 |

## Interfaces

- **Environment via `server/config/env.ts`:** `env.FRONTEND_URL`

## Dependencies

- **Internal:**
  - `server/services/mailer.ts` — `sendMail`, `senderForOrg`, `EMAIL_FROM_NOTIFICATION`
  - `server/services/bulkEmail.ts` — `emailShell`, `ctaButton`, `fallbackLink`, `greeting`, `bodyText`
  - `server/config/env.ts` — `env`
- **Packages:** none

## Used by

- `server/services/referralSignupBonus.ts`
