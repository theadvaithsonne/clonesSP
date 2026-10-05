# `server/services/franchiseChainPlan.ts`

> Module exporting `buildFranchiseChainPlan`.

**Kind:** backend service · **Lines:** 111

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CommissionConfig` | type | Pure chain-integrity decision for founder-program payouts. | 34 |
| `LevelAssigned` | type |  | 40 |
| `ChainPlanItem` | interface |  | 46 |
| `buildFranchiseChainPlan` | function | `buildFranchiseChainPlan(assigned: LevelAssigned, cfg: CommissionConfig): ChainPlanItem[]` | 54 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/models/franchiseTerritoryAssignment.model.ts` — `FranchiseGeoLevel`
- **Packages:** none

## Used by

- `scripts/verify-franchise-logic.ts`
- `server/services/franchiseProgramCommission.ts`
- `server/services/territoryCommission.ts`
