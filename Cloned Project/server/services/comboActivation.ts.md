# `server/services/comboActivation.ts`

> Module exporting `activateComboFreeFirstMonth`.

**Kind:** backend service · **Lines:** 337

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ActivateComboInput` | interface |  | 25 |
| `ActivateComboResult` | interface |  | 59 |
| `activateComboFreeFirstMonth` | function | `async activateComboFreeFirstMonth(input: ActivateComboInput): Promise<ActivateComboResult>` — Issue the $0 first-cycle invoice for a combo offer (UP $25 → free month of a third-party subscription). | 74 |

## Interfaces

- **Database (Mongoose models used):**
  - `ThirdPartyClient` (server/models/thirdPartyClient.model.ts) — reads: `findById`
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `Invoice` (server/models/invoice.model.ts) — reads: `findOne`; **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/invoice.model.ts` — `Invoice`, `IInvoice`
  - `server/models/thirdPartyClient.model.ts` — `ThirdPartyClient`
  - `server/models/user.model.ts` — `User`
  - `server/services/thirdPartyInvoice.ts` — `createThirdPartyInvoice`, `ThirdPartyError`
  - `server/services/invoice.ts` — `fulfillInvoice`, `getNextChargeDate`
  - `server/utils/dateMath.ts` — `addMonthsClamped`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/garageAdminSavedCards.ts`
- `server/routes/magicLink.ts`
- `server/routes/unilevel-plus.ts`
- `server/scripts/activate-nc-from-saved-card.ts`
- `server/scripts/backfill-combo-free-month.ts`
- `server/scripts/setup-test-account.ts`
- `server/services/invoice.ts`
