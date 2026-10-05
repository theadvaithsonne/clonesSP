# `server/services/thankYouPage.ts`

> Shared normaliser for founder-supplied thankYouPage payloads.

**Kind:** backend service · **Lines:** 82

<!-- docgen:auto -->

## Purpose
Shared normaliser for founder-supplied thankYouPage payloads. Wired
into both createProduct/updateProduct and createCourse/updateCourse.
The schema lives at models/thankYouPage.schema.ts.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ThankYouPageInput` | type | Founder-configurable post-payment page. | 11 |
| `MAX_THANK_YOU_SECTIONS` | const | `= 5` | 19 |
| `normalizeThankYouPage` | function | `normalizeThankYouPage(input: ThankYouPageInput \| undefined): IThankYouPage \| null \| undefined` — Normalize + validate a founder-supplied thankYouPage payload. | 29 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/models/thankYouPage.schema.ts` — `IThankYouPage`, `(types only)`
- **Packages:** none

## Used by

- `server/routes/feed.ts`
- `server/services/course.ts`
- `server/services/product.ts`
