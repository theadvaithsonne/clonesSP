# `components/ui/scroll-area.tsx`

> React components `ScrollArea`, `ScrollBar`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 59 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ScrollAreaPrimitive`×5 (radix-ui), `ScrollBar` (local)

### Props

- **`ScrollArea`**: `props: React.ComponentProps<typeof ScrollAreaPrimitive.Root>`
- **`ScrollBar`**: `props: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaS…`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ScrollArea` | component | `ScrollArea({ className, children, ...props }: React.ComponentProps<typ…)` | 58 |
| `ScrollBar` | component | `ScrollBar({ className, orientation = "vertical", ...props }: React.Co…)` | 58 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react`
  - `radix-ui` — `ScrollArea as ScrollAreaPrimitive`

## Used by

- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/right-side-panel.tsx`
- `components/dashboard/OpenClawAgentTabs.tsx`
- `components/dashboard/OpenClawBillingPage.tsx`
- `components/dashboard/OpenClawMarketplacePage.tsx`
