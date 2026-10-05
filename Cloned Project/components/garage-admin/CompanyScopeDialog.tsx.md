# `components/garage-admin/CompanyScopeDialog.tsx`

> Scope switcher for the One Time Affiliates table — the "Entire Company" button in the TopBar.

**Kind:** React component · **Lines:** 328 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Scope switcher for the One Time Affiliates table — the "Entire Company"
button in the TopBar. Pick any member and the table reloads scoped to that
person's organisation (them + their whole downline tree), mirroring 1
Network's view-as experience.

It writes the SAME state the filter drawer's "Downline / Sponsor" field
writes, which the page serialises as ?rootUserId. Two entry points, one
scope — they can never disagree.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Check`×2 (lucide-react), `PersonRow`×2 (local), `AnimatePresence` (framer-motion), `X` (lucide-react), `BrandDot` (local), `Search` (lucide-react), `Loader2` (lucide-react), `ScopeAvatar` (local)

### Props

- **`CompanyScopeDialog`**: `open: boolean`, `onClose: () => void`, `active: ScopePerson | null`, `onSelect: (person: ScopePerson | null) => void`
- **`ScopeAvatar`**: `src: string | null`, `name: string | null`, `className?: string`

**Hooks used:** `useState`×5, `useEffect`×4, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ScopePerson` | interface |  | 19 |
| `CompanyScopeDialog` | component | `CompanyScopeDialog({ open, onClose, active, onSelect, }: { open: boolean; onCl…)` | 27 |
| `ScopeAvatar` | component | `ScopeAvatar({ src, name, className = "h-7 w-7", }: { src: string \| null…)` | 285 |

## Interfaces

- **Timers / queues:** `setTimeout` at L78

## Dependencies

- **Internal:**
  - `lib/admin-api/users.ts` — `listUsers`, `AdminUserListItem`
  - `lib/country-flag.ts` — `getCountryFlag`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `react-dom` — `createPortal`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `Check`, `Loader2`, `Search`, `X`

## Used by

- `app/garage-admin/(admin-dashboard)/one-time-affiliates/page.tsx`
