# `server/services/adminPlatformBilling.ts`

> Module exporting `mintUnilevelPlusInvoice`, `mintComboInvoice`, `mintOfficePlanInvoice`, `platformOrgId` and 1 more.

**Kind:** backend service · **Lines:** 307

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PlatformItemType` | type | Minting the invoices behind the admin "bill a saved card for a Garage product" action. | 28 |
| `MintResult` | interface |  | 30 |
| `AdminActor` | interface | Audit trail stamped on every invoice this file mints. | 39 |
| `mintUnilevelPlusInvoice` | function | `async mintUnilevelPlusInvoice(opts: { user: any; orgId: string; actor: AdminActor; }): Promise<MintResult>` — Unilevel Plus — a ONE-TIME licence, never recurring. | 75 |
| `mintComboInvoice` | function | `async mintComboInvoice(opts: { user: any; orgId: string; actor: AdminActor; client…): Promise<MintResult>` — Unilevel Plus licence + the first NetworkChain term, as ONE invoice. | 122 |
| `mintOfficePlanInvoice` | function | `async mintOfficePlanInvoice(opts: { user: any; orgId: string; actor: AdminActor; freeCy…): Promise<MintResult>` — Office Pro, billed against one org the user founds. | 194 |
| `platformOrgId` | function | `async platformOrgId(): Promise<string>` — Org to attribute a platform sale to when the product isn't org-scoped. | 289 |
| `findExistingPlatformInvoice` | function | `async findExistingPlatformInvoice(userId: string, itemType: string): Promise<any \| null>` — Has this user already been sold this exact thing? | 295 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`
  - `Invoice` (server/models/invoice.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/user.model.ts` — `User`
  - `server/services/invoice.ts` — `createInvoice`, `getNextChargeDate`
  - `server/utils/gstBuyerRegion.ts` — `resolveBuyerGstRegion`
  - `server/utils/gstTax.ts` — `applyGstToLine`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/garageAdminSavedCards.ts`
