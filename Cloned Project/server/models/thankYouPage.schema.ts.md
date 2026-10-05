# `server/models/thankYouPage.schema.ts`

> Shared Mongoose sub-schema for the founder-configurable post-purchase "thank-you page" embedded in sellable items.

**Kind:** Mongoose model (sub-schema, no model) · **Lines:** 54

## Purpose
Products, courses and channels all offer the same post-purchase experience on the invoice `success` step. Keeping the schema in one file guarantees the stored shape and validation stay identical across item types, because the frontend uses one shared renderer and a divergence would silently break it. The matching normaliser lives in `server/services/thankYouPage.ts`; the header comment warns not to import that service from a model file, to avoid a services-to-models import cycle.

## How it works
The page is shown only at the moment payment succeeds, never on refreshes of an already-paid invoice. Two modes:
- `autoRedirect: true` - the buyer is sent to `redirectUrl` in a new window right after payment.
- `autoRedirect: false` - the page renders `title`, `message` and up to five button sections on top of the standard HQ header.

`ThankYouPageSectionSchema` (`_id: false`): `heading` (required, trimmed, max 60), `buttonLabel` (required, trimmed, max 40), `buttonUrl` (required, trimmed).

`ThankYouPageSchema` (`_id: false`): `autoRedirect` (default false), `redirectUrl`, `title` (max 120), `message` (max 400), `sections` (array of section sub-docs, `default: undefined` so an empty array is not written to documents that never configured sections).

The "up to 5 sections" limit is not enforced in this schema; it is expected to be enforced by the normaliser service or the UI.

## Exports
- `interface IThankYouPageSection` - `{ heading, buttonLabel, buttonUrl }`.
- `interface IThankYouPage` - `{ autoRedirect, redirectUrl?, title?, message?, sections? }`.
- `ThankYouPageSectionSchema` - sub-schema for one button section.
- `ThankYouPageSchema` - the embeddable thank-you page sub-schema.

## Dependencies
- **Packages:** `mongoose` - `Schema`.

## Used by
Embedded as a field type in `server/models/channel.model.ts`, `server/models/course.model.ts` and `server/models/product.model.ts`; the interfaces are used by `server/services/thankYouPage.ts`.
