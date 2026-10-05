# `lib/hooks/useOrgShareOrigin.ts`

> React hook `useOrgShareOrigin`.

**Kind:** React hook · **Lines:** 85 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useState`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useOrgShareOrigin` | hook | `useOrgShareOrigin(orgIdOverride?: string \| null): string` | 31 |
| `fetchOrgShareOrigin` | function | `async fetchOrgShareOrigin(orgIdOverride?: string \| null): Promise<string>` — One-shot form of the hook, for code that needs the origin at a moment (a popup opening) rather than for a whole render. | 70 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/initial-setup/share-origin?orgId=${encodeURIComponent(orgId)}` (L45)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
- **Packages:**
  - `react` — `useEffect`, `useState`

## Used by

- `components/dashboard/RightPanel.tsx`
- `components/dashboard/WorkshopsPage.tsx`
- `components/dashboard/inlineApps/events/browse-ui.tsx`
- `components/shared/GuestFunnelDialog.tsx`
- `components/shared/SellablePublishedModal.tsx`
