# `server/services/invoice.ts`

> Module exporting `couponBaseCents`, `createInvoice`, `selectPaymentMethod`, `verifyAndCompletePayment` and 16 more.

**Kind:** backend service · **Lines:** 7458

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `couponBaseCents` | function | `couponBaseCents(itemType: string \| undefined, subtotalCents: number): number` — Discount BASE for a platform coupon, in the invoice's smallest unit. | 57 |
| `CreateInvoiceOptions` | interface |  | 69 |
| `SelectPaymentOptions` | interface |  | 122 |
| `SelectPaymentResult` | interface |  | 163 |
| `VerifyPaymentOptions` | interface |  | 211 |
| `PaymentOptionsResult` | interface |  | 217 |
| `createInvoice` | function | `async createInvoice(options: CreateInvoiceOptions): Promise<IInvoice>` — Create a new invoice in "draft" status. | 242 |
| `selectPaymentMethod` | function | `async selectPaymentMethod(invoiceId: string, options: SelectPaymentOptions): Promise<SelectPaymentResult>` — User selects currency + payment method. | 818 |
| `verifyAndCompletePayment` | function | `async verifyAndCompletePayment(invoiceId: string, options: VerifyPaymentOptions): Promise<IInvoice>` — Verify Razorpay payment signature and mark invoice as paid. | 1587 |
| `CryptoPaymentInFlightError` | class | `extends Error` — Cancel an unpaid invoice. | 1652 |
| `cancelInvoice` | function | `async cancelInvoice(invoiceId: string, options: { force?: boolean } = {}): Promise<IInvoice>` | 1660 |
| `cancelSubscription` | function | `async cancelSubscription(parentInvoiceId: string, userId: string): Promise<IInvoice>` — Cancel a recurring subscription at the end of the current billing period. | 1726 |
| `renewSubscription` | function | `async renewSubscription(parentInvoiceId: string, userId: string): Promise<{ parent: IInvoice; child: IInvoice \| nul…` — Renew (reactivate) a recurring subscription IN PLACE — reusing the existing parent invoice so the subscription's identity, price and child history stay continuous. | 1869 |
| `createRecurringInvoice` | function | `async createRecurringInvoice(parentInvoiceId: string, paymentData: { razorpayPaymentId: string; razorpaySubscript…): Promise<IInvoice>` — Create a recurring invoice record when a subscription webhook fires. | 1953 |
| `getPaymentOptions` | function | `getPaymentOptions(opts: { isIndia: boolean; }): PaymentOptionsResult` — Get available payment options based on the buyer's region + platform config. | 2026 |
| `expireStaleInvoices` | function | `async expireStaleInvoices(): Promise<number>` — Expire stale invoices that have been in draft or pending status for too long. | 2161 |
| `getInvoice` | function | `async getInvoice(idOrNumber: string): Promise<IInvoice \| null>` — Fetch an invoice by either its MongoDB _id or its invoiceNumber (e.g., INV-MNIQ04RQ-0EAY). | 2185 |
| `listUserInvoices` | function | `async listUserInvoices(userId: string, options?: { organizationId?: string; status?: string; invoi…): Promise<{ invoices: IInvoice[]; total: number }>` — List invoices for a user within an organization. | 2198 |
| `getUpcomingInvoices` | function | `async getUpcomingInvoices(userId: string, organizationId?: string): Promise<IInvoice[]>` — Get upcoming/pending invoices for a user. | 2237 |
| `addMonthsClamped` | export |  | 2351 |
| `getNextChargeDate` | function | `getNextChargeDate(lastPaidAt: Date, period: string, intervalMonths?: number): Date` — Calculate the next charge date based on the last payment date and period. | 2365 |
| `intervalMonthsFor` | function | `intervalMonthsFor(inv: { recurringIntervalMonths?: number; recurringPeriod?: …): number` — How many months one billing cycle of this invoice covers. | 2406 |
| `periodLabelFor` | function | `periodLabelFor(termMonths: number): "monthly" \| "quarterly" \| "yearly"` — Best-fit `recurringPeriod` label for a term length. | 2429 |
| `fulfillInvoice` | function | `async fulfillInvoice(invoice: any, razorpayPaymentId: string): Promise<any>` — Fulfill an invoice based on item type. | 2444 |
| `generateNextChildInvoice` | function | `async generateNextChildInvoice(parent: IInvoice): Promise<IInvoice \| null>` — Generate the next child invoice for a single recurring parent. | 5920 |
| `generateDueRecurringInvoices` | function | `async generateDueRecurringInvoices(): Promise<number>` | 6260 |
| `autoChargeRecurringInvoices` | function | `async autoChargeRecurringInvoices(): Promise<AutoChargeStats>` | 6346 |

## Interfaces

- **Socket.IO events:**
  - emits: `invoice:pending`
- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findOne`, `findById`, `countDocuments`, `find`; **writes:** `create`, `updateOne`, `updateMany`, `findByIdAndUpdate`, `findOneAndUpdate`
  - `ChannelMembership` (server/models/channelMembership.model.ts) — **writes:** `findOneAndUpdate`
- **Environment variables (`process.env`):** `STRIPE_PUBLISHABLE_KEY`, `RAZORPAY_KEY_ID`, `FRONTEND_URL`
- **Timers / queues:** `setTimeout` at L7126
- **External hosts mentioned in the code:** `my.garage.app`

## Dependencies

- **Internal:**
  - `server/services/downlineTree.ts` — `refreshTypeFlags`
  - `server/models/invoice.model.ts` — `Invoice`, `IInvoice`, `ICurrencyConversion`, `InvoiceItemType`, `PaymentMethodCategory`, `PaymentPlatform`, `couponProductTypeForItem`
  - `server/services/razorpay.ts` — `createOrder as createRazorpayOrder`, `verifyPaymentSignature`, `CouponPromotion`
  - `server/services/stripe.ts` — `stripeEnabled`, `createPaymentIntent as createStripePaymentIntent`, `chargeSavedPaymentMethod`, `getOrCreateStripeCustomer`, `getStripeClient`
  - `server/services/razorpay.ts` — `getOrCreateRazorpayCustomer`
  - `server/services/product.ts` — `createOrder as createProductOrder`, `updatePaymentStatus`
  - `server/services/course.ts` — `enrollInCourse`
  - `server/services/call.ts` — `purchaseCalls`
  - `server/services/commission.ts` — `distributeCommissions`
  - `server/utils/buyerAddress.ts` — `resolveBuyerAddress`
  - `server/models/channelMembership.model.ts` — `ChannelMembership`
  - `server/services/socket.ts` — `getSocketInstance`
  - `server/utils/dateMath.ts` — `addMonthsClamped`
  - `server/utils/exchangeRate.ts` — `convertUsdToInr`, `convertInrToUsd`, `getUsdToRate`, `isSupportedFiatCurrency`, `EXTRA_PAYMENT_CURRENCIES`
  - `server/models/franchiseProgram.model.ts` — `FRANCHISE_PRICE_USD`
  - `server/config/cryptoWallets.ts` — `getConfiguredChains`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/bat246/routes/bat246.routes.ts`
- `server/bat246/services/bat246Layaway.service.ts`
- `server/routes/bond.ts`
- `server/routes/call.ts`
- `server/routes/callCheckout.ts`
- `server/routes/channelCheckout.ts`
- `server/routes/course.ts`
- `server/routes/courseCheckout.ts`
- `server/routes/feed.ts`
- `server/routes/franchiseGlobal.ts`
- `server/routes/franchiseProgram.ts`
- `server/routes/garageAdminSavedCards.ts`
- `server/routes/hifiInvoice.ts`
- `server/routes/internalCrypto.ts`
- `server/routes/invoice.ts`
- `server/routes/nowpaymentsWebhook.ts`
- `server/routes/officeCheckout.ts`
- `server/routes/product.ts`
- `server/routes/productCheckout.ts`
- `server/routes/publicEventManagement.ts`
- `server/routes/publicWebinar.ts`
- `server/routes/service.ts`
- `server/routes/serviceCheckout.ts`
- `server/routes/stripeWebhook.ts`
- `server/routes/unilevel-plus.ts`
- _…and 28 more_

## Notes

- Large file (7458 lines) — read it by section; line numbers above point into it.
