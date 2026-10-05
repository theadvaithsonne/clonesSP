# `server/models/teamforce/teamforceBreakSettings.model.ts`

> Mongoose model for a Teamforce break policy: the daily break budget, which employees it covers and how breaches are meant to affect payroll.

**Kind:** Mongoose model · **Lines:** 54

## Purpose
An organisation can define several named break policies. Each one has a daily budget in minutes and a scope: everyone, selected departments or selected designations. The Betty break endpoints refuse to start a break unless an activated policy applies to the user, and the budget decides how break logs are split into within-budget and over-budget time.

## How it works
- `BREAK_SCOPE_TYPES = ["Universal", "By Department", "By Designation"]`.
- Embedded `PayrollImpactSchema` (no `_id`): `deductHalfDay`, `deductHourly { enabled, ofBasic, ofCtc }`, `fixedAmount`.
- Main fields: `orgId` (required, indexed), `name` (required), `activateBreaks` (default `false`), `scopeType` (enum, default `"Universal"`), `scopeTargets` (string array: department ObjectId strings for "By Department", designation names for "By Designation"), `breakMinutesPerDay` (default 60), `breachAffectsPayroll`, `maxBreachMinutesAllowed`, `maxBreachesAllowed`, `payrollImpact` (defaults to an empty sub-document).
- Index: **unique** `{ orgId, name }`, so a policy name is unique within its organisation.

How the policy is chosen (`findApplicablePolicy` in `routes/teamforce/breakSettings.ts`): only policies with `activateBreaks: true` are considered. A Universal policy always matches. "By Department" matches the profile's `departmentId`, and "By Designation" matches the profile's `designation`. When several match, the most specific scope wins (Designation > Department > Universal), with ties broken alphabetically by name.

## Exports
- `BREAK_SCOPE_TYPES` - the readonly tuple of scope types. The router's zod schema validates against it.
- `TeamforceBreakSettings` - the Mongoose model `"TeamforceBreakSettings"` (collection `teamforcebreaksettings`).

## Interfaces
- **Database:** `TeamforceBreakSettings` (collection `teamforcebreaksettings`), read and written by the break-settings router and read indirectly by `routes/betty.ts`.

## Dependencies
- **Packages:** `mongoose` - `Schema`, `model`, `Types`.

## Used by
- `server/routes/teamforce/breakSettings.ts`, mounted at `/teamforce/break-settings` (browser: `GET|POST /backend/teamforce/break-settings`, `PATCH|DELETE /backend/teamforce/break-settings/:id`, `GET /backend/teamforce/break-settings/status`).
- On the frontend, edited in `components/dashboard/inlineApps/teamforce/sections/SettingsSection.tsx`.

## Notes
- `breachAffectsPayroll`, `maxBreach*` and `payrollImpact` are stored and edited, but the payroll engine (`routes/teamforce/payrollRuns.ts` and `services/teamforce/payroll/*`) does not read them. Breaches currently have no effect on pay.
- Deleting a policy is a hard delete (`findOneAndDelete`), unlike most other Teamforce masters.
