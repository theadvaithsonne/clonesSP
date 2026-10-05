# `server/services/itemReserveLicense.ts`

> Module exporting `createItemReserves`, `getItemReserves`, `getItemReserveStats`, `assignItemReserve`.

**Kind:** backend service · **Lines:** 646

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CreateItemReservesInput` | interface | Generic reserve-license service for course / channel / workshop / call. | 34 |
| `createItemReserves` | function | `async createItemReserves(input: CreateItemReservesInput): Promise<IItemReserveLicense[]>` — Bulk-create N reserve licenses. | 56 |
| `getItemReserves` | function | `async getItemReserves(buyerId: string, opts: { itemType?: ItemReserveType; status?: ItemReserveSta…): Promise<{ licenses: IItemReserveLicense[]; total:…` | 100 |
| `getItemReserveStats` | function | `async getItemReserveStats(buyerId: string): Promise<{ total: number; available: number; assig…` | 129 |
| `ItemReserveError` | class | `extends Error` | 176 |
| `AssignResult` | interface |  | 187 |
| `assignItemReserve` | function | `async assignItemReserve(licenseId: string, buyerId: string, recipient: { email?: string; userId?: string }): Promise<AssignResult>` — Assign one reserve to a recipient. | 200 |

## Interfaces

- **Database (Mongoose models used):**
  - `ItemReserveLicense` (server/models/itemReserveLicense.model.ts) — reads: `find`, `countDocuments`, `aggregate`, `findById`; **writes:** `insertMany`, `findOneAndUpdate`
  - `User` (server/models/user.model.ts) — reads: `findById`, `findOne`
  - `Floor` (server/models/floor.model.ts) — reads: `findOne`
  - `ChannelMembership` (server/models/channelMembership.model.ts) — reads: `findOne`; **writes:** `findOneAndUpdate`
  - `Course` (server/models/course.model.ts) — reads: `findById`
  - `CourseEnrollment` (server/models/courseEnrollment.model.ts) — reads: `findOne`; **writes:** `create`
  - `Workshop` (server/models/workshop.model.ts) — reads: `findById`
  - `WorkshopRegistration` (server/models/workshopRegistration.model.ts) — reads: `findOne`
  - `CallOffering` (server/models/callOffering.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/models/itemReserveLicense.model.ts` — `ItemReserveLicense`, `IItemReserveLicense`, `ItemReserveType`, `ItemReserveStatus`
  - `server/models/user.model.ts` — `User`
  - `server/models/channelMembership.model.ts` — `ChannelMembership`
  - `server/models/courseEnrollment.model.ts` — `CourseEnrollment`
  - `server/models/workshopRegistration.model.ts` — `WorkshopRegistration`
  - `server/models/course.model.ts` — `Course`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/callOffering.model.ts` — `CallOffering`
  - `server/models/floor.model.ts` — `Floor`
  - `server/services/init.ts` — `addUserToGarageHQ`
  - `server/services/channel.ts` — `autoJoinDefaultChannel`, `autoJoinMandatoryChannels`
  - `server/services/workshop.ts` — `registerForPaidWorkshop`
  - `server/services/downlineTree.ts` — `refreshTypeFlags`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/itemReserves.ts`
- `server/services/invoice.ts`
- `server/services/pendingReserveAssignment.ts`
