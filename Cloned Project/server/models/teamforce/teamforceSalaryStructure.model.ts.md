# `server/models/teamforce/teamforceSalaryStructure.model.ts`

> Mongoose model `TeamforceSalaryStructure` (collection `teamforcesalarystructures`) with 8 top-level fields.

**Kind:** Mongoose model · **Lines:** 160

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `TeamforceSalaryStructure`

- **Collection:** `teamforcesalarystructures` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `orgId` | `Types.ObjectId` | required, index, ref "Organization" |
| `name` | `String` | required, trim |
| `earnings` | `[ComponentSchema]` | default [] |
| `deductions` | `[ComponentSchema]` | default [] |
| `taxRegime` | `String` | default "new", enum TAX_REGIMES |
| `autoTds` | `Boolean` | default true |
| `estimatedAnnualTds` | `Number` | default 0 |
| `isActive` | `Boolean` | default true |

### Indexes

- `{ orgId: 1, name: 1 }, { unique: true, partialFilterExpression: { isActive: true } }` (L96)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `COMPONENT_CODES` | const | `= [ // Earnings "BASIC", "DA", "HRA", "LTA", "SPECIAL", "CHILDREN_EDU", "CHILDREN_HOSTEL"…` | 3 |
| `TAXABILITY_TYPES` | const | `= [ "FULLY_TAXABLE", "EXEMPT_FORMULA", "EXEMPT_FIXED", "EXEMPT_FULL", "DEDUCTION_STATUTOR…` | 32 |
| `CALC_TYPES` | const | `= [ "flat", "percentBasic", "percentBasicPlusDA", "percentCTC", "percentGross", ] as const` | 42 |
| `TAX_REGIMES` | const | `= ["old", "new"] as const` | 50 |
| `ComponentCode` | type |  | 52 |
| `TaxabilityType` | type |  | 53 |
| `CalcType` | type |  | 54 |
| `TaxRegime` | type |  | 55 |
| `TeamforceSalaryStructure` | model | `model( "TeamforceSalaryStructure", TeamforceSalaryStructureSchema )` | 101 |
| `DefaultComponent` | interface |  | 106 |
| `buildDefaultSalaryStructureComponents` | function | `buildDefaultSalaryStructureComponents(): { earnings: DefaultComponent[]; deductions: Defau…` | 114 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Types`

## Used by

- `server/routes/teamforce/payrollRuns.ts`
- `server/routes/teamforce/salaryStructures.ts`
- `server/routes/teamforce/taxDeclaration.ts`
