# `components/dashboard/OpenClawMarketplacePage.tsx`

> React component `OpenClawMarketplacePage`.

**Kind:** React component · **Lines:** 992 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Field`×10 (local), `Input`×8 (components/ui/input.tsx), `Button`×6 (components/ui/button.tsx), `StatChip`×5 (local), `Plus`×3 (lucide-react), `X`×3 (lucide-react), `Globe`×3 (lucide-react), `Loader2`×3 (lucide-react), `Clock`×3 (lucide-react), `Hash`×3 (lucide-react), `SectionLabel`×2 (local), `User`×2 (lucide-react), `Sheet`×2 (components/ui/sheet.tsx), `SheetContent`×2 (components/ui/sheet.tsx), `Layers`×2 (lucide-react), `StepBadge`×2 (local), `ArrowRight`×2 (lucide-react), `Boxes`×2 (lucide-react), `Trash`×2 (lucide-react), `Package` (lucide-react), `Search` (lucide-react), `Sparkles` (lucide-react), `TemplateCard` (local), `ScrollArea` (components/ui/scroll-area.tsx), `CheckCircle2` (lucide-react), `SlidersHorizontal` (lucide-react), `TerminalSquare` (lucide-react), `Cron` (react-cron-generator), `Zap` (lucide-react), `Save` (lucide-react), `Settings2` (lucide-react), `OpenClawMarketplacePageInternal` (local)

**Hooks used:** `useState`×19, `useMemo`×2, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OpenClawMarketplacePage)` | component | `OpenClawMarketplacePage()` | 988 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/auth.ts` — `getOrgId`, `getToken`, `getUserIdFromToken`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/sheet.tsx` — `Sheet`, `SheetContent`
  - `components/ui/scroll-area.tsx` — `ScrollArea`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useMemo`
  - `lucide-react` — `Search`, `Plus`, `Loader2`, `Globe`, `User`, `Clock`, …
  - `sonner` — `toast`
  - `cronstrue`
  - `react-cron-generator` — `quartzToUnix`, `unixToQuartz`

## Used by

- `components/dashboard/AIManagementPage.tsx`
