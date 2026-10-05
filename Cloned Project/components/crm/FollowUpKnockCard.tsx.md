# `components/crm/FollowUpKnockCard.tsx`

> React component `FollowUpKnockCard`.

**Kind:** React component · **Lines:** 74 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AnimatePresence` (framer-motion), `Button` (components/ui/button.tsx), `X` (lucide-react)

### Props

- **`FollowUpKnockCard`**: `knock: FollowUpKnock | null`, `onDismiss: () => void`

**Hooks used:** `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FollowUpKnockCard` | component | `FollowUpKnockCard({ knock, onDismiss }: FollowUpKnockCardProps)` | 14 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `hooks/useFollowUpReminders.ts` — `FollowUpKnock`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useRef`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `X`

## Used by

- `app/(dashboard)/deals/components/FollowUpKnockReminder.tsx`
