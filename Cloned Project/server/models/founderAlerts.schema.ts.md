# `server/models/founderAlerts.schema.ts`

> Shared definition of the seller-side "tell me when someone joins" alert: a Mongoose field definition, a zod validator and a normaliser used by every sellable item.

**Kind:** Mongoose model (shared schema fragment, not a model) · **Lines:** 78

## Purpose
`emailAlerts` (`emailAlerts.schema.ts`) emails the **buyer** a branded order confirmation. `founderAlerts` emails the **founder** a plain notification each time someone acquires the item, free or paid. It is carried by communities, courses, digital products, live streams (workshops), services and Event Programs. There is no template, because the founder is not a customer: the email uses the built-in Garage layout, and the only choices are on/off and who else gets a copy. Keeping the shape this small is why it could be added to models such as service and event that never adopted the `emailAlerts` template flow. The stored shape, request shape and mapping live together here so they cannot drift.

## How it works
- `IFounderAlerts`: `enabled` and optional `recipients[]`, the extra addresses CC'd alongside the item owner. An empty list means "just me". The owner is always notified and is never listed here.
- `founderAlertsSchemaField`: `enabled` (Boolean, default false) and `recipients` (`[String]`, default `undefined`). Owning schemas assign it to `founderAlerts`.
- `founderAlertsZodSchema`: optional `enabled` and optional string array `recipients`. A disabled section posts only `enabled: false`.
- `normalizeFounderAlerts(input)`:
  - When disabled, it returns `{ enabled: false, recipients: [] }`, dropping any stale list.
  - When enabled, it trims and lowercases each address, drops blanks, anything failing a simple email regex (`EMAIL_RE`, not exported) and duplicates, and keeps the original order.
  - Invalid addresses are discarded rather than stored, so they cannot fail silently at send time.

## Exports
- `IFounderAlerts` - stored shape.
- `founderAlertsSchemaField` - Mongoose field definition object.
- `FounderAlertsInput` - form payload shape.
- `founderAlertsZodSchema` - zod validator.
- `normalizeFounderAlerts(input: FounderAlertsInput): IFounderAlerts` - converts form input into the stored shape.

## Dependencies
- **Packages:** `zod`.

## Used by
- Models: `channel.model.ts`, `course.model.ts`, `eventProgram.model.ts`, `product.model.ts`, `service.model.ts`, `workshop.model.ts`.
- Routes: `server/routes/eventManagement.ts`, `server/routes/feed.ts`, `server/routes/workshop.ts`.
- Services: `course.ts`, `product.ts`, `service.ts`, `workshop.ts`. The alert email itself is sent by `server/services/founderAlertEmail.ts`.
- 13 importers in total.

## Notes
- The regex check is deliberately loose. It filters obvious garbage, not every invalid address.
