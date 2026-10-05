# `lib/whitelabel-context.tsx`

> React component `WhitelabelProvider`.

**Kind:** frontend library · **Lines:** 112 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `WhitelabelContext` (local)

### Props

- **`WhitelabelProvider`**: `children: ReactNode`

**Hooks used:** `useContext`×2, `useWhitelabel` (lib/hooks/useWhitelabel.ts), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WhitelabelProvider` | component | `WhitelabelProvider({ children }: { children: ReactNode })` | 15 |
| `useWhitelabelOptional` | hook | `useWhitelabelOptional(): WhitelabelConfig \| null` — Same as useWhitelabelContext but returns null instead of throwing when no provider is present. | 99 |
| `useWhitelabelContext` | hook | `useWhitelabelContext(): WhitelabelConfig` | 103 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/hooks/useWhitelabel.ts` — `useWhitelabel`
  - `lib/whitelabel.ts` — `WhitelabelConfig`
- **Packages:**
  - `react` — `createContext`, `useContext`, `useEffect`, `ReactNode`

## Used by

- `app/(auth)/layout.tsx`
- `app/(auth)/verify/page.tsx`
- `app/(dashboard)/layout.tsx`
- `components/dashboard/MainSidebar.tsx`
- `components/dashboard/MobileHeader.tsx`
- `components/welcome/Welcome.tsx`
- `lib/brand-color-context.tsx`
