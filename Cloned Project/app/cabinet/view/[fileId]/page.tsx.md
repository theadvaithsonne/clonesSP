# `app/cabinet/view/[fileId]/page.tsx`

> Next.js page rendered at `/cabinet/view/[fileId]`.

**Kind:** Next.js page · **Lines:** 196 · **Directive:** `"use client"` · **Route:** `/cabinet/view/[fileId]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2` (lucide-react), `FileIcon` (lucide-react), `Eye` (lucide-react)

**Hooks used:** `useState`×4, `useParams` (next/navigation), `useRouter` (next/navigation), `useSearchParams` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CabinetFileViewPage)` | component | `CabinetFileViewPage()` | 40 |

## Interfaces

- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `next` — `useParams`, `useRouter`, `useSearchParams`
  - `lucide-react` — `Eye`, `File as FileIcon`, `Loader2`

## Used by

Entry: reached by the Next.js router at `/cabinet/view/[fileId]` (page).
