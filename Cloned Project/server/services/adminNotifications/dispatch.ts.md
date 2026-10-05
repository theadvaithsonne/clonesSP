# `server/services/adminNotifications/dispatch.ts`

> Admin notification dispatch: an event happened — which rules fire, who gets mailed, and did we already handle it.

**Kind:** backend service · **Lines:** 196

<!-- docgen:auto -->

## Purpose
Admin notification dispatch: an event happened — which rules fire, who gets
mailed, and did we already handle it.

Callers must treat this as fire-and-forget and never await it on a request
path: a notification failure must never fail the payment or signup that
raised the event. `emitAdminEvent` catches everything itself, but the caller
should still schedule it off the hot path (see paymentEvents.ts).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EmitSummaryRow` | interface |  | 23 |
| `emitAdminEvent` | function | `async emitAdminEvent(args: { eventName: string; /** Stable per real-world occurr…): Promise<void>` | 28 |

## Interfaces

- **Database (Mongoose models used):**
  - `AdminNotificationRule` (server/models/adminNotificationRule.model.ts) — reads: `find`; **writes:** `updateOne`
  - `AdminNotificationLog` (server/models/adminNotificationLog.model.ts) — reads: `countDocuments`; **writes:** `create`
  - `User` (server/models/user.model.ts) — reads: `find`
  - `GarageAdminModel` (server/models/garageAdmin.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/models/adminNotificationRule.model.ts` — `AdminNotificationRule`, `RecipientSpec`
  - `server/models/adminNotificationLog.model.ts` — `AdminNotificationLog`
  - `server/models/user.model.ts` — `User`
  - `server/models/garageAdmin.model.ts` — `GarageAdminModel`
  - `server/config/adminNotificationEvents.ts` — `findEvent`
  - `server/services/mailer.ts` — `sendMail`, `EMAIL_FROM_NOTIFICATION`
  - `server/services/adminNotifications/evaluate.ts` — `evaluate`, `EvalPayload`, `EvalUser`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/services/adminNotifications/paymentEvents.ts`
