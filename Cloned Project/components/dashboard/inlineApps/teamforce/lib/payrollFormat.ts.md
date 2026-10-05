# `components/dashboard/inlineApps/teamforce/lib/payrollFormat.ts`

> Shared formatters for the payroll UI.

**Kind:** React component · **Lines:** 28

<!-- docgen:auto -->

## Purpose
Shared formatters for the payroll UI. Tiny module so PayrollSection,
SalarySlipDrawer and MySalarySlipsSection don't duplicate these.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `INR` | function | `INR(n: number): string` — Shared formatters for the payroll UI. | 6 |
| `fmtDate` | function | `fmtDate(s: string \| Date \| undefined \| null): string` | 9 |
| `fyMonthLabel` | function | `fyMonthLabel(fyMonth: number, fyYear: number): string` | 24 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `components/dashboard/inlineApps/teamforce/sections/MySalarySlipsSection.tsx`
- `components/dashboard/inlineApps/teamforce/sections/SalarySlipDrawer.tsx`
