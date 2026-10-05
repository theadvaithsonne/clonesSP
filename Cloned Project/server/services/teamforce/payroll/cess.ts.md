# `server/services/teamforce/payroll/cess.ts`

> Health & Education Cess — flat 4% on (tax_after_rebate + surcharge).

**Kind:** backend service · **Lines:** 11

<!-- docgen:auto -->

## Purpose
Health & Education Cess — flat 4% on (tax_after_rebate + surcharge).
Spec §10.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CESS_RATE` | const | `= 0.04` — Health & Education Cess — flat 4% on (tax_after_rebate + surcharge). | 6 |
| `computeCess` | function | `computeCess(taxPlusSurcharge: number): number` | 8 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/services/teamforce/payroll/index.ts`
- `server/services/teamforce/payroll/section192Tds.ts`
