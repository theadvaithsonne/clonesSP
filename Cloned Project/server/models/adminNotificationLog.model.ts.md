# `server/models/adminNotificationLog.model.ts`

> Mongoose model `AdminNotificationLog`: one row per (rule, event) match of an admin notification rule, serving as both audit trail and idempotency lock.

**Kind:** Mongoose model · **Lines:** 56

## Purpose
Admin notification rules ("when event X happens, mail Y" - see `adminNotificationRule.model.ts`) can fire repeatedly for the same event because of retries, double emits or delayed re-checks. This collection answers "why did this person get mailed?" and guarantees at most one email per rule per event.

## How it works
- **Idempotency:** a unique index on `{ ruleId, eventId }`. The dispatcher inserts the row *before* sending mail; a duplicate-key error on insert means "already handled", not a failure.
- **Throttling:** index `{ ruleId, status, createdAt: -1 }` supports "how many has this rule sent in the last hour?" (used against the rule's `throttlePerHour`).
- `ruleName` is denormalised so a log row still reads sensibly after its rule is deleted.
- `status` lifecycle: `queued` (default) -> `sent` | `failed`, or `skipped_throttle` / `skipped_no_recipients`.
- `eventName` is indexed for filtering by event.
- Timestamps on; default collection `adminnotificationlogs`.

## Exports
- `AdminNotificationLog` - Mongoose model.
- `interface IAdminNotificationLog` - `ruleId`, `ruleName`, `eventName`, `eventId`, `recipients: string[]`, `status`, `error?`, timestamps.
- `type AdminNotificationLogStatus` - `"queued" | "sent" | "failed" | "skipped_throttle" | "skipped_no_recipients"`.

## Interfaces
- **Database:** `AdminNotificationLog` (collection `adminnotificationlogs`); `ruleId` refs `AdminNotificationRule`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/services/adminNotifications/dispatch.ts` - creates log rows (`AdminNotificationLog.create`) and counts recent sends for throttling (`countDocuments`).
