# `components/shared/AccountSwitcher.tsx`

> React component `AccountSwitcher`.

**Kind:** React component · **Lines:** 176 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Check` (lucide-react), `X` (lucide-react), `Plus` (lucide-react)

### Props

- **`AccountSwitcher`**: `landing?: string`, `onAction?: () => void`

**Hooks used:** `useState`×3, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AccountSwitcher)` | component | `AccountSwitcher({ landing = "/workspace", onAction, }: { /** Where a comple…)` — Account rows + "Add account", styled as plain buttons so they drop into the sidebar's user menu alongside Logout — switching accounts and signing out are the same decision from the user's side, and the chip at the bottom of the sidebar is … | 31 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/auth/me` (L70)

## Dependencies

- **Internal:**
  - `lib/accounts.ts` — `activeUserId`, `beginAddAccount`, `forgetAccount`, `listAccounts`, `seedFromLiveSession`, `setAccountPicture`, `StoredAccount`
  - `lib/account-session.ts` — `switchToAccount`
  - `lib/api.ts` — `api`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `Check`, `Plus`, `X`

## Used by

- `components/dashboard/MainSidebar.tsx`
