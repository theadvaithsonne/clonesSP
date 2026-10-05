# `server/services/reserveLicense.ts`

> Module exporting `createReserveLicenses`, `getReserveLicenses`, `getReserveStats`, `assignReserveLicense`.

**Kind:** backend service · **Lines:** 231

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CreateReserveLicensesOptions` | interface |  | 11 |
| `createReserveLicenses` | function | `async createReserveLicenses(options: CreateReserveLicensesOptions): Promise<IReserveLicense[]>` — Create N reserve licenses, each triggering its own commission distribution. | 30 |
| `getReserveLicenses` | function | `async getReserveLicenses(userId: string, options?: { status?: string; limit?: number; offset?: numbe…): Promise<{ licenses: IReserveLicense[]; total: num…` — Get paginated list of reserve licenses for a user. | 99 |
| `getReserveStats` | function | `async getReserveStats(userId: string): Promise<{ available: number; assigned: number; to…` — Get stats: available vs assigned counts. | 128 |
| `assignReserveLicense` | function | `async assignReserveLicense(licenseId: string, ownerUserId: string, targetUserId: string): Promise<{ license: IReserveLicense; purchase: any…` — Assign a reserve license to a target user. | 151 |

## Interfaces

- **Database (Mongoose models used):**
  - `ReserveLicense` (server/models/reserveLicense.model.ts) — reads: `find`, `countDocuments`, `findById`; **writes:** `create`
  - `UnilevelPlusPurchase` (server/models/unilevelPlusPurchase.model.ts) — **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/reserveLicense.model.ts` — `ReserveLicense`, `IReserveLicense`
  - `server/models/unilevelPlusPurchase.model.ts` — `UnilevelPlusPurchase`
  - `server/services/unilevelPlusCommission.ts` — `distributeUnilevelPlusCommission`, `getUserPurchase`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/unilevel-plus.ts`
- `server/services/invoice.ts`
