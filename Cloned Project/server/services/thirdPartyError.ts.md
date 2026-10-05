# `server/services/thirdPartyError.ts`

> Shared error type for the third-party (partner API) surface.

**Kind:** backend service · **Lines:** 18

<!-- docgen:auto -->

## Purpose
Shared error type for the third-party (partner API) surface.

Lives in its own module so pure modules like `thirdPartyTerms.ts` can throw it
without importing `thirdPartyInvoice.ts` — which transitively pulls in the
invoice service and the Razorpay client. That import would also be circular,
since `thirdPartyInvoice.ts` needs `thirdPartyTerms.ts` for term pricing.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ThirdPartyError` | class | `extends Error` — Shared error type for the third-party (partner API) surface. | 9 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/routes/thirdPartySubscription.ts`
- `server/services/thirdPartyInvoice.ts`
- `server/services/thirdPartyTerms.ts`
