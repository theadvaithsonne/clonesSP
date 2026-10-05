# `server/services/platformCoupon.ts`

> Module exporting `createPlatformCoupon`, `updatePlatformCoupon`, `deactivatePlatformCoupon`, `activatePlatformCoupon` and 11 more.

**Kind:** backend service · **Lines:** 594

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CreatePlatformCouponInput` | interface |  | 16 |
| `createPlatformCoupon` | function | `async createPlatformCoupon(input: CreatePlatformCouponInput): Promise<IPlatformCoupon>` | 39 |
| `UpdatePlatformCouponInput` | interface |  | 76 |
| `updatePlatformCoupon` | function | `async updatePlatformCoupon(id: string, patch: UpdatePlatformCouponInput): Promise<IPlatformCoupon \| null>` | 91 |
| `deactivatePlatformCoupon` | function | `async deactivatePlatformCoupon(id: string): Promise<IPlatformCoupon \| null>` | 136 |
| `activatePlatformCoupon` | function | `async activatePlatformCoupon(id: string): Promise<IPlatformCoupon \| null>` | 142 |
| `listPlatformCoupons` | function | `async listPlatformCoupons(options: { productType?: PlatformCouponProductType; status?…): Promise<{ coupons: IPlatformCoupon[]; total: numb…` | 148 |
| `getPlatformCouponByCode` | function | `async getPlatformCouponByCode(code: string): Promise<IPlatformCoupon \| null>` | 170 |
| `getPlatformCouponById` | function | `async getPlatformCouponById(id: string): Promise<IPlatformCoupon \| null>` | 176 |
| `calculateDiscount` | function | `async calculateDiscount(coupon: Pick< IPlatformCoupon, "discountType" \| "discountVa…, amountCents: number, invoiceCurrency: string = "USD"): Promise<{ discount: number; finalAmount: number …` | 211 |
| `ValidatePlatformCouponInput` | interface |  | 261 |
| `PlatformCouponValidationResult` | interface |  | 274 |
| `validatePlatformCoupon` | function | `async validatePlatformCoupon(input: ValidatePlatformCouponInput): Promise<PlatformCouponValidationResult>` | 283 |
| `redemptionScopeFor` | function | `redemptionScopeFor(coupon: Pick<IPlatformCoupon, "cycleCount">, invoice: { _id: any; isRecurring?: boolean; parentInvoiceId…): { parentInvoiceId: string } \| { invoiceId: string…` — Where a redemption must be filed so the right code can find it again. | 449 |
| `RedeemPlatformCouponInput` | interface |  | 476 |
| `redeemPlatformCoupon` | function | `async redeemPlatformCoupon(input: RedeemPlatformCouponInput): Promise<IPlatformCouponRedemption>` | 484 |
| `getRedemptionForParent` | function | `async getRedemptionForParent(parentInvoiceId: string \| Types.ObjectId): Promise<IPlatformCouponRedemption \| null>` | 532 |
| `getRedemptionForInvoice` | function | `async getRedemptionForInvoice(invoiceId: string \| Types.ObjectId): Promise<IPlatformCouponRedemption \| null>` | 544 |
| `applyRedemptionToChild` | function | `async applyRedemptionToChild(redemption: IPlatformCouponRedemption, subtotalCents: number, invoiceCurrency: string = "USD"): Promise<{ discount: number; totalAmount: number }>` — Apply a redemption snapshot to a child invoice's subtotal. | 558 |
| `listRedemptionsForCoupon` | function | `async listRedemptionsForCoupon(couponId: string): Promise<any[]>` | 576 |

## Interfaces

- **Database (Mongoose models used):**
  - `PlatformCoupon` (server/models/platformCoupon.model.ts) — reads: `findOne`, `findById`, `find`, `countDocuments`; **writes:** `create`, `findByIdAndUpdate`, `updateOne`
  - `PlatformCouponRedemption` (server/models/platformCouponRedemption.model.ts) — reads: `countDocuments`, `findOne`, `find`; **writes:** `findOneAndUpdate`

## Dependencies

- **Internal:**
  - `server/models/platformCoupon.model.ts` — `PlatformCoupon`, `IPlatformCoupon`, `PlatformCouponProductType`, `PlatformCouponDiscountType`, `PlatformCouponScope`
  - `server/models/platformCouponRedemption.model.ts` — `PlatformCouponRedemption`, `IPlatformCouponRedemption`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/founderPlatformCoupons.ts`
- `server/routes/invoice.ts`
- `server/routes/platformCouponValidation.ts`
- `server/routes/platformCoupons.ts`
- `server/routes/unilevel-plus.ts`
- `server/services/__tests__/redemptionScope.test.ts`
- `server/services/cashbackCode.ts`
- `server/services/ecommerceInvoice.ts`
- `server/services/invoice.ts`
- `server/utils/couponRouting.ts`
