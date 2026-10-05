# `components/ui/link-preview.tsx`

> React component `LinkPreview`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 185 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Props

- **`LinkPreview`**: `url: string`, `token?: string | null`

**Hooks used:** `useState`×3, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `LinkPreview` | component | `LinkPreview({ url, token }: { url: string; token?: string \| null })` — `token` overrides the user token — the admin console passes its admin token. | 17 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/link-preview?url=${encodeURIComponent(url)}` (L29)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `ExternalLink`, `Image as ImageIcon`

## Used by

- `components/dashboard/DMPage.tsx`
- `components/dashboard/FeedComponents.tsx`
- `components/dashboard/FeedPageRedesigned.tsx`
- `components/dashboard/GlobalDMPage.tsx`
- `components/dashboard/GroupChatPage.tsx`
- `components/dashboard/PostDetailModal.tsx`
- `components/dashboard/PostDetailView.tsx`
- `components/garage-admin/SupportChatsConsole.tsx`
- `components/webinar/ChatPanel.tsx`
