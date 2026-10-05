# `components/garage-admin/AffiliateMemberDrawer.tsx`

> Action panel for an affiliate (or their upline), opened from the Name / Upline Details cells of the One Time Affiliates table.

**Kind:** React component · **Lines:** 124 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Action panel for an affiliate (or their upline), opened from the Name /
Upline Details cells of the One Time Affiliates table. Two actions, mirroring
the NetworkChains downline panel:
  - Open View    — view the affiliates table from this person's perspective
                   (their downline; backend ?rootUserId).
  - View Profile — open this person's full profile page.
Same portal + framer-motion right-side shell as InvoiceDetailDrawer.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ChevronRight`×2 (lucide-react), `AnimatePresence` (framer-motion), `X` (lucide-react), `Eye` (lucide-react), `UserRound` (lucide-react)

### Props

- **`AffiliateMemberDrawer`**: `person: AffiliatePerson`, `onClose: () => void`, `onOpenView: (p: NonNullable<AffiliatePerson>) => void`, `profileBasePath?: string`

**Hooks used:** `useRouter` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AffiliatePerson` | type |  | 19 |
| `AffiliateMemberDrawer` | component | `AffiliateMemberDrawer({ person, onClose, onOpenView, profileBasePath = "/garage-a…)` | 28 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react-dom` — `createPortal`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `X`, `ChevronRight`, `UserRound`, `Eye`
  - `next` — `useRouter`

## Used by

- `app/garage-admin/(admin-dashboard)/networkchain-subs/page.tsx`
- `app/garage-admin/(admin-dashboard)/one-time-affiliates/page.tsx`
- `app/garage-admin/(admin-dashboard)/users/page.tsx`
