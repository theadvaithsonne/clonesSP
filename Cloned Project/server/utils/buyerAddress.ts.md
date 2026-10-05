# `server/utils/buyerAddress.ts`

> Module exporting `resolveBuyerAddress`.

**Kind:** backend utility · **Lines:** 56

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `resolveBuyerAddress` | function | `resolveBuyerAddress(invoice: any, buyerUser: any): AddressInput \| null` — Resolve the buyer's geographic address for founder-program commission attribution (buyer-location based). | 17 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/utils/territoryResolver.ts` — `AddressInput`
- **Packages:** none

## Used by

- `scripts/verify-franchise-logic.ts`
- `server/services/invoice.ts`
- `server/utils/gstBuyerRegion.ts`
