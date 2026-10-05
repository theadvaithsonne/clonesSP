# `components/dashboard/BettyDashboardPage.tsx`

> React component `BettyDashboardPage`.

**Kind:** React component · **Lines:** 1714 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×12 (components/ui/button.tsx), `Input`×8 (components/ui/input.tsx), `Bot`×2 (lucide-react), `AnimatePresence`×2 (framer-motion), `HeadingTag` (local), `Send` (lucide-react), `Plus` (lucide-react), `Select` (components/ui/select.tsx), `SelectTrigger` (components/ui/select.tsx), `SelectValue` (components/ui/select.tsx), `SelectContent` (components/ui/select.tsx), `SelectItem` (components/ui/select.tsx), `RefreshCw` (lucide-react), `Badge` (components/ui/badge.tsx), `Pencil` (lucide-react), `OnlineActivityTab` (components/dashboard/OnlineActivityTab.tsx), `X` (lucide-react), `AIProviderRequiredModal` (components/dashboard/AIProviderRequiredModal.tsx)

**Hooks used:** `useState`×20, `useMemo`×6, `useEffect`×4, `useAmIFounder` (lib/hooks/useAmIFounder.ts), `useAIProvider` (lib/hooks/useAIProvider.ts), `useRef`, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (BettyDashboardPage)` | component | `BettyDashboardPage()` | 217 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/betty/time-tracking?orgId=${orgId}` (L275)
  - `GET /backend/betty/my-leave-requests?orgId=${orgId}` (L287)
  - `GET /backend/betty/chat-history?orgId=${orgId}` (L299)
  - `GET /backend/betty/org-time-tracking?${params.toString()}` (L390)
  - `POST /backend/betty/chat?orgId=${orgId}` (L490)
  - `POST /backend/betty/leave-requests?orgId=${orgId}` (L542)
  - `PATCH /backend/betty/time-tracking/${editingEntry.id}?orgId=${orgId}` (L788)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/badge.tsx` — `Badge`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `lib/hooks/useAIProvider.ts` — `useAIProvider`
  - `components/dashboard/OnlineActivityTab.tsx` — `OnlineActivityTab (default)`
  - `components/dashboard/AIProviderRequiredModal.tsx` — `AIProviderRequiredModal (default)`
  - `components/dashboard/AIProviderSelector.tsx` — `AIProviderSelector (default)`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`, `useRef`, `useCallback`
  - `framer-motion` — `motion`, `AnimatePresence`
  - `lucide-react` — `Clock`, `Bot`, `Calendar`, `Send`, `Plus`, `CalendarCheck`, …
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/layout.tsx`

## Notes

- Large file (1714 lines) — read it by section; line numbers above point into it.
