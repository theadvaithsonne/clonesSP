# `server/services/razorpay.ts`

> Module exporting `createOrder`, `verifyPaymentSignature`, `verifyWebhookSignature`, `fetchPayment` and 32 more.

**Kind:** backend service · **Lines:** 1066

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CouponPromotion` | interface |  | 10 |
| `CreateOrderOptions` | interface |  | 19 |
| `RazorpayOrder` | interface |  | 27 |
| `CreatePlanOptions` | interface |  | 42 |
| `RazorpayPlan` | interface |  | 60 |
| `CreateSubscriptionOptions` | interface |  | 86 |
| `CreateCustomerOptions` | interface |  | 100 |
| `RazorpayCustomer` | interface |  | 108 |
| `RazorpaySubscription` | interface |  | 119 |
| `createOrder` | function | `async createOrder(options: CreateOrderOptions): Promise<RazorpayOrder>` — Create a Razorpay order for one-time payment Supports promotions (coupons) for discounts | 159 |
| `verifyPaymentSignature` | function | `verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean` — Verify Razorpay payment signature | 181 |
| `verifyWebhookSignature` | function | `verifyWebhookSignature(body: string, signature: string): boolean` — Verify Razorpay webhook signature | 199 |
| `fetchPayment` | function | `async fetchPayment(paymentId: string): Promise<any>` — Fetch payment details from Razorpay | 215 |
| `fetchOrder` | function | `async fetchOrder(orderId: string): Promise<any>` — Fetch order details from Razorpay | 223 |
| `createChannelSubscriptionOrder` | function | `async createChannelSubscriptionOrder(channelId: string, channelTitle: string, amount: number, userId: string, orgId: string, currency: string = "USD"): Promise<RazorpayOrder>` — Create order for channel subscription | 231 |
| `createPlan` | function | `async createPlan(options: CreatePlanOptions): Promise<RazorpayPlan>` — Create a Razorpay plan for recurring subscriptions Note: For GST to work, you must first configure tax rates in Razorpay Dashboard and pass the tax_id or tax_group_id here | 263 |
| `fetchPlan` | function | `async fetchPlan(planId: string): Promise<RazorpayPlan>` — Fetch a Razorpay plan by ID | 304 |
| `listPlans` | function | `async listPlans(options?: { count?: number; skip?: number; }): Promise<{ items: RazorpayPlan[]; count: number }>` — List all Razorpay plans | 312 |
| `createCustomer` | function | `async createCustomer(options: CreateCustomerOptions): Promise<RazorpayCustomer>` — Create a Razorpay customer Used to link GSTIN to subscriptions for GST invoicing | 326 |
| `fetchCustomer` | function | `async fetchCustomer(customerId: string): Promise<RazorpayCustomer>` — Fetch a Razorpay customer by ID | 349 |
| `updateCustomer` | function | `async updateCustomer(customerId: string, options: Partial<CreateCustomerOptions>): Promise<RazorpayCustomer>` — Update a Razorpay customer (e.g., to add/update GSTIN) | 357 |
| `createSubscription` | function | `async createSubscription(options: CreateSubscriptionOptions): Promise<RazorpaySubscription>` — Create a Razorpay subscription | 370 |
| `fetchSubscription` | function | `async fetchSubscription(subscriptionId: string): Promise<RazorpaySubscription>` — Fetch a Razorpay subscription by ID | 406 |
| `cancelSubscription` | function | `async cancelSubscription(subscriptionId: string, cancelAtCycleEnd: boolean = true): Promise<RazorpaySubscription>` — Cancel a Razorpay subscription | 417 |
| `pauseSubscription` | function | `async pauseSubscription(subscriptionId: string): Promise<RazorpaySubscription>` — Pause a Razorpay subscription Note: Only available for subscriptions with pause_initiated_by set | 432 |
| `resumeSubscription` | function | `async resumeSubscription(subscriptionId: string): Promise<RazorpaySubscription>` — Resume a paused Razorpay subscription | 442 |
| `listSubscriptions` | function | `async listSubscriptions(options?: { plan_id?: string; count?: number; skip?: number…): Promise<{ items: RazorpaySubscription[]; count: n…` — List all subscriptions | 452 |
| `fetchSubscriptionPendingUpdate` | function | `async fetchSubscriptionPendingUpdate(subscriptionId: string): Promise<any>` — Fetch pending updates for a subscription | 464 |
| `cancelSubscriptionPendingUpdate` | function | `async cancelSubscriptionPendingUpdate(subscriptionId: string): Promise<any>` — Cancel pending update for a subscription | 475 |
| `updateSubscription` | function | `async updateSubscription(subscriptionId: string, options: { plan_id?: string; quantity?: number; remaining_c…): Promise<RazorpaySubscription>` — Update a subscription (change plan, quantity, etc.) | 486 |
| `deleteSubscriptionOffer` | function | `async deleteSubscriptionOffer(subscriptionId: string, offerId: string): Promise<any>` — Delete an offer linked to a subscription | 508 |
| `RazorpayInvoice` | interface |  | 521 |
| `fetchInvoice` | function | `async fetchInvoice(invoiceId: string): Promise<RazorpayInvoice>` — Fetch a Razorpay invoice by ID | 578 |
| `listInvoices` | function | `async listInvoices(options?: { subscription_id?: string; type?: string; count?…): Promise<{ items: RazorpayInvoice[]; count: number…` — List invoices with optional filters | 586 |
| `getUnpaidSubscriptionInvoices` | function | `async getUnpaidSubscriptionInvoices(subscriptionId: string): Promise<RazorpayInvoice[]>` — Get all unpaid invoices for a subscription Returns invoices in 'issued', 'partially_paid', or 'expired' status | 600 |
| `getOrCreateRazorpayCustomer` | function | `async getOrCreateRazorpayCustomer(input: { userId: string; email?: string; name?: string; con…): Promise<string>` — Ensure the user has a Razorpay Customer. | 634 |
| `createSaveCardOrder` | function | `async createSaveCardOrder(opts: { amount: number; // paise; use 100 (₹1) for standalo…): Promise<RazorpayOrder>` — Create an Order that will tokenize the card at payment time. | 673 |
| `listCustomerTokens` | function | `async listCustomerTokens(customerId: string): Promise<any[]>` — Read-through to Razorpay's saved-tokens list for the customer. | 701 |
| `listOrderPayments` | function | `async listOrderPayments(orderId: string): Promise<any[]>` — Every payment attempt made against an order. | 716 |
| `fetchCustomerToken` | function | `async fetchCustomerToken(customerId: string, tokenId: string): Promise<any \| null>` — Fetch ONE saved token, which is the only way to learn a UPI mandate's real state. | 734 |
| `mandateStatusFromRecurring` | function | `mandateStatusFromRecurring(recurringStatus: string \| undefined \| null): "active" \| "pending" \| "revoked" \| "paused"` — Map Razorpay's `recurring_details.status` onto the `mandateStatus` we store. | 756 |
| `deleteRazorpayToken` | function | `async deleteRazorpayToken(opts: { customerId: string; tokenId: string; }): Promise<void>` — Remove a saved token from a Razorpay Customer. | 778 |
| `refundPayment` | function | `async refundPayment(opts: { paymentId: string; amount?: number; // paise; omit …): Promise<any>` — Refund a payment in full. | 793 |
| `UPI_MANDATE_MAX_AMOUNT_PAISE` | const | `= 5_000_000` — Cap stamped on new mandates, in paise. | 835 |
| `UPI_MANDATE_YEARS` | const | `= 5` — How long a mandate stays valid before the payer must re-authorise. | 838 |
| `createUpiMandateOrder` | function | `async createUpiMandateOrder(opts: { amount: number; // paise — the first cycle's real c…): Promise<RazorpayOrder>` — Create an Order that registers a UPI Autopay mandate while taking the first real payment. | 848 |
| `RecurringDebitResult` | interface |  | 909 |
| `chargeUpiMandate` | function | `async chargeUpiMandate(opts: { amount: number; // paise currency?: string; custome…): Promise<RecurringDebitResult>` — Debit an existing UPI mandate off-session — the Razorpay counterpart of `chargeSavedPaymentMethod`. | 946 |
| `revokeUpiMandate` | function | `async revokeUpiMandate(opts: { customerId: string; tokenId: string; }): Promise<{ revoked: boolean; alreadyGone: boolean …` — Revoke a UPI mandate. | 999 |
| `razorpay` | export |  | 1065 |

## Interfaces

- **External HTTP calls:**
  - `PUT https://api.razorpay.com/v1/customers/${opts.customerId}/tokens/${opts.tokenId}/cancel` (L1028)
- **Environment variables (`process.env`):** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- **External hosts mentioned in the code:** `api.razorpay.com`

## Dependencies

- **Internal:** none
- **Packages:**
  - `razorpay`
  - `crypto`

## Used by

- `server/routes/call.ts`
- `server/routes/callCheckout.ts`
- `server/routes/channelCheckout.ts`
- `server/routes/course.ts`
- `server/routes/courseCheckout.ts`
- `server/routes/feed.ts`
- `server/routes/garageAdminSavedCards.ts`
- `server/routes/invoice.ts`
- `server/routes/officeAddonCheckout.ts`
- `server/routes/officeCheckout.ts`
- `server/routes/officeSubscriptionAdmin.ts`
- `server/routes/paymentMethods.ts`
- `server/routes/product.ts`
- `server/routes/productCheckout.ts`
- `server/routes/service.ts`
- `server/routes/unilevel-plus.ts`
- `server/routes/webhook.ts`
- `server/routes/workshop.ts`
- `server/routes/workshopCheckout.ts`
- `server/scripts/check-shorupan-payment-profile.ts`
- `server/services/feed.ts`
- `server/services/invoice.ts`
- `server/services/officeAddonSubscription.ts`
- `server/services/officeSubscription.ts`
- `server/services/subscription.ts`
- _…and 1 more_
