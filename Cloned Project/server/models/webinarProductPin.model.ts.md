# `server/models/webinarProductPin.model.ts`

> Mongoose model `WebinarProductPin` (collection `webinarproductpins`) with 11 top-level fields.

**Kind:** Mongoose model · **Lines:** 67

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `WebinarProductPin`

- **Collection:** `webinarproductpins` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `workshopId` | `Schema.Types.ObjectId` | required, index, ref "Workshop" |
| `orgId` | `Schema.Types.ObjectId` | required, ref "Organization" |
| `sessionDate` | `Date` | required |
| `itemType` | `String` | required |
| `itemId` | `Schema.Types.ObjectId` | required |
| `itemName` | `String` | — |
| `price` | `Number` | — |
| `currency` | `String` | — |
| `firstPinnedAt` | `Date` | required |
| `lastPinnedAt` | `Date` | required |
| `pinCount` | `Number` | default 1 |

### Indexes

- `{ workshopId: 1, sessionDate: 1, itemType: 1, itemId: 1 }, { unique: true }` (L58)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `IWebinarProductPin` | interface | A product the host put on screen during a live session ("live selling"). | 16 |
| `WebinarProductPin` | model | `model<IWebinarProductPin>( "WebinarProductPin", WebinarProductPinSchema )` | 63 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Document`, `Types`

## Used by

- `server/realtime/mediasoupHandlers.ts`
- `server/routes/publicWebinar.ts`
- `server/routes/webinarRoutes.ts`
- `server/services/founderStreamTable.ts`
- `server/services/invoice.ts`
- `server/services/workshop.ts`
