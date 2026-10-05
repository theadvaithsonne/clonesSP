# `components/shared/OpenInAppGate.tsx`

> React component `OpenInAppGate`.

**Kind:** React component · **Lines:** 544 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Smartphone`×3 (lucide-react), `Image` (next/image), `Apple` (lucide-react), `Loader2` (lucide-react)

### Props

- **`OpenInAppGate`**: `children: React.ReactNode`

**Hooks used:** `useState`×10, `useMemo`×5, `useEffect`×4, `usePathname` (next/navigation), `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OpenInAppGate)` | component | `OpenInAppGate({ children }: OpenInAppGateProps)` — Mobile gate for all Garage HQ routes. | 105 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/affiliate/referrer-info?affiliateId=${encodeURIComponent(
        referCode
      )}&light=1` (L143)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_IOS_APP_STORE_URL`, `NEXT_PUBLIC_ANDROID_PLAY_STORE_URL`
- **External hosts mentioned in the code:** `apps.apple.com`, `play.google.com`

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/whitelabel.ts` — `fetchWhitelabelOrg`
  - `lib/bat246Office.ts` — `isBat246Domain`
  - `lib/installIntent.ts` — `playReferrer`, `refInstallLink`, `registerInstallIntent`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `next` — `usePathname`
  - `lucide-react` — `Apple`, `Smartphone`, `Loader2`

## Used by

- `app/layout.tsx`
