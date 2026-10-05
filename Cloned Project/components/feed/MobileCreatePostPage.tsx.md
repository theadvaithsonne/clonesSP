# `components/feed/MobileCreatePostPage.tsx`

> React component `MobileCreatePostPage`.

**Kind:** React component · **Lines:** 122 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `InlinePostComposer` (components/feed/InlinePostComposer.tsx)

### Props

- **`MobileCreatePostPage`**: `channels: { channelId: string; channelTitle: string; logo?: string | …`, `orgId: string`, `user: { name: string; email?: string; profilePicture?: string; }`, `onPostCreated: () => void`, `onClose: () => void`, `teamMembers?: { _id: string; name: string; email: string; profilePict…`, `existingTags?: string[]`

**Hooks used:** `useEffect`×3, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MobileCreatePostPage` | component | `MobileCreatePostPage({ channels, orgId, user, onPostCreated, onClose, teamMember…)` | 31 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/feed/InlinePostComposer.tsx` — `InlinePostComposer`
- **Packages:**
  - `react` — `useEffect`, `useRef`
  - `react-dom` — `createPortal`

## Used by

- `components/dashboard/FeedPageRedesigned.tsx`
