# `app/(dashboard)/thoughts/components/blocks/MentionPersonBlock.tsx`

> Module exporting `mentionPersonBlock`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 270 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `User` (lucide-react), `Search` (lucide-react), `Loader2` (lucide-react), `MentionPersonRenderer` (local)

**Hooks used:** `useState`×5, `useEffect`×4, `useRef`×3, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `mentionPersonBlock` | const | `= createReactBlockSpec( { type: "mentionPerson" as const, propSchema: { personName: { default: "", …` | 253 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/team/list?orgId=${organizationId}` (L43)
  - `GET /backend/org/${organizationId}/users/search?q=${encodeURIComponent(query.trim())}&limit=10` (L95)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L92

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
- **Packages:**
  - `react` — `useState`, `useRef`, `useEffect`, `useCallback`
  - `lucide-react` — `User`, `Search`, `Loader2`
  - `@blocknote/react` — `createReactBlockSpec`

## Used by

- `app/(dashboard)/thoughts/components/blocks/index.ts`
