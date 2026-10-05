# `components/dashboard/WhitelabelGate.tsx`

> Access gate for the three surfaces the whitelabel add-on pays for: Domain Management, Branding and Email Setup.

**Kind:** React component · **Lines:** 67 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Access gate for the three surfaces the whitelabel add-on pays for:
Domain Management, Branding and Email Setup.

Without the add-on the founder sees the full WhitelabelPage pitch
(price, features, Upgrade button) instead of the configuration
controls — not a disabled form, not a banner above one. With it, the
wrapped page renders untouched.

Fails closed: if GET /whitelabel-addon/status errors we show the
pitch rather than the controls. The BE gates the underlying writes
anyway, so an optimistic render would just hand the founder a form
that 403s on save.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2` (lucide-react), `WhitelabelPage` (components/dashboard/WhitelabelPage.tsx)

### Props

- **`WhitelabelGate`**: `children: React.ReactNode`

**Hooks used:** `useState`×2, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (WhitelabelGate)` | component | `WhitelabelGate({ children, }: { children: React.ReactNode; })` | 22 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/whitelabel-addon-api.ts` — `fetchWhitelabelStatus`
  - `components/dashboard/WhitelabelPage.tsx` — `WhitelabelPage (default)`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `lucide-react` — `Loader2`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/ManagementPage.tsx`
