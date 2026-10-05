# `server/utils/couponRouting.ts`

> Module exporting `routeCoupon`.

**Kind:** backend utility · **Lines:** 20

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `routeCoupon` | function | `async routeCoupon(code: string \| undefined): Promise<{ isPlatform: boolean; code?: string }>` — Determine whether a user-provided coupon code refers to a PlatformCoupon (new system) or a legacy Coupon. | 12 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/platformCoupon.ts` — `getPlatformCouponByCode`
- **Packages:** none

## Used by

- `server/routes/callCheckout.ts`
- `server/routes/channelCheckout.ts`
- `server/routes/courseCheckout.ts`
- `server/routes/officeCheckout.ts`
- `server/routes/productCheckout.ts`
- `server/routes/serviceCheckout.ts`
- `server/routes/workshopCheckout.ts`
- `server/services/eventManagement.ts`
