# `app/(dashboard)/taskroom/components/nav.tsx`

> import Link from "next/link";

**Kind:** Next.js app-directory module (colocated) · **Lines:** 89 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
import Link from "next/link";

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Tooltip` (components/ui/tooltip.tsx), `TooltipTrigger` (components/ui/tooltip.tsx), `TooltipContent` (components/ui/tooltip.tsx)

### Props

- **`Nav`**: `isCollapsed: boolean`, `links: { title: string; label?: string; icon: LucideIcon; variant: "d…`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Nav` | component | `Nav({ links, isCollapsed }: NavProps)` | 25 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/ui/button.tsx` — `buttonVariants`
  - `components/ui/tooltip.tsx` — `Tooltip`, `TooltipContent`, `TooltipTrigger`
- **Packages:**
  - `lucide-react` — `LucideIcon`

## Used by

- `app/(dashboard)/taskroom/components/sidebar.tsx`
