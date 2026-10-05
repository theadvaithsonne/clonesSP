# `server/services/magicLinkReminders.ts`

> src/services/magicLinkReminders.ts

**Kind:** backend service · **Lines:** 333

<!-- docgen:auto -->

## Purpose
src/services/magicLinkReminders.ts

Countdown emails for an unclaimed NetworkChain offer: 18h, 12h, 6h and 1h
before the 24-hour window closes.

Starts only once the magic link's FIRST email has gone out (`emailSentAt`),
so a link minted but never delivered never generates reminders.

Design notes worth keeping:

  * The sweep is driven by the offer window, not by wall-clock offsets from
    the send. `comboWindowFor` is the single source of truth for when the
    offer ends — including admin extensions, which push every remaining
    reminder out with it.

  * A backlog COLLAPSES. If the process was down from 18h to 5h remaining, […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `REMINDER_MARKS` | const | `= [18, 12, 6, 1] as const` — "Hours to go" marks, descending. | 56 |
| `setOfferRemindersEnabled` | function | `setOfferRemindersEnabled(on: boolean)` | 71 |
| `ReminderSweepResult` | interface |  | 75 |
| `sweepOfferReminders` | function | `async sweepOfferReminders(now: Date = new Date()): Promise<ReminderSweepResult>` — One pass over every active, already-emailed magic link. | 105 |

## Interfaces

- **Database (Mongoose models used):**
  - `MagicLink` (server/models/magicLink.model.ts) — reads: `find`; **writes:** `updateOne`
  - `User` (server/models/user.model.ts) — reads: `find`, `findById`
  - `Bat246Distributor` (server/bat246/models/bat246Distributor.model.ts) — reads: `find`
  - `Invoice` (server/models/invoice.model.ts) — reads: `exists`
  - `ThirdPartyClient` (server/models/thirdPartyClient.model.ts) — reads: `findById`
- **Environment variables (`process.env`):** `OFFER_REMINDER_WHATSAPP_MUTE_BAT246`
- **Environment via `server/config/env.ts`:** `env.FRONTEND_URL`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/user.model.ts` — `User`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/thirdPartyClient.model.ts` — `ThirdPartyClient`
  - `server/models/magicLink.model.ts` — `MagicLink`
  - `server/bat246/models/bat246Distributor.model.ts` — `Bat246Distributor`
  - `server/services/comboWindow.ts` — `comboWindowFor`
  - `server/services/comboCheckout.ts` — `quoteAllPlans`
  - `server/services/mailer.ts` — `sendMail`, `offerReminderTemplate`, `EMAIL_FROM_NOTIFICATION`
  - `server/services/elevenZaWhatsapp.ts` — `sendMagicLinkWhatsapp`, `elevenZaMagicLinkConfigured`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/index.ts`
