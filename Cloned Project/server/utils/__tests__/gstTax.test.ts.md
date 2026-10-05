# `server/utils/__tests__/gstTax.test.ts`

> Tests: 12 test cases.

**Kind:** test · **Lines:** 212

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (12)

- **isIndiaCountry**
- **applyGstToLine — the GST matrix**
  - inclusive + Indian buyer: splits tax out, buyer pays the listed price
  - inclusive + foreign buyer: no tax, whole listed price is base
  - exclusive + Indian buyer: adds 18% on top
  - exclusive + foreign buyer: pays the listed price, no tax
  - exempt items carry no tax even for an Indian buyer
  - currency plays no part — only the buyer's region does
  - **quantity**
    - scales tax and charge but not the unit price
    - defaults to 1
  - **invariants across awkward amounts**
- **getCommissionBase**
  - extracts the pre-tax base for inclusive + Indian buyer
  - keeps the full listed price for inclusive + foreign buyer
  - keeps the listed price for exclusive pricing, either region
  - matches the line-item base applyGstToLine produces

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/utils/gstTax.ts` — `applyGstToLine`, `getCommissionBase`, `isIndiaCountry`, `GST_CONFIG`
- **Packages:** none

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
