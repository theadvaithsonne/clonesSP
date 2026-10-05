# `server/services/teamforce/payroll/index.ts`

> Teamforce payroll engine — barrel export.

**Kind:** backend service · **Lines:** 25

<!-- docgen:auto -->

## Purpose
Teamforce payroll engine — barrel export.

All functions in this module are PURE: same input → same output, no DB
reads, no clock reads, no I/O. Wire them up from a route handler / payroll
run pipeline (Phase 5).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `*` | re-export | `from ./types` | 9 |
| `*` | re-export | `from ./fyHelpers` | 10 |
| `*` | re-export | `from ./hraExemption` | 11 |
| `*` | re-export | `from ./ltaExemption` | 12 |
| `*` | re-export | `from ./childrenAllowanceExemption` | 13 |
| `*` | re-export | `from ./ptComputation` | 14 |
| `*` | re-export | `from ./pfComputation` | 15 |
| `*` | re-export | `from ./esiComputation` | 16 |
| `*` | re-export | `from ./oldRegimeTax` | 17 |
| `*` | re-export | `from ./newRegimeTax` | 18 |
| `*` | re-export | `from ./surcharge` | 19 |
| `*` | re-export | `from ./cess` | 20 |
| `*` | re-export | `from ./chapterVIA` | 21 |
| `*` | re-export | `from ./section192Tds` | 22 |
| `*` | re-export | `from ./attendance` | 23 |
| `*` | re-export | `from ./structureResolver` | 24 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/routes/teamforce/payrollRuns.ts`
- `server/routes/teamforce/taxDeclaration.ts`
- `server/scripts/test-payroll-engine.ts`
