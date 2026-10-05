# `server/services/coupon.ts`

> Module exporting `validateSpecificItemIds`, `listItemsByCategory`, `createCoupon`, `updateCoupon` and 11 more.

**Kind:** backend service · **Lines:** 608

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CreateCouponInput` | interface |  | 60 |
| `UpdateCouponInput` | interface |  | 80 |
| `ValidateCouponParams` | interface |  | 96 |
| `CouponValidationResult` | interface |  | 105 |
| `RecordUsageParams` | interface |  | 113 |
| `ItemValidationResult` | interface |  | 128 |
| `validateSpecificItemIds` | function | `async validateSpecificItemIds(specificItemIds: string[], applicableTo: ApplicableItemType[], orgId?: string, isFounder: boolean = false): Promise<ItemValidationResult>` — Validates that specificItemIds exist and match the specified applicableTo categories For founders, also verifies items belong to their organization | 140 |
| `listItemsByCategory` | function | `async listItemsByCategory(itemTypes: ApplicableItemType[], orgId?: string, isFounder: boolean = false): Promise<Record<ApplicableItemType, Array<{ _id: s…` — Lists available items by category for coupon targeting UI | 204 |
| `createCoupon` | function | `async createCoupon(input: CreateCouponInput): Promise<ICoupon>` | 257 |
| `updateCoupon` | function | `async updateCoupon(couponId: string, input: UpdateCouponInput, orgId?: string, isFounder: boolean = false): Promise<ICoupon \| null>` | 307 |
| `deactivateCoupon` | function | `async deactivateCoupon(couponId: string): Promise<ICoupon \| null>` | 344 |
| `getCouponById` | function | `async getCouponById(couponId: string): Promise<ICoupon \| null>` | 353 |
| `getCouponByCode` | function | `async getCouponByCode(code: string): Promise<ICoupon \| null>` | 357 |
| `listCoupons` | function | `async listCoupons(params: { scope?: CouponScope; orgId?: string; status?: str…): Promise<{ coupons: ICoupon[]; total: number }>` | 361 |
| `validateCoupon` | function | `async validateCoupon(params: ValidateCouponParams): Promise<CouponValidationResult>` | 390 |
| `calculateDiscount` | function | `calculateDiscount(coupon: ICoupon, amount: number): { discountAmount: number; finalAmount: number }` | 479 |
| `recordCouponUsage` | function | `async recordCouponUsage(params: RecordUsageParams): Promise<ICouponUsage>` | 503 |
| `markUsageApplied` | function | `async markUsageApplied(usageId: string): Promise<ICouponUsage \| null>` | 527 |
| `markUsageFailed` | function | `async markUsageFailed(usageId: string): Promise<ICouponUsage \| null>` | 547 |
| `getUserUsageCount` | function | `async getUserUsageCount(couponId: string, userId: string): Promise<number>` | 555 |
| `getCouponAnalytics` | function | `async getCouponAnalytics(couponId: string): Promise<{ totalUsage: number; totalDiscountGiven:…` | 568 |

## Interfaces

- **Database (Mongoose models used):**
  - `Channel` (server/models/channel.model.ts) — reads: `findOne`, `find`
  - `Course` (server/models/course.model.ts) — reads: `findOne`, `find`
  - `Workshop` (server/models/workshop.model.ts) — reads: `findOne`, `find`
  - `Product` (server/models/product.model.ts) — reads: `findOne`, `find`
  - `OfficePlan` (server/models/officePlan.model.ts) — reads: `findOne`, `find`
  - `OfficeAddon` (server/models/officeAddon.model.ts) — reads: `findOne`, `find`
  - `EventProgram` (server/models/eventProgram.model.ts) — reads: `findOne`, `find`
  - `Coupon` (server/models/coupon.model.ts) — reads: `findOne`, `findById`, `find`, `countDocuments`; **writes:** `new + save`, `findByIdAndUpdate`
  - `CouponUsage` (server/models/couponUsage.model.ts) — reads: `countDocuments`, `aggregate`; **writes:** `new + save`, `findByIdAndUpdate`

## Dependencies

- **Internal:**
  - `server/models/coupon.model.ts` — `Coupon`, `ICoupon`, `ApplicableItemType`, `CouponScope`
  - `server/models/couponUsage.model.ts` — `CouponUsage`, `ICouponUsage`, `CouponUsageTransactionType`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/course.model.ts` — `Course`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/product.model.ts` — `Product`
  - `server/models/officePlan.model.ts` — `OfficePlan`
  - `server/models/officeAddon.model.ts` — `OfficeAddon`
  - `server/models/eventProgram.model.ts` — `EventProgram`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/channelCheckout.ts`
- `server/routes/couponValidation.ts`
- `server/routes/courseCheckout.ts`
- `server/routes/founderCoupons.ts`
- `server/routes/garageAdminCoupons.ts`
- `server/routes/invoice.ts`
- `server/routes/officeAddonCheckout.ts`
- `server/routes/officeCheckout.ts`
- `server/routes/productCheckout.ts`
- `server/routes/publicEventManagement.ts`
- `server/routes/workshopCheckout.ts`
- `server/services/eventManagement.ts`
