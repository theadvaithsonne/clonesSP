# `server/models/teamforce/teamforceEmployeeTaxDeclaration.model.ts`

> Mongoose model for an employee's Indian income-tax declaration for one financial year: the chosen regime, HRA/LTA claims, Chapter VI-A investments and previous-employer income (Form 12B).

**Kind:** Mongoose model · **Lines:** 72

## Purpose
Payroll must deduct TDS under Section 192 of the Indian Income Tax Act. For that it needs each employee's chosen tax regime and declared exemptions and deductions for the financial year. This model holds one declaration per user, per org, per FY. The payroll run reads it to compute `monthlyTDS`, and the regime-preview endpoint uses it to compare the Old and New regimes side by side.

## How it works
Embedded sub-schemas (no `_id`):
- `HRADeclSchema`: `monthlyRentPaid`, `landlordName`, `landlordPan` (uppercased), `ownsHouseInCity`.
- `PrevEmployerSchema`: `name`, `tan` (uppercased), `grossSalary`, `tdsDeducted`, `ptPaid`, `pfPaid`. This is Form 12B data for employees who joined mid-year.

Main fields:
- `userId`, `orgId` (required). `fy` (required string, such as `"2024-25"`).
- `regime`: `OLD`/`NEW`, default `NEW`. Payroll uses this, falling back to `NEW` when no declaration exists.
- Old-Regime-only items: `hraDeclaration`, `ltaClaimAmount`, `numChildren` (0-10, children education/hostel exemption under Sec 10(14)).
- Chapter VI-A amounts:
  - `declared80C`, `declaredNpsSelf` (80CCD(1B)), `declared80DSelf`, `declared80DParent`, `parentSeniorCitizen`
  - `savingsInterest` (80TTA/80TTB), `fdInterest` (80TTB, age 60 or over only)
  - `declared80E`, `declared80EEA`, `declared80G`
- `previousEmployer`.
- `locked` and `lockedAt`. A locked declaration cannot be edited through `POST /tax-declaration`.

Index: **unique** `{ userId, orgId, fy }`. `timestamps: true`.

## Exports
- `TeamforceEmployeeTaxDeclaration` - the Mongoose model `"TeamforceEmployeeTaxDeclaration"` (collection `teamforceemployeetaxdeclarations`).

## Interfaces
- **Database:** `TeamforceEmployeeTaxDeclaration` (collection `teamforceemployeetaxdeclarations`).
  - Upserted, locked and unlocked by the tax-declaration router.
  - Read by the payroll run engine.
- **Endpoints served (by the router that uses it):**
  - `GET` and `POST /backend/teamforce/tax-declaration`
  - `POST /backend/teamforce/tax-declaration/lock` and `POST .../unlock` (unlock needs founder or Teamforce admin)
  - `GET .../org-summary` and `GET .../regime-preview`

## Dependencies
- **Packages:** `mongoose` - `Schema`, `model`, `Types`.

## Used by
- `server/routes/teamforce/taxDeclaration.ts`, mounted at `/teamforce/tax-declaration`.
- `server/routes/teamforce/payrollRuns.ts`, which looks up the declaration for the run's FY (`getFYString`).

## Notes
- The FY string format must match what `getFYString` produces. A declaration saved under a differently formatted `fy` is never found, and payroll silently uses the New regime with no deductions.
- Admins can edit another employee's declaration by passing `?userId=`, but only while it is unlocked.
