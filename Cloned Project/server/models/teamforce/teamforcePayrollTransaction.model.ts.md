# `server/models/teamforce/teamforcePayrollTransaction.model.ts`

> Mongoose model `TeamforcePayrollTransaction` (collection `teamforcepayrolltransactions`) with 29 top-level fields.

**Kind:** Mongoose model · **Lines:** 120

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `TeamforcePayrollTransaction`

- **Collection:** `teamforcepayrolltransactions` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `runId` | `Types.ObjectId` | required, index, ref "TeamforcePayrollRun" |
| `orgId` | `Types.ObjectId` | required, index, ref "Organization" |
| `userId` | `Types.ObjectId` | required, index, ref "User" |
| `salaryStructureId` | `Types.ObjectId` | ref "TeamforceSalaryStructure" |
| `monthlyCtcAnchor` | `Number` | default 0 |
| `earnings` | `[ResolvedComponentSchema]` | default [] |
| `deductions` | `[ResolvedComponentSchema]` | default [] |
| `attendance` | `AttendanceBreakdownSchema` | required |
| `regimeUsed` | `String` | required, enum ["OLD", "NEW"] |
| `projectedAnnualGross` | `Number` | default 0 |
| `totalExemptions` | `Number` | default 0 |
| `standardDeduction` | `Number` | default 0 |
| `chapterVIA` | `ChapterVIASchema` | default () => ({}) |
| `netTaxableIncome` | `Number` | default 0 |
| `annualTaxLiability` | `Number` | default 0 |
| `monthlyTDS` | `Number` | default 0 |
| `overDeducted` | `Boolean` | default false |
| `pfEmployee` | `Number` | default 0 |
| `pfEmployer` | `Number` | default 0 |
| `esiEmployee` | `Number` | default 0 |
| `esiEmployer` | `Number` | default 0 |
| `professionalTax` | `Number` | default 0 |
| `grossSalary` | `Number` | default 0 |
| `joiningPartialPay` | `Number` | default 0 |
| `netPay` | `Number` | default 0 |
| `warnings` | `[String]` | default [] |
| `overrideNotes` | `String` | default "" |
| `overriddenBy` | `Types.ObjectId` | ref "User" |
| `overriddenAt` | `Date` | — |

### Indexes

- `{ runId: 1, userId: 1 }, { unique: true }` (L114)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TeamforcePayrollTransaction` | model | `model( "TeamforcePayrollTransaction", TeamforcePayrollTransactionSchema )` | 116 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Types`

## Used by

- `server/routes/teamforce/payrollRuns.ts`
