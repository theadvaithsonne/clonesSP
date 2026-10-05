# `app/garage-admin/(admin-dashboard)/networkchains/posthog/page.tsx`

> Admin session-replay viewer.

**Kind:** Next.js page · **Lines:** 531 · **Directive:** `"use client"` · **Route:** `/garage-admin/networkchains/posthog` (page)

<!-- docgen:auto -->

## Purpose
Admin session-replay viewer. Lists PostHog recordings from contacts-backend's
/admin/posthog/* proxy and plays the selected one IN-PANEL via PostHog's own
player (an iframe fed by an on-demand sharing token from /embed). The personal
API key never reaches the browser — the backend holds it.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×4 (lucide-react), `StatCard`×3 (local), `MonitorPlay`×2 (lucide-react), `UnavailableCard` (local), `ProductSwitch` (components/nc-admin/product-switch.tsx), `DeviceSwitch` (components/nc-admin/device-switch.tsx), `MousePointerClick` (lucide-react), `Keyboard` (lucide-react), `AlertOctagon` (lucide-react), `Check` (lucide-react), `Link2` (lucide-react), `ExternalLink` (lucide-react), `SessionExceptions` (local), `AlertTriangle` (lucide-react)

**Hooks used:** `useState`×16, `useCallback`×4, `useEffect`×3, `useRef`×2, `useAdminSearch` (components/garage-admin/admin-search.tsx), `useAdminProduct` (lib/admin/product.ts), `useAdminDevice` (lib/admin/product.ts), `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AdminPostHogPage)` | component | `AdminPostHogPage()` | 60 |

## Interfaces

- **Timers / queues:** `setTimeout` at L121, L365

## Dependencies

- **Internal:**
  - `lib/nc-admin-api/admin-posthog.ts` — `listRecordings`, `getEmbed`, `listSessionExceptions`, `getStats`, `PostHogUnavailableError`, `SessionException`, `PostHogRecording`, `PostHogStats`
  - `lib/nc-admin-api/admin.ts` — `AdminUnauthorizedError`
  - `lib/nc-admin-api/auth.ts` — `ensureNcAdminToken`
  - `lib/admin/product.ts` — `useAdminProduct`, `useAdminDevice`, `appsFor`
  - `components/nc-admin/product-switch.tsx` — `ProductSwitch`
  - `components/nc-admin/device-switch.tsx` — `DeviceSwitch`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `AlertOctagon`, `AlertTriangle`, `Check`, `ExternalLink`, `Keyboard`, `Link2`, …

## Used by

Entry: reached by the Next.js router at `/garage-admin/networkchains/posthog` (page).
