# `server/services/sellables.ts`

> Module exporting `getSellable`, `listOrgSellables`, `toInvoiceItemType`.

**Kind:** backend service · **Lines:** 699

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SellableItemType` | type |  | 20 |
| `Sellable` | interface |  | 32 |
| `getSellable` | function | `async getSellable(orgId: string, itemType: SellableItemType, itemId: string): Promise<Sellable \| null>` | 307 |
| `listOrgSellables` | function | `async listOrgSellables(orgId: string): Promise<Sellable[]>` | 419 |
| `toInvoiceItemType` | function | `toInvoiceItemType(t: SellableItemType): InvoiceItemType` | 690 |

## Interfaces

- **Database (Mongoose models used):**
  - `Product` (server/models/product.model.ts) — reads: `findOne`, `find`
  - `StoreProduct` (server/models/storeProduct.model.ts) — reads: `findOne`, `find`
  - `Channel` (server/models/channel.model.ts) — reads: `findOne`, `find`
  - `Course` (server/models/course.model.ts) — reads: `findOne`, `find`
  - `Service` (server/models/service.model.ts) — reads: `findOne`, `find`
  - `Workshop` (server/models/workshop.model.ts) — reads: `findOne`, `find`
  - `WorkshopSessionOverride` (server/models/workshopSessionOverride.model.ts) — reads: `find`
- **Raw collections:** `stores`

## Dependencies

- **Internal:**
  - `server/models/product.model.ts` — `Product`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/course.model.ts` — `Course`
  - `server/models/service.model.ts` — `Service`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/storeProduct.model.ts` — `StoreProduct`
  - `server/models/workshopSessionOverride.model.ts` — `WorkshopSessionOverride`
  - `server/utils/workshopStatus.ts` — `deriveSessionStatus`, `isWorkshopDeleted`, `computeSessionWindow`, `sessionDayKey`
  - `server/utils/recurrence.ts` — `calculateSessions`
  - `server/models/invoice.model.ts` — `InvoiceItemType`, `(types only)`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/realtime/mediasoupHandlers.ts`
- `server/routes/invoice.ts`
- `server/routes/publicWebinar.ts`
