# `server/services/upiAutopay.ts`

> UPI Autopay controls, scoped to a subscription.

**Kind:** backend service · **Lines:** 728

<!-- docgen:auto -->

## Purpose
UPI Autopay controls, scoped to a subscription.

THE CENTRAL DISTINCTION THIS FILE EXISTS TO ENFORCE:

  cancel subscription  → invoices stop being generated, access ends
  disable autopay      → invoices KEEP being generated; the payer just
                         settles each one by hand, exactly as they do today

They are different actions with different consequences, and conflating them
is the expensive mistake: someone who only wants "stop taking money from my
account automatically" must not lose the thing they are subscribed to.
Nothing in here touches subscription state — no `cancelledAt`, no child
invoice cancellation, no membership change.

How manual payment keeps working with autopay off: `autoChargeOneInvoice`
finds no active mandate, records a `skipped_no_card` attempt, and returns […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `willEstablishSubscription` | function | `async willEstablishSubscription(invoice: any): Promise<boolean>` — Will paying this invoice put the buyer on a recurring subscription? | 65 |
| `UpiAutopayNotice` | interface | What the checkout must disclose before a UPI payment establishes a mandate. | 151 |
| `getUpiAutopayNotice` | function | `async getUpiAutopayNotice(invoice: any): Promise<UpiAutopayNotice \| null>` — Build the disclosure for an invoice, or null when paying it would not establish a mandate. | 178 |
| `UPI_MANDATE_ABSOLUTE_MAX_PAISE` | const | `= 10_000_000` — Absolute ceiling on a mandate cap, as a backstop only. | 253 |
| `resolveMandateCapPaise` | function | `async resolveMandateCapPaise(invoice: any, chargeMinor: number): Promise<number \| null>` — Work out the mandate ceiling for the subscription this invoice starts. | 284 |
| `UpiMandateFrequency` | type | Frequencies Razorpay actually recognises for a UPI mandate. | 357 |
| `mandateFrequencyForTerm` | function | `mandateFrequencyForTerm(term: number \| "weekly"): UpiMandateFrequency` — Declare the real billing cadence on the mandate instead of `as_presented`. | 385 |
| `resolveMandateFrequency` | function | `async resolveMandateFrequency(invoice: any): Promise<UpiMandateFrequency>` — The mandate cadence this invoice's subscription will bill on. | 404 |
| `AutopayState` | interface |  | 412 |
| `getAutopayState` | function | `async getAutopayState(userId: string): Promise<AutopayState>` — Read the buyer's UPI mandate state. | 512 |
| `disableAutopay` | function | `async disableAutopay(userId: string): Promise<{ disabled: number; alreadyOff: boolean; …` — Turn OFF automatic debiting. | 594 |
| `enableAutopay` | function | `async enableAutopay(parentInvoiceId: string, userId: string): Promise<{ /** The invoice to pay by UPI to establ…` — Turn autopay back ON for a subscription — the "resubscribe" path. | 679 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`; **writes:** `updateOne`
  - `Invoice` (server/models/invoice.model.ts) — reads: `findById`, `findOne`

## Dependencies

- **Internal:**
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/invoice.ts`
- `server/services/invoice.ts`
- `server/services/thirdPartyTerms.ts`
