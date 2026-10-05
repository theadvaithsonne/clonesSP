# `components/dashboard/PendingRequestsPage.tsx`

> React component `PendingRequestsPage`.

**Kind:** React component · **Lines:** 371 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×4 (components/ui/button.tsx), `CardContent`×3 (components/ui/card.tsx), `CheckCircle2`×3 (lucide-react), `Loader2`×2 (lucide-react), `Sparkles`×2 (lucide-react), `Card`×2 (components/ui/card.tsx), `Avatar`×2 (components/ui/avatar.tsx), `AvatarFallback`×2 (components/ui/avatar.tsx), `XCircle`×2 (lucide-react), `UserPlus` (lucide-react), `CardHeader` (components/ui/card.tsx), `CardTitle` (components/ui/card.tsx), `Mail` (lucide-react), `Clock` (lucide-react), `MessageSquare` (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `DialogFooter` (components/ui/dialog.tsx)

**Hooks used:** `useState`×6, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (PendingRequestsPage)` | component | `PendingRequestsPage()` | 52 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/join-requests/pending?orgId=${orgId}` (L75)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getUserDataFromToken`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `components/ui/badge.tsx` — `Badge`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Building2`, `Clock`, `CheckCircle2`, `XCircle`, `Loader2`, `Mail`, …
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/ManagementPage.tsx`
