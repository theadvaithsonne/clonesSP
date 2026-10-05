# `components/nc-admin/nc-admin-gate.tsx`

> Blocks the NetworkChains admin section until elevation resolves.

**Kind:** React component · **Lines:** 112 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Blocks the NetworkChains admin section until elevation resolves.

The NC data hooks gate on `enabled: !!token`, and elevation is async, so
children must not mount until it resolves. Same shape as the NC app's
app/(admin)/layout.tsx, minus the OTP branch: a Garage operator who isn't an
allowlisted garage-super-admin gets a plain refusal, never an OTP prompt.

`ensureNcAdminToken()` resolves an `NcElevationResult`
(`{ ok: true; token } | { ok: false; reason: "unauthorized" | "unavailable" }`)
rather than a plain `string | null` — the two failure reasons are
deliberately distinct and must not be collapsed:
  - "unauthorized" — the operator genuinely isn't an allowlisted
    garage-super-admin. Render the refusal panel.
  - "unavailable" — contacts-backend is unreachable/erroring (or there was
    no Garage session to elevate from). Render a different panel with a
    retry affordance; never tell the operator they lack access when the […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2` (lucide-react), `ShieldCheck` (lucide-react), `WifiOff` (lucide-react), `RotateCw` (lucide-react)

### Props

- **`NcAdminGate`**: `children: ReactNode`

**Hooks used:** `useState`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `NcAdminGate` | component | `NcAdminGate({ children }: { children: ReactNode })` | 40 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/nc-admin-api/auth.ts` — `ensureNcAdminToken`, `NcElevationResult`
- **Packages:**
  - `react` — `useEffect`, `useState`, `ReactNode`
  - `lucide-react` — `Loader2`, `RotateCw`, `ShieldCheck`, `WifiOff`

## Used by

- `app/garage-admin/(admin-dashboard)/networkchains/layout.tsx`
