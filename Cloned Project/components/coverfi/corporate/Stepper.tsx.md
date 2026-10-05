# `components/coverfi/corporate/Stepper.tsx`

> A horizontal four-step progress indicator for the Coverfi "new corporate" wizard, with optional click-to-jump on completed steps.

**Kind:** React component · **Lines:** 73

## Purpose
The Coverfi corporate onboarding flow is split into four server-side steps (basic info, address, employees, products and finalize). This file holds the step labels and the breadcrumb-style stepper that both the step-1 page and the step 2-4 wizard render, so they show the same step names and numbering.

## How it works
- `STEP_LABELS` is a `const` tuple of the four labels; the stepper renders one `<li>` per label with a chevron between items.
- For each 1-indexed step `n`:
  - **complete** when `done >= n` (shown in brand colour with a check mark instead of the number, unless it is also active);
  - **active** when `current === n` (highlighted pill with border);
  - **clickable** only when an `onJump` callback is passed, the step is complete and it is not the active one. Clickable steps are wrapped in a `<button>` that calls `onJump(n)`.
- `done` mirrors the backend's `Corporate.step_completed` (0 means step 1 has not been submitted yet), so you can only jump back to steps the server already accepted, never forward.

## Exports
- `STEP_LABELS` - `readonly ["Basic info", "Address", "Employees", "Products & finalize"]`.
- `Stepper({ current, done, onJump? })` - `current`: displayed step (1-4); `done`: highest completed step (0-4); `onJump(step)`: optional handler that makes completed steps clickable.

## Dependencies
- **Internal:** `lib/utils.ts` - `cn()` class merging.
- **Packages:** `lucide-react` - `Check` and `ChevronRight` icons.

## Used by
- `components/coverfi/corporate/CorporateStep1Form.tsx` - renders `<Stepper current={1} done={0} />` (no jumping) and uses `STEP_LABELS.length` in the "Step 1 of N" text.
- `components/coverfi/corporate/CorporateWizard.tsx` - renders it with `onJump` so the user can return to completed steps.

## Notes
- Step 1 is never re-editable through the stepper: in the wizard, jumping to step 1 sets `currentStep` to 1, but the wizard has no step-1 view (it only renders steps 2-4), so the content area goes blank. Editing basic info after creation happens on the detail page's Info tab instead.
