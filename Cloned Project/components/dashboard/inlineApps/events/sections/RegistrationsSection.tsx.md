# `components/dashboard/inlineApps/events/sections/RegistrationsSection.tsx`

> React component `RegistrationsSection`.

**Kind:** React component · **Lines:** 325 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `Search` (lucide-react), `EmptyState` (components/dashboard/inlineApps/events/ui.tsx), `UserCheck` (lucide-react), `Share2` (lucide-react), `Check` (lucide-react), `X` (lucide-react), `QrCode` (lucide-react), `UserX` (lucide-react)

### Props

- **`RegistrationsSection`**: `eventId: string`, `onChanged?: () => void`

**Hooks used:** `useState`×6, `useCallback`, `useEffect`, `useConsoleAction` (components/dashboard/inlineApps/events/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (RegistrationsSection)` | component | `RegistrationsSection({ eventId, onChanged, }: { eventId: string; onChanged?: () …)` | 53 |

## Interfaces

- **Timers / queues:** `setTimeout` at L85

## Dependencies

- **Internal:**
  - `lib/auth.ts` — `getToken`
  - `components/dashboard/inlineApps/events/ui.tsx` — `Button`, `EmptyState`, `GOLD`, `formatMoney`, `useConsoleAction`
  - `components/dashboard/inlineApps/events/api.ts` — `approveRegistration`, `checkInRegistration`, `listRegistrations`, `registrationsExportUrl`, `rejectRegistration`
  - `components/dashboard/inlineApps/events/types.ts` — `EventRegistration`, `RegistrationStatus`, `(types only)`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `lucide-react` — `Check`, `Loader2`, `Search`, `Share2`, `UserCheck`, `UserX`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/events/EventConsole.tsx`
