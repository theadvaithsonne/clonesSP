# `lib/hooks/useCashbackCodes.ts`

> The client-side data layer for the cashback-code system: types, three list hooks (my codes, my summary, cashback I received) and plain async helpers to look up eligible items and buyers, create, update and activate/deactivate codes, and read a code's distributions.

**Kind:** React hook · **Lines:** 290

## Purpose
Eligible affiliates (per the backend: an activated affiliate with at least one direct referral, or the platform super-admin) can create **cashback codes**. Each code is bound to a single sellable item (product, channel, course, workshop, service, call or e-commerce item) and pays a percentage of a sale back to the buyer, optionally limited to specific buyers, a date window, usage caps and a minimum order. This file wraps the `/cashback-codes` REST API for the Cashback Codes tab and its sheets and pickers.

## How it works
All calls go through `api()` from `lib/api.ts`, which adds the session bearer token and targets `NEXT_PUBLIC_API_URL` (`/backend`).

**Hooks** (each fetches on mount, tracks `loading`, exposes `refresh`):
- `useCashbackCodes()` - `GET /cashback-codes`; returns `{ codes, loading, error, refresh }`, where `error` holds the message ("Failed to load codes" fallback).
- `useCashbackSummary()` - in parallel `GET /cashback-codes/me/summary` and `GET /cashback-codes/me/received?limit=1` (only the latter's `totalReceived` is used). Returns `{ summary, received, loading, refresh }`. On error both are set to zero, because the summary tiles are informational.
- `useReceivedCashback()` - `GET /cashback-codes/me/received?limit=100`; returns `{ rows, totalReceived, loading, refresh }`, or empty values on error.

**Helpers** (throw on error, leaving handling to the caller):
- `fetchEligibleItems(productType, orgId)` - items of that type in that org that a code can be bound to.
- `fetchEligibleBuyers()` - users the creator may restrict a code to.
- `fetchDistributionsForCode(codeId)` - up to 100 payout records plus totals (`completedCount`, `completedAmount`, `skippedCount`, `failedCount`), or `null` totals.
- `createCashbackCode(input)` - `POST`; returns the new code.
- `updateCashbackCode(id, input)` - `PATCH`; the code string, product type and item cannot be changed (they are not in `UpdateCodeInput`).
- `setCashbackCodeStatus(id, status)` - `POST /:id/activate` or `/:id/deactivate`.

## Exports
- Hooks: `useCashbackCodes()`, `useCashbackSummary()`, `useReceivedCashback()`.
- Functions: `fetchEligibleItems(productType, orgId)`, `fetchEligibleBuyers()`, `fetchDistributionsForCode(codeId)`, `createCashbackCode(input)`, `updateCashbackCode(id, input)`, `setCashbackCodeStatus(id, "active" | "inactive")`.
- Types:
  - `CashbackProductType` - `"product" | "channel" | "course" | "workshop" | "service" | "call" | "ecommerce"`.
  - `CashbackCode` - code record: `ratePct`, `allowedBuyerIds`, `cycleCount`, validity dates, usage caps, `currentUsageCount`, `minOrderAmountCents`, status.
  - `EligibleItem` - `{ itemId, productType, orgId, title, price, currency, image? }`.
  - `EligibleBuyer` - `{ _id, name?, email?, profilePicture? }`.
  - `CashbackDistribution` - one payout attempt: invoice line, sale amount, `level1RatePct`/`configuredRatePct`/`appliedRatePct`, `cashbackAmount`, `cycleNumber`, `status` (`completed`/`skipped`/`failed`), `failureReason`.
  - `CashbackSummary` - `{ totalPaidOutUsd, activeCodesCount, totalCodesCount }`.
  - `CreateCodeInput`, `UpdateCodeInput` - request bodies.

## Interfaces
- **Backend endpoints called** (all served by `server/routes/cashbackCodes.ts`, mounted at `/cashback-codes`, `requireAuth`):
  - `GET /backend/cashback-codes` - codes created by the caller.
  - `POST /backend/cashback-codes` - create a code.
  - `PATCH /backend/cashback-codes/:id` - update a code.
  - `POST /backend/cashback-codes/:id/activate`, `POST /backend/cashback-codes/:id/deactivate` - toggle status.
  - `GET /backend/cashback-codes/:id/distributions?limit=100` - payouts for one code.
  - `GET /backend/cashback-codes/me/summary` - creator summary.
  - `GET /backend/cashback-codes/me/received?limit=N` - cashback received by the caller.
  - `GET /backend/cashback-codes/eligible-items?productType=&orgId=` - bindable items.
  - `GET /backend/cashback-codes/eligible-buyers` - restrictable buyers.

## Dependencies
- **Internal:** `lib/api.ts` - `api()` authenticated fetch wrapper.
- **Packages:** `react` - state, effects, callbacks.

## Used by
- `components/dashboard/CashbackCodesTab.tsx`
- `components/dashboard/CashbackCodeSheet.tsx`
- `components/dashboard/CashbackCodeItemPicker.tsx`
- `components/dashboard/CashbackBuyerPicker.tsx`

## Notes
- Money fields mix units: `minOrderAmountCents` and `saleAmountCents` are in cents, `totalPaidOutUsd` is dollars, and `cashbackAmount` has no unit in its name. Check the backend service (`server/services/cashbackCode`) before doing arithmetic on them.
- The backend header notes that the same routes are also called by the external Garage e-commerce platform using the user's Garage JWT.
