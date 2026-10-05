# `lib/webinar/garage-store-plans.ts`

> Garage Store plans — the "$25 Unilevel Plus + first partner cycle free" combo, sold from inside a webinar.

**Kind:** frontend library · **Lines:** 367

<!-- docgen:auto -->

## Purpose
Garage Store plans — the "$25 Unilevel Plus + first partner cycle free"
combo, sold from inside a webinar.

Everything here is per-VIEWER, not per-pin. The host pins the plan; what
each attendee is offered depends on their own state:

  comboUsed                  → they've redeemed it before   → renew
  owns UP + window open      → licence already theirs        → claim free month
  owns UP + window closed    → licence already theirs        → subscribe, billed today
  no UP  + window open       → combo, first cycle FREE       → create combo invoice
  no UP  + window closed     → combo, first cycle prepaid    → create combo invoice

The 24h window opens when the buyer completes their profile
(backend: services/comboWindow.ts). Prices in `comboTerms` already
reflect whether the window is open — the client never adjusts them.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FreeMonthWindow` | interface |  | 23 |
| `ComboTerm` | interface | One purchasable term inside the combo cart (licence + subscription). | 32 |
| `StandaloneTerm` | interface | A term price for someone who already owns the licence. | 48 |
| `ComboTermGroup` | interface |  | 55 |
| `UnilevelPlusProduct` | interface |  | 65 |
| `PlanOffer` | type | The offer state for the current viewer — everything the card needs. | 79 |
| `getUnilevelPlusProduct` | function | `async getUnilevelPlusProduct(): Promise<UnilevelPlusProduct>` | 106 |
| `resolveOffer` | function | `resolveOffer(product: UnilevelPlusProduct \| null, thirdPartyClientId: string): PlanOffer` — Collapse the raw product payload into the one state this viewer is in. | 114 |
| `offerPrice` | function | `offerPrice(offer: PlanOffer, termMonths: number): number \| null` — Headline price for a given offer + term, in USD. | 149 |
| `CreatedInvoice` | interface |  | 176 |
| `createComboInvoice` | function | `async createComboInvoice(input: { thirdPartyClientId: string; termMonths: number; }): Promise<CreatedInvoice>` | 181 |
| `claimFreeMonth` | function | `async claimFreeMonth(thirdPartyClientId: string): Promise<{ success: boolean }>` | 191 |
| `subscribeStandalone` | function | `async subscribeStandalone(input: { thirdPartyClientId: string; termMonths: number; }): Promise<CreatedInvoice>` | 200 |
| `ComboOverall` | type |  | 210 |
| `ComboStatusResult` | interface |  | 216 |
| `getComboStatus` | function | `async getComboStatus(upInvoiceId: string): Promise<ComboStatusResult>` — Poll after payment until `overall === "success"`. | 224 |
| `OfficePlan` | interface | An office plan (Starter / Pro). | 243 |
| `listOfficePlans` | function | `async listOfficePlans(): Promise<OfficePlan[]>` | 257 |
| `subscribeOffice` | function | `async subscribeOffice(orgId: string, planSlug: string): Promise<{ success: boolean; requiresPayment?: boo…` — Subscribe an EXISTING office to a plan. | 269 |
| `GarageStoreKind` | type | What kind of Garage Store plan a pinned item is. | 282 |
| `parseGarageStoreId` | function | `parseGarageStoreId(itemId: string): { catalogId: string; termMonths: number \| null; }` — Split a pinned garage-store id into its catalog id and (optional) term. | 289 |
| `OfficeOffer` | interface |  | 298 |
| `resolveGarageStoreItem` | function | `async resolveGarageStoreItem(itemId: string, viewerOrgId: string \| null): Promise<(PlanOffer & { termMonths?: number \| null…` — Resolve a pinned garage-store item for THIS viewer. | 312 |
| `resolveTermMonths` | function | `resolveTermMonths(offer: PlanOffer & { termMonths?: number \| null }): number` — The term this viewer will actually be billed for. | 347 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET unilevel-plus/product` (L107)
  - `POST unilevel-plus/checkout/create-combo-invoice` (L185)
  - `POST unilevel-plus/checkout/claim-free-month` (L194)
  - `POST unilevel-plus/checkout/subscribe` (L204)
  - `GET unilevel-plus/checkout/combo-status/${upInvoiceId}` (L227)
  - `GET checkout/office/plans` (L258)
  - `POST checkout/office/${orgId}/subscribe` (L273)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
- **Packages:** none

## Used by

- `app/(onboarding)/layout.tsx`
- `app/webinar/[id]/WebinarRoomClient.tsx`
- `components/dashboard/OrdersPage.tsx`
- `components/dashboard/WalletPageNew.tsx`
- `components/onboarding/UnilevelLicenceGate.tsx`
- `components/webinar/PinnedProductCard.tsx`
- `components/webinar/ProductPickerDialog.tsx`
