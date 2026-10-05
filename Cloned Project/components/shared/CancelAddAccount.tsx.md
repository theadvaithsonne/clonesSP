# `components/shared/CancelAddAccount.tsx`

> Escape hatch for the "Add account" flow.

**Kind:** React component · **Lines:** 63 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Escape hatch for the "Add account" flow.

`beginAddAccount()` sets a per-tab flag, and the login screen honours it by
NOT bouncing an already-authenticated visitor into the workspace — which is
what makes adding a second account possible at all. The side effect is that
the flow becomes one-way: someone who opened "Add account" and changed their
mind has no route back, because the sign-in form is the whole screen and
every path off it requires completing a sign-in they no longer want.

This renders ONLY in that situation, so the ordinary login screen is
untouched: a first-time visitor, a lapsed session and a fresh tab all see
exactly what they saw before.

Cancelling clears the flag and returns to the app. Nothing was torn down on
the way in — "Add account" only sets the flag and navigates — so the
original account is still live and simply resumes.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ChevronLeft` (lucide-react)

### Props

- **`CancelAddAccount`**: `landing?: string`

**Hooks used:** `useRouter` (next/navigation), `useState`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CancelAddAccount)` | component | `CancelAddAccount({ landing = "/workspace" }: { landing?: string })` | 29 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/auth.ts` — `getUserDataFromToken`, `isAuthenticated`
  - `lib/accounts.ts` — `endAddAccount`, `isAddingAccount`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `next` — `useRouter`
  - `lucide-react` — `ChevronLeft`

## Used by

- `components/welcome/Welcome.tsx`
