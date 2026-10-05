# `server/services/couponRule.ts`

> Module exporting `createCouponRule`, `listCouponRules`, `getCouponRule`, `updateCouponRule` and 2 more.

**Kind:** backend service · **Lines:** 472

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CreateCouponRuleInput` | interface |  | 154 |
| `createCouponRule` | function | `async createCouponRule(input: CreateCouponRuleInput): Promise<ICouponRule>` | 170 |
| `listCouponRules` | function | `async listCouponRules(orgId: string \| null): Promise<ICouponRule[]>` — List rules. When `orgId` is provided, returns rules for that org; otherwise returns platform-scope rules (admin view). | 255 |
| `getCouponRule` | function | `async getCouponRule(id: string, orgId: string \| null): Promise<ICouponRule \| null>` | 267 |
| `UpdateCouponRuleInput` | interface |  | 280 |
| `updateCouponRule` | function | `async updateCouponRule(id: string, orgId: string \| null, patch: UpdateCouponRuleInput): Promise<ICouponRule \| null>` | 288 |
| `deleteCouponRule` | function | `async deleteCouponRule(id: string, orgId: string \| null): Promise<boolean>` | 323 |
| `evaluateRulesForInvoice` | function | `async evaluateRulesForInvoice(invoice: IInvoice): Promise<void>` — For each line item in the freshly-paid invoice, find active rules whose trigger matches that item, increment the user's progress, and grant new rule fires when thresholds are crossed. | 352 |

## Interfaces

- **Database (Mongoose models used):**
  - `Channel` (server/models/channel.model.ts) — reads: `findOne`
  - `Course` (server/models/course.model.ts) — reads: `findOne`
  - `Workshop` (server/models/workshop.model.ts) — reads: `findOne`
  - `Product` (server/models/product.model.ts) — reads: `findOne`
  - `Service` (server/models/service.model.ts) — reads: `findOne`
  - `CallOffering` (server/models/callOffering.model.ts) — reads: `findOne`
  - `OfficePlan` (server/models/officePlan.model.ts) — reads: `findById`
  - `UnilevelPlusPlan` (server/models/unilevelPlusPlan.model.ts) — reads: `findById`
  - `ThirdPartyClient` (server/models/thirdPartyClient.model.ts) — reads: `findById`
  - `PlatformCoupon` (server/models/platformCoupon.model.ts) — reads: `findById`
  - `CouponRule` (server/models/couponRule.model.ts) — reads: `find`, `findOne`; **writes:** `create`, `findOneAndDelete`
  - `CouponRuleProgress` (server/models/couponRuleProgress.model.ts) — reads: `exists`; **writes:** `deleteMany`, `findOneAndUpdate`

## Dependencies

- **Internal:**
  - `server/models/couponRule.model.ts` — `CouponRule`, `ICouponRule`, `CouponRuleProductType`, `CouponRuleRecurrence`, `CouponRuleScope`
  - `server/models/couponRuleProgress.model.ts` — `CouponRuleProgress`
  - `server/models/platformCoupon.model.ts` — `PlatformCoupon`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/course.model.ts` — `Course`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/product.model.ts` — `Product`
  - `server/models/service.model.ts` — `Service`
  - `server/models/callOffering.model.ts` — `CallOffering`
  - `server/models/officePlan.model.ts` — `OfficePlan`
  - `server/models/unilevelPlusPlan.model.ts` — `UnilevelPlusPlan`
  - `server/models/thirdPartyClient.model.ts` — `ThirdPartyClient`
  - `server/services/couponAssignment.ts` — `assignCoupon`
  - `server/models/invoice.model.ts` — `IInvoice`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/adminCouponRules.ts`
- `server/routes/founderCouponRules.ts`
- `server/services/invoice.ts`
