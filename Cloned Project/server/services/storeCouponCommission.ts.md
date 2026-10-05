# `server/services/storeCouponCommission.ts`

> Module exporting `isUnlimitedCoupon`, `createStoreCommission`, `listStoreCommissions`, `getStoreCommission` and 5 more.

**Kind:** backend service · **Lines:** 466

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `StoreCommissionLevelInput` | interface |  | 16 |
| `CreateStoreCommissionInput` | interface |  | 22 |
| `UpdateStoreCommissionInput` | interface |  | 34 |
| `isUnlimitedCoupon` | function | `isUnlimitedCoupon(c: { maxUsageCount?: number \| null; maxUsagePerUser?: numbe…): boolean` — True when a PlatformCoupon is "unlimited" — safe to hand out to many uplines across many sales. | 50 |
| `createStoreCommission` | function | `async createStoreCommission(input: CreateStoreCommissionInput): Promise<IStoreCouponCommission>` | 113 |
| `listStoreCommissions` | function | `async listStoreCommissions(orgId: string): Promise<IStoreCouponCommission[]>` | 149 |
| `getStoreCommission` | function | `async getStoreCommission(id: string, orgId: string): Promise<IStoreCouponCommission \| null>` | 159 |
| `updateStoreCommission` | function | `async updateStoreCommission(id: string, orgId: string, input: UpdateStoreCommissionInput): Promise<IStoreCouponCommission \| null>` | 169 |
| `deleteStoreCommission` | function | `async deleteStoreCommission(id: string, orgId: string): Promise<boolean>` | 215 |
| `listAvailableUnlimitedCoupons` | function | `async listAvailableUnlimitedCoupons(orgId: string)` — The picker in the founder editor. | 235 |
| `listOrgStoreProducts` | function | `async listOrgStoreProducts(orgId: string)` — Trigger picker: the org's active store products. | 264 |
| `evaluateStoreCommissionsForInvoice` | function | `async evaluateStoreCommissionsForInvoice(invoice: IInvoice): Promise<void>` — Fires cascading coupon grants on a newly-paid `ecommerce_item` invoice. | 291 |

## Interfaces

- **Database (Mongoose models used):**
  - `PlatformCoupon` (server/models/platformCoupon.model.ts) — reads: `find`, `findById`
  - `StoreProduct` (server/models/storeProduct.model.ts) — reads: `findOne`, `find`
  - `StoreCouponCommission` (server/models/storeCouponCommission.model.ts) — reads: `find`, `findOne`; **writes:** `create`, `deleteOne`
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `StoreCouponCommissionFire` (server/models/storeCouponCommissionFire.model.ts) — reads: `countDocuments`; **writes:** `create`
  - `Invoice` (server/models/invoice.model.ts) — **writes:** `updateOne`

## Dependencies

- **Internal:**
  - `server/models/storeCouponCommission.model.ts` — `StoreCouponCommission`, `IStoreCouponCommission`, `MAX_STORE_COMMISSION_LEVELS`
  - `server/models/platformCoupon.model.ts` — `PlatformCoupon`
  - `server/models/storeProduct.model.ts` — `StoreProduct`
  - `server/models/user.model.ts` — `User`
  - `server/models/invoice.model.ts` — `Invoice`, `IInvoice`
  - `server/models/storeCouponCommissionFire.model.ts` — `StoreCouponCommissionFire`
  - `server/services/couponAssignment.ts` — `assignCoupon`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/founderStoreCommissions.ts`
- `server/services/invoice.ts`
