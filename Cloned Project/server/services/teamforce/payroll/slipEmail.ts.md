# `server/services/teamforce/payroll/slipEmail.ts`

> Salary slip email — renders a self-contained HTML email and sends via the existing Resend-backed mailer.

**Kind:** backend service · **Lines:** 193

<!-- docgen:auto -->

## Purpose
Salary slip email — renders a self-contained HTML email and sends via the
existing Resend-backed mailer. Tone: clean, neutral, white-bg (the dark
Teamforce theme is for the in-app drawer; emails should be friendly).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `sendSalarySlipEmail` | function | `async sendSalarySlipEmail(input: SlipEmailInput)` | 53 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/mailer.ts` — `sendMail`, `EMAIL_FROM_NOTIFICATION`
- **Packages:** none

## Used by

- `server/routes/teamforce/payrollRuns.ts`
