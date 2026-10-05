# `components/feed/ShareModal.tsx`

> React component `ShareModal`.

**Kind:** React component · **Lines:** 181 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `Link2` (lucide-react)

### Props

- **`ShareModal`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `postId: string`, `orgId: string`, `postContent?: string`

**Hooks used:** `useState`×3, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ShareModal` | component | `ShareModal({ open, onOpenChange, postId, orgId, postContent, }: ShareM…)` | 18 |

## Interfaces

- **Timers / queues:** `setTimeout` at L54
- **External hosts mentioned in the code:** `twitter.com`, `www.facebook.com`, `www.linkedin.com`, `wa.me`

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `getPostShareLink`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Link2`, `Copy`, `Check`, `Twitter`, `Facebook`, `Linkedin`, …
  - `sonner` — `toast`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
