# `lib/admin-api/saved-cards.ts`

> Garage-admin client for charging a member's saved payment methods: list and manage Stripe cards and Razorpay UPI Autopay mandates, then use them to charge, refund, start subscriptions, make ad-hoc charges, bill platform products, or send an add-card link.

**Kind:** frontend library · **Lines:** 395

## Purpose
This module backs the "Saved Cards" panel on the admin affiliate detail page (the source comment names `/garage-admin/one-time-affiliates/[userId]`). With it, a super admin can bill a member on file without the member being present: charge for an org product or subscription, charge any amount, or bill one of Garage's own products (Unilevel Plus, NetworkChain, Office Pro). The backend (`server/routes/garageAdminSavedCards.ts`) runs the Stripe and Razorpay calls and writes invoices. This file is only typed wrappers around `garageAdminApi`, and each one returns the response body unchanged.

## How it works
### Listing and managing methods (L1-L78)
- `fetchAdminSavedCards(userId)` returns:
  - `stripe { customerId, methods[] }`: each `AdminSavedStripeMethod` has a `pm_…` id, brand, last4, expiry, country, RBI mandate id/amount/status, `isDefault` and `addedAt`;
  - optionally `razorpay { customerId, mandates[] }`. Treat a missing `razorpay` as "no mandates" (older backends). Each `AdminUpiMandate` has a `token_…` id, `vpa`, mandate status (`active | pending | paused | revoked`), `maxAmount` and expiry. `chargeable` is true only when the mandate is active and unexpired.
- `setAdminDefaultCard` and `deleteAdminCard` change the Stripe payment methods.

### Org products and one-off charge (L80-L130)
- `fetchAdminOrgProducts(orgId)` - the org's products, priced in the smallest unit (paise or cents).
- `chargeAdminSavedCard(userId, pmId, { orgId, productId })` charges for one product and returns an `AdminChargeResponse`. Its `status` is `succeeded | processing | requires_action | failed`, alongside the payment intent, invoice ids/URL, an optional `clientSecret` (for 3DS) and `note`/`error`.

### Refunds (L132-L172)
- `fetchAdminRefundableCharges(userId, pmId)` lists paid invoices with Stripe payment intents. `matchedPm` marks charges made on that exact payment method.
- `refundAdminCharge(userId, paymentIntentId)` issues the refund and returns the Stripe refund summary plus the `invoiceId`.

### Org subscriptions (L174-L239)
- `fetchAdminSubscribableItems(orgId)` lists the org's recurring products and channels (`weekly | monthly | quarterly | yearly`).
- `startAdminSubscription(userId, pmId, { orgId, itemType, itemId })` charges the first cycle and returns the subscription: invoice, period, `amountPerCycle`, `nextDueDate`, and `chargeMode`.

### Ad-hoc charge (L241-L275)
`chargeAdminAdhoc(userId, pmId, { orgId, amount, currency: "USD" | "INR", description })` charges any amount. `amount` is in **whole units** (for example 12.50), unlike the smallest-unit prices elsewhere in this file.

### Add-card link (L277-L308)
`createAdminAddCardLink(userId)` creates a link (`url`, `token`, `expiresAt`, `setupIntentId`, recipient) that the admin sends to the member. The member opens it on their own device, enters a card with Stripe Elements and confirms the RBI mandate. The existing `setup_intent.succeeded` webhook then saves the payment method on their user record. No charge is made. Indian cards saved this way can afterwards be charged by an admin without an OTP.

### UPI Autopay charge (L310-L344)
`chargeAdminUpiMandate(userId, tokenId, { orgId, amount, currency, description })` debits a Razorpay mandate. The returned `status` can be `succeeded`, `pending` or `failed`. **`pending` is not a failure:** above the RBI threshold for debits without extra authentication, the customer must approve the debit in their UPI app, and it settles later through a webhook. Show the returned `note` rather than writing your own message. The mandate's `maxAmount` is a per-debit limit in paise, sized to the plan the mandate was registered for, so it decides whether a given amount can be charged at all.

### Garage platform products (L346-L394)
These are Garage's own products, not an org's.
- `fetchPlatformBillableItems(userId)` lists `PlatformBillableItem`s:
  - `itemType` is `unilevel_plus`, `third_party` or `office_plan`;
  - `kind` is `one_time` or `recurring`; the UI hides the free-cycle control for `one_time` items, because a $0 licence is a comp;
  - also returned: price, optional `terms` (term months with prices), eligible `orgs`, `eligible`/`reason`, and `requiresCombo`/`comboPrice`. NetworkChain needs a licence, so a member without one is sold both together.
- `billPlatformItem(userId, pmId, { itemType, orgId?, termMonths?, freeCycles? })` bills it. The response is `AdminSubscriptionResponse` plus an optional `freeCycle` flag.

## Exports
- Types:
  - methods: `AdminSavedStripeMethod`, `AdminUpiMandate`, `AdminSavedCardsResponse`
  - products and charges: `AdminOrgProduct`, `AdminChargeStatus`, `AdminChargeResponse`, `AdminRefundableCharge`
  - subscriptions: `SubscriptionPeriod`, `AdminSubscribableItem`, `AdminSubscriptionResponse`
  - other responses: `AdminAdhocChargeResponse`, `AdminAddCardLinkResponse`, `AdminUpiChargeResponse`, `PlatformBillableItem`
- Functions:
  - methods: `fetchAdminSavedCards`, `setAdminDefaultCard`, `deleteAdminCard`
  - products and charges: `fetchAdminOrgProducts`, `chargeAdminSavedCard`
  - refunds: `fetchAdminRefundableCharges`, `refundAdminCharge`
  - subscriptions: `fetchAdminSubscribableItems`, `startAdminSubscription`
  - other: `chargeAdminAdhoc`, `createAdminAddCardLink`, `chargeAdminUpiMandate`, `fetchPlatformBillableItems`, `billPlatformItem`

## Interfaces
- **Backend endpoints called** (`server/routes/garageAdminSavedCards.ts`, mounted at `/garage-admin`; the router applies `requireGarageAdminAuth` and `requireGarageSuperAdmin` to every request):
  - Payment methods:
    - `GET /backend/garage-admin/users/:userId/saved-cards` - list cards and mandates
    - `PATCH /backend/garage-admin/users/:userId/saved-cards/:pmId/default` - set default card
    - `DELETE /backend/garage-admin/users/:userId/saved-cards/:pmId` - delete card
    - `POST /backend/garage-admin/users/:userId/saved-cards/create-add-link` - add-card link
  - Charges and refunds:
    - `GET /backend/garage-admin/orgs/:orgId/products` - org products
    - `POST /backend/garage-admin/users/:userId/saved-cards/:pmId/charge` - charge for a product
    - `GET /backend/garage-admin/users/:userId/saved-cards/:pmId/refundable-charges` - refundable charges
    - `POST /backend/garage-admin/users/:userId/saved-cards/refund` - refund
    - `POST /backend/garage-admin/users/:userId/saved-cards/:pmId/charge-adhoc` - ad-hoc card charge
    - `POST /backend/garage-admin/users/:userId/upi-mandates/:tokenId/charge-adhoc` - UPI mandate debit
  - Subscriptions and platform products:
    - `GET /backend/garage-admin/orgs/:orgId/subscribable-items` - org recurring items
    - `POST /backend/garage-admin/users/:userId/saved-cards/:pmId/start-subscription` - start subscription
    - `GET /backend/garage-admin/users/:userId/billable-platform-items` - platform products
    - `POST /backend/garage-admin/users/:userId/saved-cards/:pmId/bill-platform-item` - bill platform product
- **External services (through the backend):** Stripe (payment methods, payment intents, refunds, setup intents and their webhook) and Razorpay (UPI Autopay mandates).

## Dependencies
- **Internal:** `lib/api.ts` - `garageAdminApi`.

## Used by
- `components/admin/AdminSavedCardsPanel.tsx`

## Notes
- These calls move real money. A `processing`, `requires_action` or `pending` result means "not settled yet", not success.
- Mind the units: product and subscription prices and UPI `maxAmount` are in the smallest unit, while ad-hoc `amount` is in whole units.
- Backend detail worth knowing: `garageAdminSavedCards.ts` applies its super-admin guard with router-level `router.use(...)` on the bare `/garage-admin` mount. Express runs router-level middleware for every request that enters the router, so any `/garage-admin/*` request that reaches it unhandled is subject to the super-admin check. The Ignite-call router's header comment warns against this pattern.
