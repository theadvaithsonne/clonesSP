# `components/crm/LeadContactQuickActions.tsx`

> React component `LeadContactQuickActions`.

**Kind:** React component · **Lines:** 118 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/ui/button.tsx), `Mail` (lucide-react), `WhatsAppIcon` (components/icons/WhatsAppIcon.tsx)

### Props

- **`LeadContactQuickActions`**: `lead: Record<string, unknown> | null | undefined`, `leadId?: string`, `theme?: "light" | "dark" | "color"`, `className?: string`, `showOnRowHover?: boolean`, `variant?: "default" | "figma"`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (LeadContactQuickActions)` | component | `LeadContactQuickActions({ lead, leadId, theme = "light", className, showOnRowHover …)` | 29 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/icons/WhatsAppIcon.tsx` — `WhatsAppIcon`
  - `lib/crm/leadContactActions.ts` — `openLeadEmail`, `openLeadWhatsApp`
  - `lib/crm/resolveLeadContactInfo.ts` — `hasLeadEmailOrPhone`, `resolveLeadEmail`, `resolveLeadPhone`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `lucide-react` — `Mail`

## Used by

- `app/(dashboard)/deals/leads/page.tsx`
- `app/(dashboard)/deals/page.tsx`
