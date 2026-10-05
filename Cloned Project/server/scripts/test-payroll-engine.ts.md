# `server/scripts/test-payroll-engine.ts`

> Smoke tests for the Teamforce payroll engine.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 966

<!-- docgen:auto -->

## Purpose
Smoke tests for the Teamforce payroll engine. No DB / network — pure
function checks against the worked examples in the spec.

Run after `npm run build`:
  node dist/scripts/test-payroll-engine.js

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/teamforce/payroll/index.ts` — `computeHRAExemption`, `computeLTAExemption`, `computeChildrenAllowanceExemption`, `computeProfessionalTax`, `computePF`, `computeESI`, `computeOldRegimeTax`, `computeNewRegimeTax`, … +12
- **Packages:** none

## Used by

Entry: run by hand: `npx tsx server/scripts/test-payroll-engine.ts`.
