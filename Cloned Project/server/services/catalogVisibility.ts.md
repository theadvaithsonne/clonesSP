# `server/services/catalogVisibility.ts`

> Module exporting `isLegacyDigitalProduct`, `orgIdsWithActiveStore`.

**Kind:** backend service · **Lines:** 56

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `LEGACY_DIGITAL_PRODUCT_FILTER` | const | `= { $or: [{ isDigital: true }, { deliveryMethod: "digital" }], }` — Storefront resolvability for affiliate-facing catalogs. | 21 |
| `isLegacyDigitalProduct` | function | `isLegacyDigitalProduct(doc: any): boolean` — In-memory equivalent of { | 26 |
| `orgIdsWithActiveStore` | function | `async orgIdsWithActiveStore(orgIds: Array<Types.ObjectId \| string>): Promise<Set<string>>` — A `storeproducts` doc only renders on garage.app/product/:id if its org has an ACTIVE store doc WITH a slug — otherwise the storefront 404s even for a status:"active" product. | 37 |

## Interfaces

- **Raw collections:** `stores`

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/affiliate.ts`
- `server/routes/internal-catalog.ts`
- `server/services/cashbackCode.ts`
