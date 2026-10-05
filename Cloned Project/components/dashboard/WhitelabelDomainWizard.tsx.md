# `components/dashboard/WhitelabelDomainWizard.tsx`

> Step 1 of the whitelabel setup wizard: point a custom domain at Garage.

**Kind:** React component · **Lines:** 492 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Step 1 of the whitelabel setup wizard: point a custom domain at Garage.

Rendered by WhitelabelPage once the add-on is active. Three sub-states,
driven entirely by what GET /initial-setup/app-domains already knows:

  input        → no domain registered yet, founder types one
  dns_pending  → domain registered with Vercel, DNS not resolving yet
  dns_verified → records detected, workspace is live on the domain

The backend endpoints are the same ones DomainManagementPage uses, so a
domain added here shows up there (and vice versa) with no migration.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×3 (lucide-react), `WizardCard` (components/dashboard/WhitelabelWizardShell.tsx), `Input` (components/ui/input.tsx), `DnsRecordRow` (components/dashboard/WhitelabelWizardShell.tsx)

### Props

- **`WhitelabelDomainWizard`**: `setActivePopover?: (popover: string | null) => void`, `onNext?: () => void`, `onSkip?: () => void`

**Hooks used:** `useState`×9, `useCallback`×3, `useEffect`×2, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DnsRecord` | type |  | 27 |
| `AppDomain` | type |  | 35 |
| `default (WhitelabelDomainWizard)` | component | `WhitelabelDomainWizard({ setActivePopover, onNext, onSkip, }: { setActivePopover?:…)` | 92 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/initial-setup/app-domains?orgId=${orgId}` (L132)
  - `POST /backend/initial-setup/add-app-domain` (L175)
  - `POST /backend/initial-setup/verify-app-domain` (L207)
  - `DELETE /backend/initial-setup/app-domain` (L257)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setInterval` at L247

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `components/ui/input.tsx` — `Input`
  - `lib/utils.ts` — `cn`
  - `components/dashboard/WhitelabelWizardShell.tsx` — `DnsRecordRow`, `WizardCard`, `formatRecordsForClipboard`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`
  - `lucide-react` — `Loader2`
  - `sonner` — `toast`

## Used by

- `components/dashboard/WhitelabelSetupWizard.tsx`
