# `server/models/emailAlerts.schema.ts`

> Shared definition of the post-purchase "order email" setting: a Mongoose field definition, a zod request validator and a normaliser for sellable items.

**Kind:** Mongoose model (shared schema fragment, not a model) · **Lines:** 71

## Purpose
Products, courses, communities (channels) and workshops can each send buyers a branded order-confirmation email after purchase. The email template comes from **Network Mail**, a separate external service that authenticates with the browser's JWT, so this backend cannot fetch the template when it sends. Instead the frontend renders the chosen template, snapshots its HTML (with the `{{merge_tags}}` left in) and re-syncs it on every save. This file keeps the three sides of that contract together so they cannot drift: the stored shape, the accepted request shape and the mapping between them.

## How it works
- `IEmailAlerts`: `enabled`, plus optional `templateId` (a Network Mail template id, or `"__default__"` for the built-in Garage layout), `templateName`, `templateHtml` and `syncedAt`.
- `emailAlertsSchemaField`: a plain object of Mongoose field definitions (`enabled` default false, trimmed strings, `templateHtml` untrimmed, `syncedAt` Date). Owning schemas assign it to their `emailAlerts` key.
- `emailAlertsZodSchema`: every field is optional, because a disabled section posts empty strings. `syncedAt` arrives as a string.
- `normalizeEmailAlerts(input)`: coerces `enabled` to a boolean. When it is disabled, `templateId`, `templateName` and `templateHtml` are cleared to `""` so no stale snapshot is left behind. `syncedAt` becomes `new Date(input.syncedAt)`, or the current time if it was omitted.

## Exports
- `IEmailAlerts` - stored shape.
- `emailAlertsSchemaField` - Mongoose field definition object.
- `EmailAlertsInput` - shape posted by the forms (`syncedAt` may be a string or a Date).
- `emailAlertsZodSchema` - zod object validator.
- `normalizeEmailAlerts(input: EmailAlertsInput): IEmailAlerts` - converts form input into the stored shape.

## Interfaces
- **External services:** Network Mail (template source, accessed only from the browser).

## Dependencies
- **Packages:** `zod` - request validation.

## Used by
- Models: `server/models/channel.model.ts`, `course.model.ts`, `product.model.ts`, `workshop.model.ts`.
- Routes and services: `server/routes/feed.ts`, `server/routes/workshop.ts`, `server/services/course.ts`, `server/services/product.ts`, `server/services/workshop.ts`.

## Notes
- The file imports no Mongoose. It exports a field-definition object, not a sub-schema, so each owning schema embeds it inline.
- The seller-side counterpart, which notifies the founder rather than the buyer, is `founderAlerts.schema.ts`.
