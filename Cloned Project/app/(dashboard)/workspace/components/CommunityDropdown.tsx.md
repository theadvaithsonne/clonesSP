# `app/(dashboard)/workspace/components/CommunityDropdown.tsx`

> React component `CommunityDropdown`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 274 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/ui/button.tsx), `Users`×2 (lucide-react), `ChevronDown` (lucide-react), `AnimatePresence` (framer-motion), `X` (lucide-react)

### Props

- **`CommunityDropdown`**: `selectedCommunityId: string | null`, `onCommunityChange: (id: string | null) => void`, `teamMembers: Map<string, TeamMemberInfo>`

**Hooks used:** `useState`×4, `useEffect`×3, `useRef`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CommunityDropdown)` | component | `CommunityDropdown({ selectedCommunityId, onCommunityChange, teamMembers, }: C…)` | 29 |

## Interfaces

- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `getOrgChannels`, `getChannelSubscribers`, `Channel`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useMemo`
  - `lucide-react` — `Users`, `ChevronDown`, `X`
  - `framer-motion` — `motion`, `AnimatePresence`

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
