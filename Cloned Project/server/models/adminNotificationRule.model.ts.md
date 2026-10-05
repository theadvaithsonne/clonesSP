# `server/models/adminNotificationRule.model.ts`

> Mongoose model `AdminNotificationRule`: configurable "when event X matches these conditions, email these recipients" rules authored in the garage-admin console.

**Kind:** Mongoose model · **Lines:** 92

## Purpose
Lets Garage super admins define notification emails without code. A rule names a registry event (e.g. `"user.signup"`), a condition tree evaluated against the event payload, a list of recipient specifications resolved at send time, an email template and safety ceilings. The header points to a design spec (`docs/superpowers/specs/2026-09-11-admin-notification-rules-design.md`).

## How it works
- **Storage only, no validation of shapes:** `conditions` and `recipients` are `Schema.Types.Mixed` deliberately. They are recursive / discriminated unions Mongoose cannot express, and the route layer's zod schemas are the single validator.
- **Condition tree (`ConditionNode`):** `{ all: [...] }`, `{ any: [...] }`, `{ not: node }`, or a leaf `{ field, op, value? }`. Default is `{ all: [] }`.
- **Recipients (`RecipientSpec[]`):**
  - `static` - literal `emails`.
  - `relation` - `sponsor` | `upline` | `officeOwner` | `subject`, resolved per event so the rule survives changes of sponsor/owner.
  - `role` - everyone with a role.
  - `query` - a Mongo `filter` with a `cap`.
- **Safe defaults:** `enabled` defaults to `false` - saving a rule must never start sending mail before the admin does a dry run.
- **Ceilings:** `throttlePerHour` (default 60, 1-10000) and `recipientCap` (default 50, 1-5000); the comment says the server clamps regardless of UI input.
- **Template fields:** `templateId`, `templateName`, `templateHtml`, `syncedAt`.
- **Scope:** `orgId` (default `null` = platform-wide) exists so founder-scoped rules can be added later without migration; no founder UI exists yet.
- `createdBy` refs `GarageAdmin`; `lastFiredAt` is bumped by the dispatcher.
- `event` is a free string, not an enum: an unknown event name is storable and simply never matches.
- Indexes: `enabled`, `event`, `orgId` single-field, plus compound `{ event, enabled }` for the dispatcher's "enabled rules for this event" query.
- `name` max 120 chars, `description` max 500.

## Exports
- `AdminNotificationRule` - Mongoose model.
- `interface IAdminNotificationRule` - document shape described above.
- `type ConditionNode` - condition-tree union.
- `type RecipientSpec` - recipient-spec union.

## Interfaces
- **Database:** `AdminNotificationRule` (collection `adminnotificationrules`); refs `Organization`, `GarageAdmin`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/adminNotifications.ts` - CRUD for the console, mounted at `/garage-admin/notifications` (browser: `/backend/garage-admin/notifications`).
- `server/services/adminNotifications/dispatch.ts` - finds enabled rules for an event, updates `lastFiredAt`.
- `server/services/adminNotifications/evaluate.ts` - evaluates conditions / types.

## Notes
- Because `recipients` of type `query` can target arbitrary user filters, the `recipientCap` and `throttlePerHour` limits are the main guard against mass mailing.
