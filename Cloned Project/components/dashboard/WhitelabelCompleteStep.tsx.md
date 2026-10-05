# `components/dashboard/WhitelabelCompleteStep.tsx`

> Step 4 of the whitelabel setup wizard: the receipt.

**Kind:** React component · **Lines:** 247 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Step 4 of the whitelabel setup wizard: the receipt.

Reads the three things the earlier steps wrote — app domain, branding
colours, email domain — straight back from the API rather than from
wizard state, so a founder who skipped a step (or finished it in Office
Settings a week ago) sees what's actually true, not what this session
happened to do.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `SummaryRow`×3 (local), `WizardProgress` (components/dashboard/WhitelabelWizardShell.tsx), `Loader2` (lucide-react), `Check` (lucide-react)

### Props

- **`WhitelabelCompleteStep`**: `onBackToSettings?: () => void`

**Hooks used:** `useState`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (WhitelabelCompleteStep)` | component | `WhitelabelCompleteStep({ onBackToSettings, }: { onBackToSettings?: () => void; })` | 77 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/initial-setup/app-domains?orgId=${orgId}` (L97)
  - `GET /backend/org/${orgId}/branding` (L100)
  - `GET /backend/initial-setup/domain-config?orgId=${orgId}` (L103)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/utils.ts` — `cn`
  - `components/dashboard/WhitelabelWizardShell.tsx` — `WizardProgress`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `Check`, `Loader2`

## Used by

- `components/dashboard/WhitelabelSetupWizard.tsx`
