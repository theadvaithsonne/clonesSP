# `components/welcome/WelcomeCard.tsx`

> React component `WelcomeCard`.

**Kind:** React component · **Lines:** 148 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Icon` (local), `ChevronRight` (lucide-react)

### Props

- **`WelcomeCard`**: `icon: LucideIcon`, `title: string`, `subtitle: string`, `onClick: () => void`, `variant?: "primary" | "secondary" | "default" | "accent" | "success"`, `disabled?: boolean`, `index?: number`, `size?: "default" | "lg"`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WelcomeCard` | component | `WelcomeCard({ icon: Icon, title, subtitle, onClick, variant = "default"…)` | 52 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `framer-motion` — `motion`
  - `lucide-react` — `ChevronRight`, `LucideIcon`

## Used by

- `components/welcome/Welcome.tsx`
- `components/welcome/index.ts`
