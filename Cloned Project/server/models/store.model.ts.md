# `server/models/store.model.ts`

> Mongoose model `Store` (collection `stores`) with 8 top-level fields.

**Kind:** Mongoose model · **Lines:** 64

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `Store`

- **Collection:** `stores`
- **Schema options:** `collection: "stores"`, `strict: false`, `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `orgId` | `Schema.Types.ObjectId` | required, index |
| `name` | `String` | required |
| `slug` | `String` | — |
| `currency` | `String` | required |
| `timezone` | `String` | — |
| `isActive` | `Boolean` | — |
| `storeKind` | `String` | enum ["online", "offline"] |
| `branding` | `Schema.Types.Mixed` | — |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `IStoreBranding` | interface | Read-only mirror of the `stores` collection owned by the storefront backend. | 9 |
| `IStore` | interface |  | 19 |
| `Store` | model | `model<IStore>("Store", StoreSchema)` | 63 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Document`, `Types`

## Used by

- `server/realtime/mediasoupHandlers.ts`
- `server/routes/counterBills.ts`
- `server/services/auctionSettlement.ts`
- `server/services/commission.ts`
- `server/services/counterBill.ts`
- `server/services/ecommerceInvoice.ts`
