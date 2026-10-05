# `components/dashboard/WhitelabelSetupWizard.tsx`

> Container for the whitelabel setup wizard.

**Kind:** React component · **Lines:** 93 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Container for the whitelabel setup wizard. Owns which step is on screen
and nothing else — each step fetches and saves its own data, so a
founder who leaves halfway and comes back lands on the right screen
from server state rather than from wizard memory.

  Step 1 — Domain   (WhitelabelDomainWizard)
  Step 2 — Branding (WhitelabelBrandingStep)
  Step 3 — Email    (WhitelabelEmailStep)
  Step 4 — Done     (WhitelabelCompleteStep)

Skipping is a first-class path: every step's left-hand action moves
forward without saving, and step 4 reads the real state, so a skipped
step shows up honestly on the summary instead of being claimed as done.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `WhitelabelCompleteStep` (components/dashboard/WhitelabelCompleteStep.tsx), `WhitelabelEmailStep` (components/dashboard/WhitelabelEmailStep.tsx), `WhitelabelBrandingStep` (components/dashboard/WhitelabelBrandingStep.tsx), `WhitelabelDomainWizard` (components/dashboard/WhitelabelDomainWizard.tsx)

### Props

- **`WhitelabelSetupWizard`**: `setActivePopover?: (popover: string | null) => void`

**Hooks used:** `useState`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (WhitelabelSetupWizard)` | component | `WhitelabelSetupWizard({ setActivePopover, }: { setActivePopover?: (popover: strin…)` | 24 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/initial-setup/app-domains?orgId=${orgId}` (L43)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `components/dashboard/WhitelabelDomainWizard.tsx` — `WhitelabelDomainWizard (default)`
  - `components/dashboard/WhitelabelBrandingStep.tsx` — `WhitelabelBrandingStep (default)`
  - `components/dashboard/WhitelabelEmailStep.tsx` — `WhitelabelEmailStep (default)`
  - `components/dashboard/WhitelabelCompleteStep.tsx` — `WhitelabelCompleteStep (default)`
- **Packages:**
  - `react` — `useEffect`, `useState`

## Used by

- `components/dashboard/WhitelabelPage.tsx`
