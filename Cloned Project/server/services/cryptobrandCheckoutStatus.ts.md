# `server/services/cryptobrandCheckoutStatus.ts`

> Cryptobrand checkout status — answers "does this org still owe Pro ($96) or Cryptosub ($600) from its cryptobrand-bootstrap?" server- authoritatively, and hands back the pending invoice(s) the founder still needs to pay.

**Kind:** backend service · **Lines:** 79

<!-- docgen:auto -->

## Purpose
Cryptobrand checkout status — answers "does this org still owe Pro
($96) or Cryptosub ($600) from its cryptobrand-bootstrap?" server-
authoritatively, and hands back the pending invoice(s) the founder
still needs to pay.

Called by GET /org/:orgId/cryptobrand-checkout. Decoupled from
bootstrapCryptobrandOfficeInvoices (which mints BOTH sides
unconditionally) so re-hitting this endpoint after one side is paid
doesn't re-mint the paid side.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CryptobrandCheckoutStatus` | interface |  | 21 |
| `isProOfficeSatisfied` | function | `async isProOfficeSatisfied(orgId: string): Promise<boolean>` — True when the cryptobrand-bootstrap Pro office_plan invoice for this org is `status = "paid"`. | 35 |
| `getCryptobrandCheckoutStatus` | function | `async getCryptobrandCheckoutStatus(orgId: string, founderUserId: string): Promise<CryptobrandCheckoutStatus>` — Full checkout state for the org. | 53 |

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `exists`

## Dependencies

- **Internal:**
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/services/officeAddonSubscription.ts` — `hasActiveAddon`
  - `server/services/cryptobrandOfficeBootstrap.ts` — `mintProOfficeInvoice`, `mintCryptosubInvoice`, `BootstrapInvoiceRef`
  - `server/config/cryptosubAddon.ts` — `CRYPTOSUB_ADDON`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/cryptobrandCheckout.ts`
- `server/services/officePlanStatus.ts`
