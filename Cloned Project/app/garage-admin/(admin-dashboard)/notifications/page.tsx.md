# `app/garage-admin/(admin-dashboard)/notifications/page.tsx`

> Notifications — Admin → Notifications.

**Kind:** Next.js page · **Lines:** 673 · **Directive:** `"use client"` · **Route:** `/garage-admin/notifications` (page)

<!-- docgen:auto -->

## Purpose
Notifications — Admin → Notifications.

Rules that say "when X happens, mail Y". Both halves are configured here
rather than coded: conditions are a boolean tree over the event's payload,
and recipients are resolved per event.

Backend: GET/POST/PATCH/DELETE /garage-admin/notifications/rules, with the
event catalogue at /events. The condition builder renders entirely from
that catalogue, so a new event shows up here with no change to this file.

Delivery is NOT built yet. A rule can be created and enabled, but nothing
evaluates or sends — see the spec's phasing. The banner below says so
rather than letting an admin assume mail is going out.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Field`×4 (local), `Loader2`×3 (lucide-react), `Bell`×2 (lucide-react), `Plus`×2 (lucide-react), `X`×2 (lucide-react), `AlertTriangle` (lucide-react), `EmptyState` (local), `RuleRow` (local), `RuleBuilder` (local), `Trash2` (lucide-react), `LeafRow` (local), `Search` (lucide-react)

**Hooks used:** `useState`×13, `useMemo`×2, `useAdminAccess` (components/garage-admin/use-admin-access.ts), `useAdminSearch` (components/garage-admin/admin-search.tsx), `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AdminNotificationsPage)` | component | `AdminNotificationsPage()` | 53 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/admin-api/notifications.ts` — `listEvents`, `listRules`, `createRule`, `updateRule`, `deleteRule`, `resolveUser`, `AdminEventDescriptor`, `AdminNotificationRule`, … +3
  - `components/garage-admin/use-admin-access.ts` — `useAdminAccess`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `Bell`, `Plus`, `Trash2`, `Loader2`, `X`, `Search`, …

## Used by

Entry: reached by the Next.js router at `/garage-admin/notifications` (page).
