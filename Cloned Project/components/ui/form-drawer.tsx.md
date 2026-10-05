# `components/ui/form-drawer.tsx`

> React components `FormDrawer`, `FormDrawerCard`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 158 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DrawerPortal` (components/shared/drawer-portal.tsx), `AnimatePresence` (framer-motion), `X` (lucide-react), `Loader2` (lucide-react), `Check` (lucide-react)

### Props

- **`FormDrawer`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `title: string`, `subtitle?: string`, `onSubmit?: () => void`, `submitting?: boolean`, `canSubmit?: boolean`, `submitLabel?: string`, `headerRight?: React.ReactNode`, `footer?: React.ReactNode`, `widthClass?: string`, `closeDisabled?: boolean`, `children: React.ReactNode`
- **`FormDrawerCard`**: `className?: string`, `children: React.ReactNode`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FormDrawer` | component | `FormDrawer({ open, onOpenChange, title, subtitle, onSubmit, submitting…)` — The one shared "form drawer" shell for NetworkChains (design #127). | 21 |
| `FormDrawerCard` | component | `FormDrawerCard({ className, children, }: { className?: string; children: R…)` — The glass "card" the drawer's fields sit in (matches the Schedule drawer). | 140 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/shared/drawer-portal.tsx` — `DrawerPortal`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `lucide-react` — `X`, `Check`, `Loader2`
  - `framer-motion` — `motion`, `AnimatePresence`

## Used by

- `components/data-table/ExportPanel.tsx`
- `components/garage/attach-product-drawer.tsx`
