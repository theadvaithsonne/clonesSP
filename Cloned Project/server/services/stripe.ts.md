# `server/services/stripe.ts`

> Module exporting `getStripeClient`, `createPaymentIntent`, `retrievePaymentIntent`, `verifyWebhookSignature` and 6 more.

**Kind:** backend service · **Lines:** 368

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `stripeEnabled` | const | `= !!process.env.STRIPE_SECRET_KEY` | 6 |
| `getStripeClient` | function | `getStripeClient(): any` | 10 |
| `CreatePaymentIntentOptions` | interface |  | 22 |
| `IndianMandateOptions` | interface | India e-mandate config used by both SetupIntent + PaymentIntent (save-and-charge). | 58 |
| `createPaymentIntent` | function | `async createPaymentIntent(opts: CreatePaymentIntentOptions): Promise<{ clientSecret: string; paymentIntentId: …` | 67 |
| `retrievePaymentIntent` | function | `async retrievePaymentIntent(paymentIntentId: string): Promise<any>` | 150 |
| `verifyWebhookSignature` | function | `verifyWebhookSignature(rawBody: Buffer, signature: string): any` | 155 |
| `getOrCreateStripeCustomer` | function | `async getOrCreateStripeCustomer(input: { userId: string; email?: string; name?: string; }): Promise<string>` — Ensure the user has a Stripe Customer, creating one lazily on first need. | 178 |
| `createSetupIntent` | function | `async createSetupIntent(customerId: string, opts?: { indianMandate?: IndianMandateOptions }): Promise<{ clientSecret: string; setupIntentId: st…` — Standalone "save this card, don't charge me anything" flow — powers the Payment Methods settings page. | 220 |
| `chargeSavedPaymentMethod` | function | `async chargeSavedPaymentMethod(opts: { customerId: string; paymentMethodId: string; amount…): Promise<any>` — Charge a previously-saved PaymentMethod. | 275 |
| `listCustomerPaymentMethods` | function | `async listCustomerPaymentMethods(customerId: string): Promise<any[]>` — Read-through to Stripe's live list of saved cards for the customer. | 326 |
| `detachPaymentMethod` | function | `async detachPaymentMethod(paymentMethodId: string): Promise<void>` — Remove a saved card. Stripe emits `payment_method.detached`, which our webhook uses to prune the User doc. | 341 |
| `refundStripeCharge` | function | `async refundStripeCharge(opts: { paymentIntentId: string; metadata?: Record<string, …): Promise<any>` — Full-refund a Stripe charge by its PaymentIntent id. | 358 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`; **writes:** `updateOne`
- **Environment variables (`process.env`):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/garageAdminSavedCards.ts`
- `server/routes/invoice.ts`
- `server/routes/paymentMethods.ts`
- `server/routes/stripeWebhook.ts`
- `server/scripts/activate-nc-from-saved-card.ts`
- `server/scripts/charge-shorupan-inr-ten.ts`
- `server/scripts/check-and-charge-shorupan-inr-mandate.ts`
- `server/scripts/check-shorupan-stripe-profile.ts`
- `server/scripts/check-stripe-account.ts`
- `server/scripts/delete-shorupan-inr-card.ts`
- `server/services/invoice.ts`
- `server/services/thirdPartyTerms.ts`
