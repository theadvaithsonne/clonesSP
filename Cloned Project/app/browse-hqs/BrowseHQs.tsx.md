# `app/browse-hqs/BrowseHQs.tsx`

> React component `BrowseHQs`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 243 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/ui/button.tsx), `Card`×2 (components/ui/card.tsx), `Building2`×2 (lucide-react), `Clock` (lucide-react), `CheckCircle2` (lucide-react), `XCircle` (lucide-react), `Loader2` (lucide-react), `Link` (next/link), `FileText` (lucide-react), `LogOut` (lucide-react), `CardHeader` (components/ui/card.tsx), `CardTitle` (components/ui/card.tsx), `CardContent` (components/ui/card.tsx), `MapPin` (lucide-react), `ArrowRight` (lucide-react)

**Hooks used:** `useState`×2, `useRouter` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (BrowseHQs)` | component | `BrowseHQs()` | 41 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/guest-auth/available-hqs?userId=${guestUserId}` (L62)
- **Browser storage / cookies:** `guest_user_id` (localStorage: get/remove), `guest_email` (localStorage: get/remove)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardHeader`, `CardTitle`
  - `lib/utils.ts` — `slugify`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `next` — `useRouter`
  - `lucide-react` — `Building2`, `MapPin`, `Clock`, `CheckCircle2`, `XCircle`, `Loader2`, …
  - `sonner` — `toast`

## Used by

- `app/browse-hqs/page.tsx`
