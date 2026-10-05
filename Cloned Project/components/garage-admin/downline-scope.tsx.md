# `components/garage-admin/downline-scope.tsx`

> "Downline / Sponsor" filter screen — pick the root of a referral tree, and optionally leave some legs out of it.

**Kind:** React component · **Lines:** 330 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
"Downline / Sponsor" filter screen — pick the root of a referral tree, and
optionally leave some legs out of it.

Lifted out of OneTimeAffiliatesFilterDrawer so Daily Reports scopes a tree
exactly the same way. The comment inside PersonSearch already said the two
halves share one implementation "so they cannot drift"; the same reasoning
applies across tables — the semantics here are subtle (the root is NOT in
its own downline; excluding someone removes what they recruited but keeps
them) and two copies would diverge.

Wire format both consumers use: `?rootUserId=<id>` plus a repeated
`?excludeUserId=<id>` per excluded person.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `PersonAvatar`×3 (local), `PersonSearch`×2 (local), `Check` (lucide-react), `X` (lucide-react), `Search` (lucide-react), `Loader2` (lucide-react), `ChevronRight` (lucide-react)

### Props

- **`DownlineScreen`**: `selected: DownlinePerson | null`, `onChange: (person: DownlinePerson | null) => void`, `excluded: DownlinePerson[]`, `onChangeExcluded: (people: DownlinePerson[]) => void`
- **`PersonSearch`**: `onPick: (person: DownlinePerson) => void`, `autoFocus?: boolean`, `placeholder?: string`, `emptyHint?: string`, `withinDownlineOf?: string`
- **`PersonAvatar`**: `src: string | null`, `name: string | null`

**Hooks used:** `useState`×4, `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DownlinePerson` | type |  | 21 |
| `DownlineScreen` | component | `DownlineScreen({ selected, onChange, excluded, onChangeExcluded, }: { sele…)` — Downline / Sponsor screen: pick the root of the tree, and optionally one leg to leave out. | 41 |
| `PersonSearch` | component | `PersonSearch({ onPick, autoFocus = false, placeholder = "Search by name …)` — Debounced person search used by both halves of the Downline screen — the root of the tree and the leg being excluded. | 177 |
| `PersonAvatar` | component | `PersonAvatar({ src, name, }: { src: string \| null; name: string \| null; })` | 306 |

## Interfaces

- **Timers / queues:** `setTimeout` at L213

## Dependencies

- **Internal:**
  - `lib/admin-api/users.ts` — `listUsers`, `AdminUserListItem`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `lucide-react` — `Check`, `ChevronRight`, `Loader2`, `Search`, `X`

## Used by

- `components/garage-admin/DailyReportsFilterDrawer.tsx`
- `components/garage-admin/OneTimeAffiliatesFilterDrawer.tsx`
- `lib/admin-api/daily-reports.ts`
