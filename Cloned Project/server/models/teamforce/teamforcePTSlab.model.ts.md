# `server/models/teamforce/teamforcePTSlab.model.ts`

> Mongoose model for state-wise Indian Professional Tax (PT) slabs, plus the hardcoded seed slab table and the list of supported states.

**Kind:** Mongoose model · **Lines:** 66

## Purpose
Professional Tax is a monthly deduction set by each Indian state based on gross salary. Payroll needs a lookup table that maps (state, gross, month) to a monthly PT amount. This file defines that table and ships a canonical starting set of slabs, which a founder can load into the database with the seed endpoint.

## How it works
Schema fields:
- `state` (required)
- `grossFrom` (required, default 0) and `grossTo` (null means no upper bound)
- `monthlyPT` (required)
- `monthOverride` (1-12 or null): a row that applies only in that calendar month
- `effectiveDate` (required, defaults to now), `isActive`
- `timestamps: true`

Index: `{ state, effectiveDate: -1 }`.

Unlike most Teamforce models, this table has **no `orgId`**. The slabs are shared by every organisation.

`SEED_PT_SLABS` lists rows for:
- Maharashtra, including a February-only (`monthOverride: 2`) ₹300 row for gross above ₹10,000
- Karnataka, Tamil Nadu, Telangana, Gujarat
- single zero-PT catch-all rows for Delhi, Haryana, Rajasthan, Uttar Pradesh, Madhya Pradesh, Bihar, Punjab and Chandigarh

`PT_STATES` is the sorted, de-duplicated list of states in the seed table.

How it is used:
- `POST /pt-slabs/seed` inserts each seed row that does not already exist, matching on state, gross range, amount and month override, with `effectiveDate` set to 2024-04-01.
- The payroll run loads every active slab and passes them to the PT calculator, together with the employee's `state` (or the payroll config's `defaultState`).

## Exports
- `TeamforcePTSlab` - the Mongoose model `"TeamforcePTSlab"` (collection `teamforceptslabs`).
- `SEED_PT_SLABS` - an array of `{ state, grossFrom, grossTo, monthlyPT, monthOverride }` seed rows.
- `PT_STATES` - `string[]` of supported states, returned by `GET /pt-slabs` alongside the slabs.

## Interfaces
- **Database:** `TeamforcePTSlab` (collection `teamforceptslabs`). Global, not per org.
- **Endpoints served (through the router):**
  - `GET /backend/teamforce/pt-slabs` (any signed-in user)
  - `POST` and `PATCH /backend/teamforce/pt-slabs[/:id]`, `DELETE` (soft delete), and `POST .../pt-slabs/seed`, all founder only (`requireFounderOnly`)

## Dependencies
- **Packages:** `mongoose` - `Schema`, `model`.

## Used by
- `server/routes/teamforce/ptSlabs.ts` (mounted at `/teamforce/pt-slabs`)
- `server/routes/teamforce/payrollRuns.ts`
- `server/routes/teamforce/taxDeclaration.ts`

## Notes
- Because the table is global, a founder of **any** organisation can add, edit or soft-delete slabs, and the change affects every organisation's payroll.
- `PT_STATES` comes only from the seed list, so a state added through the API does not appear in it.
- The slab amounts are a hardcoded snapshot. State rates change, so they need manual upkeep.
