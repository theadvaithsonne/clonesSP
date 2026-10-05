# `components/dashboard/AIProviderRequiredModal.tsx`

> React component `AIProviderRequiredModal`.

**Kind:** React component · **Lines:** 159 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/ui/button.tsx), `Dialog`×2 (components/ui/dialog.tsx), `DialogContent`×2 (components/ui/dialog.tsx), `DialogHeader`×2 (components/ui/dialog.tsx), `DialogTitle`×2 (components/ui/dialog.tsx), `DialogDescription`×2 (components/ui/dialog.tsx), `AlertTriangle`×2 (lucide-react), `Sparkles`×2 (lucide-react), `DialogFooter`×2 (components/ui/dialog.tsx), `UserCog` (lucide-react), `Key` (lucide-react)

### Props

- **`AIProviderRequiredModal`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `featureName?: string`, `isFounder?: boolean`

**Hooks used:** `useRouter` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AIProviderRequiredModal)` | component | `AIProviderRequiredModal({ open, onOpenChange, featureName = "AI features", isFounde…)` | 22 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`
  - `components/ui/button.tsx` — `Button`
- **Packages:**
  - `next` — `useRouter`
  - `lucide-react` — `Sparkles`, `Key`, `AlertTriangle`, `UserCog`

## Used by

- `components/dashboard/AskCabinetSidebar.tsx`
- `components/dashboard/BettyDashboardPage.tsx`
