# `components/admin/AdminSavedCardsPanel.tsx`

> Super-admin panel listing a user's saved Stripe cards and Razorpay UPI Autopay mandates, with dialogs to set a default card, delete, charge for a product, start a subscription or bill a Garage product, make an ad-hoc charge, refund, send an add-card link and debit a UPI mandate.

**Kind:** React component · **Lines:** 2070

## Purpose
Garage stores customers' payment instruments (Stripe payment methods, and Razorpay UPI tokens with recurring mandates) so the team can bill them without the customer re-entering details. This panel is the admin's control surface for those instruments, rendered inside the "Saved Cards" tab of the garage-admin member profile. Every action calls a `/garage-admin/...` endpoint served by `server/routes/garageAdminSavedCards.ts`, which is mounted at `/garage-admin` and guarded by `requireGarageAdminAuth` and `requireGarageSuperAdmin`. The UI only surfaces the buttons; the backend is the real gatekeeper. The file is organised as one exported panel plus private row and dialog components.

## How it works

### Shared helpers (L59-L96)
- Tailwind class constants for the Radix `Select` trigger, content and items. Radix forbids `""` as a `SelectItem` value, so "nothing picked" is an empty value on the parent `Select`.
- `CARD_QK(userId)` = `["admin-saved-cards", userId]`, the React Query key that every mutation invalidates.
- `formatAmount(smallest, currency)` - formats minor units (cents or paise) with `Intl.NumberFormat`.
- `formatDate(iso)` - "Mon D, YYYY".

### `AdminSavedCardsPanel` (L102-L300)
- `useQuery` -> `fetchAdminSavedCards(userId)`. Cards come from `data.stripe.methods`. Mandates come from `data.razorpay.mandates`, defaulting to `[]` because older backends omit `razorpay`.
- Shows a loading state and an error state.
- Header: card count and a "Send add-card link" button.
- Renders a `CardRow` per card (or an empty state), then a "UPI Autopay" section with an `UpiMandateRow` per mandate, shown only when mandates exist.
- `handleSetDefault(pmId)` -> `setAdminDefaultCard`. `handleDelete(pmId, last4)` asks for `confirm()` and then calls `deleteAdminCard` (this detaches the card from Stripe). Both track `busyPmId` and invalidate the cards query.
- Holds one piece of state per open dialog (`chargeCard`, `subscribeCard`, `adhocCard`, `refundCard`, `addLinkOpen`, `upiMandate`) and mounts the matching dialog.

### `CardRow` (L306-L431)
Shows brand, `•••• last4`, expiry, a Default badge, country and the date added. For Indian (`country === "IN"`) cards it shows either "MIT ready (cap ₹x)", when `mandateStatus === "active"` and a `mandateId` exists, or "OTP required (no mandate)". Buttons: Set default (hidden if already default), Charge, Subscribe, Adhoc, Refund, Delete.

### MIT/CIT preview logic (repeated in three dialogs)
Each charge dialog shows a client-side preview of how the charge will be authorised. Comments say this mirrors `services/paymentGating.ts::resolveSavedCardChargeMode`, and the server remains authoritative:
- Non-INR: off-session, no OTP.
- INR on a non-Indian card: off-session.
- INR on an Indian card with an active mandate whose `mandateAmount` is at least the amount: MIT (merchant-initiated), no OTP.
- Otherwise: CIT. The buyer must complete an OTP and the server returns an invoice URL. In the subscribe dialog this case is **blocked** instead, because every renewal would need an OTP.

### `ChargeOnCardDialog` - charge for an org product (L437-L686)
- Loads the user's orgs with `fetchMemberTab<MemberOffice>({ category: "offices", limit: 200 })`, then that org's products with `fetchAdminOrgProducts(orgId)`.
- Pick org, then product. The preview shows amount and mode.
- Submit: `chargeAdminSavedCard(userId, pmId, { orgId, productId })`.
  - `succeeded` / `processing`: toast with the invoice number, close, refresh.
  - `requires_action`: the dialog swaps to an amber "Buyer OTP required" panel showing `invoiceUrl` to share.
  - Anything else: error toast.

### `SubscribeOnCardDialog` - "Bill this card" (L700-L1251)
Two catalogue tabs:
- **Garage products** (default): `fetchPlatformBillableItems(userId)` returns platform items such as Unilevel Plus, NetworkChain and Office Pro (per the comment), each with `kind` (`one_time` or `recurring`), `eligible`, `reason`, optional `terms` (NetworkChain's 1/3/6/12-month terms), optional `orgs`, and `requiresCombo` / `comboPrice`. When `requiresCombo` is set the licence is sold with it: the price charged today is `comboPrice - price + termPrice`. An `office_plan` item needs an org picked (`needsOrg`). Submit calls `billPlatformItem(userId, pmId, { itemType, orgId?, termMonths?, freeCycles? })`.
- **Office items**: the original flow. Pick an org, then a subscribable product or community (`fetchAdminSubscribableItems(orgId)`; items keyed `itemType:_id`). Submit calls `startAdminSubscription(userId, pmId, { orgId, itemType, itemId })`.
- **Billing starts** (recurring only): "Charge now" or "First cycle free". First cycle free sends `freeCycles: 1`, and today's charge shows as "Nothing". The free-cycle option is passed only on the Garage-products path.
- `pricing` computes today's charge, the per-cycle price and the period (`periodLabel` maps weekly, monthly, quarterly and yearly to week, month, quarter and year).
- `canSubmit` is false when the preview is `block`, or when required picks are missing or the platform item is not `eligible`.
- Results are handled like the charge dialog. A `freeCycle` flag in the response changes the success toast.
- UI note: renewals are charged by a daily cron on whichever card is the user's default at renewal time, not necessarily this one.

### `AdhocChargeDialog` - custom amount (L1260-L1538)
- Org (needed for the invoice ledger and audit), amount, currency (`USD` / `INR`), and a description of at most 200 characters that is shown to the buyer and kept in the audit trail.
- Not tied to a product, so it grants nothing; it only takes payment.
- Submit: `chargeAdminAdhoc(userId, pmId, { orgId, amount, currency, description })`. The amount is sent in major units; the preview converts to minor units for the mandate comparison. Results are handled like the charge dialog.

### `RefundFromCardDialog` (L1540-L1656)
- `fetchAdminRefundableCharges(userId, pmId)` lists the user's recent Stripe-paid invoices. Rows charged on this card (`matchedPm`) get a "This card" badge.
- Refund asks for `confirm()` and then calls `refundAdminCharge(userId, paymentIntentId)`. The toast shows the refund status and the list is refetched. This is a full refund of the payment intent; there is no partial amount input.

### `Overlay` (L1662-L1679)
A hand-rolled fixed backdrop (z-index 9999) that closes on backdrop click. Radix is not used here: "we don't need Radix for a super-admin tool".

### `AddCardLinkDialog` (L1688-L1849)
`createAdminAddCardLink(userId)` mints a one-time save-card link (the UI says it expires in 24 hours, charges nothing, and bundles an RBI mandate for Indian cards). The customer opens it on their own device and enters the card in Stripe Elements, so the card number never reaches Garage's servers or the admin's browser (PCI SAQ A boundary). The dialog shows the recipient, expiry and URL, with Copy and "Generate another" buttons.

### `UpiMandateRow` (L1853-L1932)
Shows the VPA, a status pill (`active` green, `pending` amber, others grey), Default, the per-debit cap in rupees (`maxAmount` is in paise) and the expiry. When `chargeable` is false the Charge button is disabled and a reason is shown: expired, pending approval in the UPI app, or otherwise not chargeable.

### `UpiChargeDialog` (L1936-L2069)
- Fields: **free-text Organisation ID** (an ObjectId, not a picker), amount, currency (defaults to INR), description.
- `overCap` blocks INR amounts above the mandate cap. For USD the check is skipped on the client because FX is applied and re-checked on the server.
- The UI notes that above ₹15,000 the customer must approve in their UPI app, so settlement is delayed.
- Submit: `chargeAdminUpiMandate(userId, mandateId, { orgId, amount, currency, description })`. A failure (`!success` or `status === "failed"`) shows an error. A pending result is treated as success and shows the server's `note`.

## Exports
- `AdminSavedCardsPanel({ userId }: { userId: string })` - the tab body. Everything else is module-private.

## Interfaces
- **Backend endpoints called** (all via `garageAdminApi`, which sends the admin token from `localStorage` `garage_admin_token`):
  - `GET /backend/garage-admin/users/:userId/saved-cards` - cards and mandates.
  - `PATCH /backend/garage-admin/users/:userId/saved-cards/:pmId/default` - set default card.
  - `DELETE /backend/garage-admin/users/:userId/saved-cards/:pmId` - detach card.
  - `GET /backend/garage-admin/orgs/:orgId/products` - products to charge for.
  - `POST /backend/garage-admin/users/:userId/saved-cards/:pmId/charge` - charge for a product.
  - `GET /backend/garage-admin/users/:userId/saved-cards/:pmId/refundable-charges` - refundable invoices.
  - `POST /backend/garage-admin/users/:userId/saved-cards/refund` - body `{ paymentIntentId }`.
  - `GET /backend/garage-admin/orgs/:orgId/subscribable-items` - recurring products and communities.
  - `POST /backend/garage-admin/users/:userId/saved-cards/:pmId/start-subscription` - office-item subscription.
  - `GET /backend/garage-admin/users/:userId/billable-platform-items` - Garage's own products.
  - `POST /backend/garage-admin/users/:userId/saved-cards/:pmId/bill-platform-item` - bill a Garage product.
  - `POST /backend/garage-admin/users/:userId/saved-cards/:pmId/charge-adhoc` - custom amount.
  - `POST /backend/garage-admin/users/:userId/saved-cards/create-add-link` - mint a save-card link.
  - `POST /backend/garage-admin/users/:userId/upi-mandates/:tokenId/charge-adhoc` - debit a UPI mandate.
  - `GET /backend/affiliate/downline/:userId/purchases?category=offices&page=1&limit=200` (via `fetchMemberTab`) - the user's org memberships, served by `server/routes/downlineProfile.ts`.
- **External services:** Stripe (cards, payment intents, invoices, refunds) and Razorpay (UPI Autopay), both reached only through the backend.

## Dependencies
- **Internal:** `lib/admin-api/saved-cards.ts` - every saved-card and mandate API wrapper and type.
- **Internal:** `lib/affiliate/downline-profile-api.ts` - `fetchMemberTab`, `MemberOffice`.
- **Internal:** `components/ui/select.tsx` - Radix Select wrappers.
- **Packages:** `@tanstack/react-query` (queries and invalidation), `sonner` (toasts), `lucide-react` (icons), `react`.

## Used by
- `components/garage-admin/member-profile-view.tsx`, the "Saved Cards" tab of the garage-admin member profile. The file's header comment places this at `/garage-admin/one-time-affiliates/[userId]`.

## Notes
- **Real money:** every dialog moves funds or changes billing. Delete and refund use a browser `confirm()`; charges and subscriptions have no confirmation beyond the submit button.
- The MIT/CIT preview is duplicated three times and must be kept in step with the backend's `resolveSavedCardChargeMode`; when they disagree, the server wins.
- `UpiChargeDialog` takes a raw org ObjectId instead of using the office picker the card dialogs use. It also uses its own fixed overlay rather than `Overlay`, so it does not close on a backdrop click.
- An empty "Refund dialog" section banner (around L688-L691) sits above the subscribe dialog; the refund dialog itself is further down. This is leftover structure, not missing code.
- Comments describe charge results as either `requires_action` (with an invoice URL) or success; nothing is activated until the buyer authenticates.
