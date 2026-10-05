# `components/funnel-studio/funnel-cta-picker.tsx`

> React component `FunnelCtaPicker`.

**Kind:** React component · **Lines:** 79 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/ui/button.tsx), `Tag` (lucide-react), `ChevronDown` (lucide-react), `X` (lucide-react), `AttachProductDrawer` (components/garage/attach-product-drawer.tsx)

### Props

- **`FunnelCtaPicker`**: `value: FunnelCta | null`, `onChange: (cta: FunnelCta | null) => void`, `affiliateIdOverride?: string | null`

**Hooks used:** `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FunnelCtaPicker` | component | `FunnelCtaPicker({ value, onChange, affiliateIdOverride, }: { value: FunnelC…)` — Attach a product from the NC catalog to a funnel as its call-to-action, using the SAME "Attach a Product" side panel as Funnel Studio (never the webinar pin modal). | 14 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/garage/attach-product-drawer.tsx` — `AttachProductDrawer`
  - `lib/nc-admin-api/admin-funnels.ts` — `FunnelCta`, `(types only)`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `Tag`, `X`, `ChevronDown`

## Used by

- `app/garage-admin/(admin-dashboard)/networkchains/funnels/[id]/page.tsx`
