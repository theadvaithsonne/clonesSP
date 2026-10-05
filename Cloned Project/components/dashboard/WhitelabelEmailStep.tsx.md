# `components/dashboard/WhitelabelEmailStep.tsx`

> Step 3 of the whitelabel setup wizard: where outbound mail comes from.

**Kind:** React component · **Lines:** 557 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Step 3 of the whitelabel setup wizard: where outbound mail comes from.

Two branches, both persisted through POST /initial-setup/domain-config:

  default → Garage sends as networkmail.com, nothing to configure, and
            the step is done the moment it's saved.
  custom  → the BE mints five records (MX, SPF, DMARC, autodiscover,
            autoconfig) that the founder adds at their registrar, then
            POST /initial-setup/verify-dns confirms propagation.

Verification is deliberately allowed to fail partially: DNS lands one
record at a time, so a 2-of-5 result is normal ten minutes in and gets
its own "try again" screen rather than a generic error.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×3 (lucide-react), `OptionCard`×2 (local), `WizardCard` (components/dashboard/WhitelabelWizardShell.tsx), `DnsRecordRow` (components/dashboard/WhitelabelWizardShell.tsx)

### Props

- **`WhitelabelEmailStep`**: `onNext?: () => void`, `onSkip?: () => void`, `appDomain?: string`

**Hooks used:** `useState`×9, `useEffect`×3, `useCallback`×2, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EmailDomainConfig` | type |  | 29 |
| `default (WhitelabelEmailStep)` | component | `WhitelabelEmailStep({ onNext, onSkip, /** Root domain from step 1, used to pref…)` | 113 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/initial-setup/domain-config?orgId=${orgId}` (L144)
  - `POST /backend/initial-setup/domain-config` (L208)
  - `POST /backend/initial-setup/verify-dns` (L249)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setInterval` at L307

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/utils.ts` — `cn`
  - `components/dashboard/WhitelabelWizardShell.tsx` — `DnsRecordRow`, `WizardCard`, `formatRecordsForClipboard`, `WizardDnsRecord`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`
  - `lucide-react` — `Loader2`
  - `sonner` — `toast`

## Used by

- `components/dashboard/WhitelabelSetupWizard.tsx`
