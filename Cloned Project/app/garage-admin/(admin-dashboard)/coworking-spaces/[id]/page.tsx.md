# `app/garage-admin/(admin-dashboard)/coworking-spaces/[id]/page.tsx`

> Next.js page rendered at `/garage-admin/coworking-spaces/[id]`.

**Kind:** Next.js page · **Lines:** 605 · **Directive:** `"use client"` · **Route:** `/garage-admin/coworking-spaces/[id]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Card`×7 (components/ui/card.tsx), `CardContent`×7 (components/ui/card.tsx), `Button`×6 (components/ui/button.tsx), `CardHeader`×5 (components/ui/card.tsx), `CardTitle`×5 (components/ui/card.tsx), `ArrowLeft`×2 (lucide-react), `Badge`×2 (components/ui/badge.tsx), `ChevronLeft`×2 (lucide-react), `ChevronRight`×2 (lucide-react), `CheckCircle`×2 (lucide-react), `Copy`×2 (lucide-react), `Landmark` (lucide-react), `Edit` (lucide-react), `AlertDialog` (components/ui/alert-dialog.tsx), `AlertDialogTrigger` (components/ui/alert-dialog.tsx), `Trash2` (lucide-react), `AlertDialogContent` (components/ui/alert-dialog.tsx), `AlertDialogHeader` (components/ui/alert-dialog.tsx), `AlertDialogTitle` (components/ui/alert-dialog.tsx), `AlertDialogDescription` (components/ui/alert-dialog.tsx), `AlertDialogFooter` (components/ui/alert-dialog.tsx), `AlertDialogCancel` (components/ui/alert-dialog.tsx), `AlertDialogAction` (components/ui/alert-dialog.tsx), `Star` (lucide-react), `ImageIcon` (lucide-react), `X` (lucide-react), `MapPin` (lucide-react), `Users` (lucide-react), `CardDescription` (components/ui/card.tsx), `Calendar` (lucide-react)

**Hooks used:** `useState`×5, `useParams` (next/navigation), `useRouter` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CoworkingSpaceDetailPage)` | component | `CoworkingSpaceDetailPage()` | 79 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `GET /garage-admin/coworking-spaces/${spaceId}` (L98)
  - `DELETE /garage-admin/coworking-spaces/${spaceId}` (L113)
- **Timers / queues:** `setTimeout` at L129

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`, … +1
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `next` — `useParams`, `useRouter`
  - `lucide-react` — `Landmark`, `MapPin`, `Star`, `ArrowLeft`, `Edit`, `Trash2`, …
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/coworking-spaces/[id]` (page).
