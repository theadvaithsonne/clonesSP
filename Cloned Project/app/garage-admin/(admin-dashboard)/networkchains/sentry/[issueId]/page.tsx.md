# `app/garage-admin/(admin-dashboard)/networkchains/sentry/[issueId]/page.tsx`

> Next.js page rendered at `/garage-admin/networkchains/sentry/[issueId]`.

**Kind:** Next.js page · **Lines:** 325 · **Directive:** `"use client"` · **Route:** `/garage-admin/networkchains/sentry/[issueId]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Shell`×3 (local), `ExternalLink`×2 (lucide-react), `Panel`×2 (components/nc-admin/sentry/event-panels.tsx), `Loader2` (lucide-react), `UnavailableState` (components/nc-admin/sentry/unavailable-state.tsx), `User` (lucide-react), `Monitor` (lucide-react), `StackTrace` (components/nc-admin/sentry/stack-trace.tsx), `BreadcrumbsPanel` (components/nc-admin/sentry/event-panels.tsx), `TagsPanel` (components/nc-admin/sentry/event-panels.tsx), `ContextsPanel` (components/nc-admin/sentry/event-panels.tsx), `RequestPanel` (components/nc-admin/sentry/event-panels.tsx), `UserPanel` (components/nc-admin/sentry/event-panels.tsx), `RawJsonPanel` (components/nc-admin/sentry/event-panels.tsx), `ArrowLeft` (lucide-react)

### Props

- **`AdminSentryIssuePage`**: `params: Promise<{ issueId: string }>`

**Hooks used:** `useState`×6, `useCallback`×4, `useRouter` (next/navigation), `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AdminSentryIssuePage)` | component | `AdminSentryIssuePage({ params, }: { params: Promise<{ issueId: string }>; })` | 38 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/nc-admin-api/admin-sentry.ts` — `getIssue`, `getLatestEvent`, `replayIdOf`, `issueReplaysUrl`, `getEvent`, `listEvents`, `exceptionValues`, `breadcrumbs`, … +8
  - `lib/nc-admin-api/admin.ts` — `AdminUnauthorizedError`
  - `lib/nc-admin-api/auth.ts` — `ensureNcAdminToken`
  - `components/nc-admin/sentry/stack-trace.tsx` — `StackTrace`
  - `components/nc-admin/sentry/event-panels.tsx` — `Panel`, `TagsPanel`, `ContextsPanel`, `UserPanel`, `RequestPanel`, `BreadcrumbsPanel`, `RawJsonPanel`
  - `components/nc-admin/sentry/unavailable-state.tsx` — `UnavailableState`
- **Packages:**
  - `react` — `use`, `useCallback`, `useEffect`, `useRef`, `useState`
  - `next` — `useRouter`
  - `lucide-react` — `ArrowLeft`, `ExternalLink`, `Loader2`, `Monitor`, `User`

## Used by

Entry: reached by the Next.js router at `/garage-admin/networkchains/sentry/[issueId]` (page).
