# `app/careers/components/VacancyCard.tsx`

> React component `VacancyCard`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 195 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DropdownMenuItem`×2 (components/ui/dropdown-menu.tsx), `Card`×2 (components/ui/card.tsx), `Badge`×2 (components/ui/badge.tsx), `MapPin`×2 (lucide-react), `Briefcase`×2 (lucide-react), `ArrowRight`×2 (lucide-react), `DropdownMenu` (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger` (components/ui/dropdown-menu.tsx), `Button` (components/ui/button.tsx), `MoreVertical` (lucide-react), `DropdownMenuContent` (components/ui/dropdown-menu.tsx), `Pencil` (lucide-react), `Trash2` (lucide-react), `CardHeader` (components/ui/card.tsx), `CardTitle` (components/ui/card.tsx), `CardContent` (components/ui/card.tsx)

### Props

- **`VacancyCard`**: `vacancy: Vacancy`, `isFounder: boolean`, `viewMode?: "grid" | "list"`, `onEdit?: (vacancy: Vacancy) => void`, `onDelete?: (id: string) => void`

**Hooks used:** `useRouter` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (VacancyCard)` | component | `VacancyCard({ vacancy, isFounder, viewMode = "grid", onEdit, onDelete, …)` | 42 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardHeader`, `CardTitle`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
  - `components/ui/button.tsx` — `Button`
  - `app/careers/types.ts` — `Vacancy`
- **Packages:**
  - `next` — `useRouter`
  - `lucide-react` — `MapPin`, `Briefcase`, `MoreVertical`, `Pencil`, `Trash2`, `ArrowRight`

## Used by

- `app/careers/CareersClient.tsx`

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L180).
