# `server/models/itemReserveLicense.model.ts`

> Mongoose model `ItemReserveLicense` (collection `itemreservelicenses`) with 18 top-level fields.

**Kind:** Mongoose model · **Lines:** 160

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `ItemReserveLicense`

- **Collection:** `itemreservelicenses`
- **Schema options:** `timestamps: true`, `collection: "itemreservelicenses"`

| Field | Type | Flags |
|---|---|---|
| `buyerId` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `itemType` | `String` | required, index, enum ["course", "channel", "workshop", "call", "… |
| `itemId` | `Schema.Types.ObjectId` | required, index |
| `itemName` | `String` | required |
| `itemImage` | `String` | — |
| `organizationId` | `Schema.Types.ObjectId` | required, index, ref "Organization" |
| `invoiceId` | `Schema.Types.ObjectId` | required, index, ref "Invoice" |
| `invoiceNumber` | `String` | required |
| `paymentId` | `String` | required |
| `seq` | `Number` | required |
| `status` | `String` | index, default "available", enum ["available", "assigned", "expired"] |
| `assignedTo` | `Schema.Types.ObjectId` | ref "User" |
| `assignedAt` | `Date` | — |
| `assignedArtifactRef` | `AssignedArtifactRefSchema` | — |
| `pendingAssignmentId` | `Schema.Types.ObjectId` | ref "PendingReserveAssignment" |
| `unitPrice` | `Number` | required |
| `currency` | `String` | default "USD" |
| `metadata` | `Schema.Types.Mixed` | — |

### Indexes

- `{ buyerId: 1, status: 1, createdAt: -1 }` (L146)
- `{ assignedTo: 1, createdAt: -1 }` (L149)
- `{ paymentId: 1, seq: 1 }, { unique: true }` (L154)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ItemReserveType` | type | Reserve licenses for sellable items (course / channel / workshop / call). | 18 |
| `ItemReserveStatus` | type |  | 20 |
| `IItemReserveLicense` | interface |  | 22 |
| `ItemReserveLicense` | model | `mongoose.model<IItemReserveLicense>( "ItemReserveLicense", ItemReserveLicenseSchema )` | 156 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `Document`, `Types`

## Used by

- `server/services/itemReserveLicense.ts`
- `server/services/pendingReserveAssignment.ts`
