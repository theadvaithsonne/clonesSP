# `app/(dashboard)/coverfi/corporate/[id]/page.tsx`

> Dynamic route that unwraps the corporate id and renders the corporate setup wizard (steps 2-4) for that record.

**Kind:** Next.js page · **Lines:** 14 · **Route:** `/coverfi/corporate/[id]`

## Purpose
After step 1 creates a corporate at `/coverfi/corporate/new`, the user continues here. `CorporateWizard` loads the corporate with `getCorporate(corporateId)` and resumes at the next incomplete step, based on `step_completed`, clamped between step 2 and step 4. A fully completed corporate opens at step 4.

## How it works
- A client component.
- `params: Promise<{ id: string }>` is unwrapped with React's `use(params)`. The page renders `<CorporateWizard corporateId={id} />`.

## Exports
- `default CorporateIdPage({ params })` - `params: Promise<{ id: string }>`.

## Dependencies
- **Internal:** `components/coverfi/corporate/CorporateWizard.tsx` - the stepper for address, employees and products. It talks to the external Coverfi API under `/v1/coverfi/corporate`.
- **Packages:** `react` (`use`).

## Used by
No file imports it. It is reached at `/coverfi/corporate/<id>`, from the redirect in `CorporateStep1Form` and from `CorporateList`.
