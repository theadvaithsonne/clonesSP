# `app/garage-admin/(admin-dashboard)/coworking-spaces/page.tsx`

> Next.js page rendered at `/garage-admin/coworking-spaces`.

**Kind:** Next.js page · **Lines:** 906 · **Directive:** `"use client"` · **Route:** `/garage-admin/coworking-spaces` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TableHead`×15 (components/ui/table.tsx), `TableCell`×15 (components/ui/table.tsx), `Card`×11 (components/ui/card.tsx), `CardContent`×11 (components/ui/card.tsx), `Button`×8 (components/ui/button.tsx), `Badge`×6 (components/ui/badge.tsx), `Landmark`×5 (lucide-react), `CalendarIcon`×4 (lucide-react), `TableRow`×4 (components/ui/table.tsx), `Clock`×2 (lucide-react), `CheckCircle2`×2 (lucide-react), `XCircle`×2 (lucide-react), `AlertCircle`×2 (lucide-react), `TabsTrigger`×2 (components/ui/tabs.tsx), `Plus`×2 (lucide-react), `TabsContent`×2 (components/ui/tabs.tsx), `Star`×2 (lucide-react), `CardHeader`×2 (components/ui/card.tsx), `CardTitle`×2 (components/ui/card.tsx), `CardDescription`×2 (components/ui/card.tsx), `Table`×2 (components/ui/table.tsx), `TableHeader`×2 (components/ui/table.tsx), `TableBody`×2 (components/ui/table.tsx), `Check`×2 (lucide-react), `X`×2 (lucide-react), `Tabs` (components/ui/tabs.tsx), `TabsList` (components/ui/tabs.tsx), `Building2` (lucide-react), `Users` (lucide-react), `MapPin` (lucide-react), `Eye` (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `Label` (components/ui/label.tsx), `Textarea` (components/ui/textarea.tsx), `DialogFooter` (components/ui/dialog.tsx), `Loader2` (lucide-react)

**Hooks used:** `useState`×11, `useEffect`×2, `useAdminAccess` (components/garage-admin/use-admin-access.ts), `useRouter` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CoworkingSpacesPage)` | component | `CoworkingSpacesPage()` | 122 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `GET /garage-admin/coworking-spaces` (L156)
  - `GET /coworking-bookings/admin/stats` (L187)
  - `PATCH /coworking-bookings/admin/requests/${selectedBooking.id}/status` (L202)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/tabs.tsx` — `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/label.tsx` — `Label`
  - `components/garage-admin/use-admin-access.ts` — `useAdminAccess`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `next` — `useRouter`
  - `lucide-react` — `Landmark`, `MapPin`, `Star`, `Plus`, `Eye`, `Building2`, …
  - `sonner` — `toast`
  - `date-fns` — `format`

## Used by

Entry: reached by the Next.js router at `/garage-admin/coworking-spaces` (page).
