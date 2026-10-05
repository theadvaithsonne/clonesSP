# `server/models/userProductLink.model.ts`

> Mongoose model `UserProductLink` (collection `userproductlinks`) with 6 top-level fields.

**Kind:** Mongoose model · **Lines:** 64

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `UserProductLink`

- **Collection:** `userproductlinks` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `userId` | `Schema.Types.ObjectId` | required, ref "User" |
| `productId` | `Schema.Types.ObjectId` | required, ref "Product" |
| `digitalLinkLabel` | `String` | required, trim |
| `url` | `String` | required, trim |
| `label` | `String` | trim |
| `description` | `String` | trim |

### Indexes

- `{ userId: 1, productId: 1, digitalLinkLabel: 1 }, { unique: true }` (L52)
- `{ productId: 1, digitalLinkLabel: 1 }` (L58)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `IUserProductLink` | interface |  | 3 |
| `UserProductLink` | model | `mongoose.model<IUserProductLink>( "UserProductLink", UserProductLinkSchema )` | 60 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `Document`, `Types`

## Used by

- `server/routes/product.ts`
- `server/services/product.ts`
