# `server/services/thirdPartyTerms.ts`

> Module exporting `defaultTermMonths`, `resolveTermPlan`, `listActiveTermPlans`, `resolveInvoiceTermMonths` and 4 more.

**Kind:** backend service · **Lines:** 970

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TermPricingMode` | type | Which price list a resolution should use. | 20 |
| `ResolvedTermPlan` | interface |  | 22 |
| `defaultTermMonths` | function | `defaultTermMonths(_pc?: IThirdPartyProductConfig): number` — The term used when the caller doesn't pick one: ALWAYS 1 month. | 110 |
| `resolveTermPlan` | function | `resolveTermPlan(pc: IThirdPartyProductConfig, termMonths?: number, opts?: { allowInactive?: boolean; pricing?: TermPricingMode…): ResolvedTermPlan` — Resolve a term plan, or throw INVALID_TERM. | 125 |
| `listActiveTermPlans` | function | `listActiveTermPlans(pc: IThirdPartyProductConfig, pricing: TermPricingMode = "standalone"): ResolvedTermPlan[]` — Sellable terms, for catalog endpoints. | 183 |
| `resolveInvoiceTermMonths` | function | `resolveInvoiceTermMonths(invoice: { metadata?: any; recurringIntervalMonths?: number…): number` — How many months an invoice's cycle covers, read from the INVOICE ITSELF. | 216 |
| `perMonthPortions` | function | `perMonthPortions(pc: IThirdPartyProductConfig): { upPortion: number; platformPortion: number; }` — Convenience for callers that need the monthly split regardless of term. | 241 |
| `ChildTermPricing` | interface |  | 254 |
| `priceThirdPartyChildCycle` | function | `async priceThirdPartyChildCycle(input: { parent: any; // IInvoice nextPaymentNumber: number…): Promise<ChildTermPricing \| null>` — Price the next cycle of a third-party subscription from its selected term. | 279 |
| `ChangeTermResult` | interface |  | 451 |
| `changeSubscriptionTerm` | function | `async changeSubscriptionTerm(input: { parentInvoiceId: string; termMonths: number; actor…): Promise<ChangeTermResult>` — Change the term of an existing third-party subscription. | 490 |
| `listSubscriptionsForUser` | function | `async listSubscriptionsForUser(userId: string, clientId?: string): Promise<any[]>` — Subscription chains for a buyer, for the "my subscriptions" surfaces. | 768 |

## Interfaces

- **Environment variables (`process.env`):** `THIRD_PARTY_CHILD_GST_RECOMPUTE`, `FRONTEND_URL`

## Dependencies

- **Internal:**
  - `server/models/thirdPartyClient.model.ts` — `IThirdPartyProductConfig`, `IThirdPartyTermPlan`
  - `server/services/thirdPartyError.ts` — `ThirdPartyError`
  - `server/utils/dateMath.ts` — `addMonthsClamped`
- **Packages:** none

## Used by

- `server/routes/thirdPartyInvoice.ts`
- `server/routes/thirdPartySubscription.ts`
- `server/routes/unilevel-plus.ts`
- `server/scripts/verify-third-party-term-pricing.ts`
- `server/services/comboCheckout.ts`
- `server/services/commission.ts`
- `server/services/invoice.ts`
- `server/services/sellables.ts`
- `server/services/thirdPartyInvoice.ts`
- `server/services/upiAutopay.ts`
