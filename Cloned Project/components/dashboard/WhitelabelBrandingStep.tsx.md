# `components/dashboard/WhitelabelBrandingStep.tsx`

> Step 2 of the whitelabel setup wizard: brand colours.

**Kind:** React component · **Lines:** 407 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Step 2 of the whitelabel setup wizard: brand colours.

Reads and writes the same GET/PUT /org/:orgId/branding that the Office
Settings → Branding page uses, so whichever surface the founder touches
last wins and both stay in sync.

The right-hand panel is a miniature of the workspace chrome — top bar,
sidebar, a card and a primary button — repainted live as the colours
change, so the founder sees the result before saving.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `ColorField`×2 (local), `BrandPreview` (local), `WizardCard` (components/dashboard/WhitelabelWizardShell.tsx)

### Props

- **`WhitelabelBrandingStep`**: `onNext?: () => void`, `onSkip?: () => void`

**Hooks used:** `useState`×4, `useEffect`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (WhitelabelBrandingStep)` | component | `WhitelabelBrandingStep({ onNext, onSkip, }: { onNext?: () => void; onSkip?: () => …)` | 235 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/org/${orgId}/branding` (L259)
  - `PUT /backend/org/${orgId}/branding` (L302)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/brand-color-context.tsx` — `notifyBrandingChanged`
  - `lib/utils.ts` — `cn`
  - `components/dashboard/WhitelabelWizardShell.tsx` — `WizardCard`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `Loader2`
  - `sonner` — `toast`

## Used by

- `components/dashboard/WhitelabelSetupWizard.tsx`
