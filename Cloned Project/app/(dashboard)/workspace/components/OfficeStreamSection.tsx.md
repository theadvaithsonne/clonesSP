# `app/(dashboard)/workspace/components/OfficeStreamSection.tsx`

> React component `OfficeStreamSection`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 162 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ChevronRight` (lucide-react), `Avatar` (components/ui/avatar.tsx), `AvatarImage` (components/ui/avatar.tsx), `AvatarFallback` (components/ui/avatar.tsx)

### Props

- **`OfficeStreamSection`**: `title: string`, `totalCount: number`, `overflowCount: number`, `previewCount: number`, `onViewAll: () => void`, `previewPeople: PreviewPerson[]`, `children: ReactNode`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PreviewPerson` | interface |  | 7 |
| `OfficeStreamSection` | component | `memo(function OfficeStreamSection({ title, totalCount, overflowCount, previewCount, onVie…` | 35 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
- **Packages:**
  - `react` — `memo`, `ReactNode`
  - `lucide-react` — `ChevronRight`

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
