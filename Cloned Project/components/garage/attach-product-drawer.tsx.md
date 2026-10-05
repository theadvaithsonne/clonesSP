# `components/garage/attach-product-drawer.tsx`

> React component `AttachProductDrawer`.

**Kind:** React component · **Lines:** 87 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/ui/button.tsx), `FormDrawer` (components/ui/form-drawer.tsx), `LinkPicker` (components/garage/link-picker.tsx)

### Props

- **`AttachProductDrawer`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `onSelect: (link: FunnelLink) => void`, `affiliateIdOverride?: string | null`, `currentName?: string | null`, `subtitle?: string`

**Hooks used:** `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AttachProductDrawer` | component | `AttachProductDrawer({ open, onOpenChange, onSelect, currentName, subtitle, affi…)` — The canonical "Attach a Product" side panel — the same LinkPicker (Physical / Digital / Offices / General) that Funnel Studio uses. | 17 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/form-drawer.tsx` — `FormDrawer`
  - `components/ui/button.tsx` — `Button`
  - `components/garage/link-picker.tsx` — `LinkPicker`
  - `lib/affiliate/link-card-adapters.ts` — `linkItemToFunnelLink`
  - `lib/affiliate/links-api.ts` — `LinkItem`, `(types only)`
  - `lib/api/funnels.ts` — `FunnelLink`, `(types only)`
- **Packages:**
  - `react` — `useState`

## Used by

- `components/funnel-studio/funnel-cta-picker.tsx`
