# `components/deals/cms/CmsPageAccessGuard.tsx`

> React component `CmsPageAccessGuard`.

**Kind:** React component · **Lines:** 60 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `CmsPasswordDialog` (components/deals/cms/CmsPasswordDialog.tsx)

### Props

- **`CmsPageAccessGuard`**: `children: React.ReactNode`

**Hooks used:** `useState`×3, `useRouter` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CmsPageAccessGuard)` | component | `CmsPageAccessGuard({ children }: CmsPageAccessGuardProps)` | 16 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/deals/cms/CmsPasswordDialog.tsx` — `CmsPasswordDialog`
  - `lib/cms/accessGate.ts` — `isCmsAccessUnlocked`, `unlockCmsAccess`, `verifyCmsPassword`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `next` — `useRouter`

## Used by

- `app/(dashboard)/deals/cms/[id]/page.tsx`
- `app/(dashboard)/deals/cms/page.tsx`
