# `app/(onboarding)/layout.tsx`

> Licence guard for the whole onboarding group.

**Kind:** Next.js layout · **Lines:** 146 · **Directive:** `"use client"` · **Route:** `/` (layout)

<!-- docgen:auto -->

## Purpose
Licence guard for the whole onboarding group.

There was no layout for `(onboarding)` before, which is exactly why nothing
gated office creation: each page was reachable directly. One layout here
covers every entry point, because all five funnel into this group —
the new-signup redirect, the whitelabel-upgrade branch, select-organization's
"Create Workspace", office-payment's `?newOffice=true`, and the sidebar's
"Launch An Office". None of them can reach the office form without passing
through this file.

It RENDERS the gate over the page rather than redirecting: a redirect would
lose the query params the flow depends on (`userId`, `plan`, `redirect`,
`newOffice`), so the user would come back from checkout to a different
screen than the one they left.

SCOPE: only routes that actually CREATE an office. This group also holds […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2` (lucide-react), `LicenceGateContext` (local), `UnilevelLicenceGate` (components/onboarding/UnilevelLicenceGate.tsx)

### Props

- **`OnboardingLayout`**: `children: React.ReactNode`

**Hooks used:** `useState`×3, `useContext`, `usePathname` (next/navigation), `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useLicenceGate` | hook | `useLicenceGate()` | 55 |
| `default (OnboardingLayout)` | component | `OnboardingLayout({ children, }: { children: React.ReactNode; })` | 74 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/auth.ts` — `getToken`, `getUserDataFromToken`
  - `lib/webinar/garage-store-plans.ts` — `getUnilevelPlusProduct`
  - `components/onboarding/UnilevelLicenceGate.tsx` — `UnilevelLicenceGate (default)`
- **Packages:**
  - `react` — `createContext`, `useCallback`, `useContext`, `useEffect`, `useState`
  - `next` — `usePathname`
  - `lucide-react` — `Loader2`

## Used by

- `app/(onboarding)/organization/page.tsx`

Entry: reached by the Next.js router at `/` (layout).
