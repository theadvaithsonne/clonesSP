# `components/dashboard/PasswordGate.tsx`

> React component `PasswordGate`.

**Kind:** React component · **Lines:** 137 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Lock`×2 (lucide-react), `Input` (components/ui/input.tsx), `Button` (components/ui/button.tsx)

### Props

- **`PasswordGate`**: `children: React.ReactNode`, `pageTitle?: string`

**Hooks used:** `useState`×5, `usePasswordAuth`×2 (local), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PasswordGate` | component | `PasswordGate({ children, pageTitle = "OpenClaw" }: PasswordGateProps)` | 52 |
| `usePasswordGate` | hook | `usePasswordGate()` | 134 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Lock`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
