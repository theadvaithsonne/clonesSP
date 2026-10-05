# `components/coverfi/corporate/CorporateWizard.tsx`

> The client-side controller for one Coverfi corporate: it loads the corporate, resumes the onboarding wizard at steps 2-4, and switches to the tabbed detail view once onboarding is finalized.

**Kind:** React component · **Lines:** 120

## Purpose
A Coverfi "corporate" is an enterprise client of a brokerage whose employees are enrolled in insurance products. Creation is a four-step server workflow: step 1 (`CorporateStep1Form`) creates the record and redirects to `/coverfi/corporate/<id>`, where this component takes over. It decides, from the corporate's `step_completed` counter, whether to show the remaining wizard steps or the finished-corporate detail screen.

## How it works
- **Loading:** on mount and whenever `corporateId` changes, `reload()` calls `getCorporate(corporateId)`. While loading it shows a spinner; if the fetch fails (`corporate` stays `null`) it shows "Couldn't load this corporate. It may have been removed." and a toast with the error.
- **Resume step:** `reload()` sets `currentStep` to `step_completed + 1`, clamped to 2..4 (a missing/zero counter is treated as 1, so the wizard opens on step 2).
- **Finalized:** if `step_completed >= 4` it renders `CorporateDetail` with `onReload={reload}` and nothing else.
- **Wizard mode:** renders a back link to `/coverfi/corporate`, the corporate's display/legal name, a `Stepper` (with `onJump` so completed steps can be revisited) and one step body:
  - Step 2 `CorporateStep2Address` - on save stores the returned corporate and advances to 3; its Back button navigates to `/coverfi/corporate/new` (which starts a fresh step-1 form rather than editing this corporate).
  - Step 3 `CorporateStep3Employees` - on save advances to 4; Back goes to 2.
  - Step 4 `CorporateStep4Products` - on finish shows "Corporate finalized" and calls `reload()`, which sees `step_completed >= 4` and flips the screen to detail mode.

## Exports
- `default CorporateWizard({ corporateId }: { corporateId: string })` - full-page corporate view.

## Interfaces
- **Backend endpoints called (via `lib/coverfi/corporate-api.ts`, external Coverfi API):** `GET {NEXT_PUBLIC_COVERFI_API_URL}/v1/coverfi/corporate/:id` - load the corporate. The step components make the step 2-4 calls.

## Dependencies
- **Internal:** `./Stepper` - progress indicator; `./CorporateStep2Address`, `./CorporateStep3Employees`, `./CorporateStep4Products` - step bodies; `./CorporateDetail` - finalized view; `lib/coverfi/corporate-api.ts` - `getCorporate`; `lib/coverfi/types.ts` - `Corporate` type.
- **Packages:** `next` (`useRouter`, `Link`), `react`, `lucide-react` (icons), `sonner` (toasts).

## Used by
- `app/(dashboard)/coverfi/corporate/[id]/page.tsx` - route `/coverfi/corporate/[id]`.

## Notes
- Jumping to step 1 through the stepper sets `currentStep` to 1, for which no body is rendered (blank content area).
- The Coverfi backend is not part of this repository; see `lib/coverfi/api.ts` (`COVERFI_API_URL`, default `http://localhost:4100`, Bearer token from `lib/auth`).
