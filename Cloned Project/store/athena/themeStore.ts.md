# `store/athena/themeStore.ts`

> Module exporting `useThemeStore`.

**Kind:** client state store · **Lines:** 24

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useThemeStore` | const | `= create<ThemeState>()( persist( (set) => ({ theme: 'light', toggleTheme: () => set((state) => ({ t…` | 12 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `zustand` — `create`, `persist`

## Used by

- `components/athena/components/Dashbaord.tsx`
