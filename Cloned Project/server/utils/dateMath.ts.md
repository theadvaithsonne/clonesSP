# `server/utils/dateMath.ts`

> Add N months, clamping to the last valid day of the target month.

**Kind:** backend utility · **Lines:** 23

<!-- docgen:auto -->

## Purpose
Add N months, clamping to the last valid day of the target month.

Native `setMonth` overflows: Aug 31 + 6 months lands on Mar 3, not Feb 28.
At 1-month intervals that quirk is pre-existing and rare; at 6/12-month
intervals it becomes a visible billing-date defect, so multi-month terms
clamp instead.

Lives in a leaf module (no model or service imports) so both the invoice
service and the third-party term pricing can use it without a cycle.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `addMonthsClamped` | function | `addMonthsClamped(from: Date, months: number): Date` — Add N months, clamping to the last valid day of the target month. | 12 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/services/comboActivation.ts`
- `server/services/invoice.ts`
- `server/services/thirdPartyInvoice.ts`
- `server/services/thirdPartyTerms.ts`
- `server/services/thirdPartyWebhook.ts`
