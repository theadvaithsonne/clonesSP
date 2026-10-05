# `components/dashboard/ArticlesPage.tsx`

> React component `ArticlesPage`.

**Kind:** React component · **Lines:** 913 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `FileText`×7 (lucide-react), `Loader2`×5 (lucide-react), `Check`×3 (lucide-react), `Link2`×3 (lucide-react), `ChevronDown`×2 (lucide-react), `Clock`×2 (lucide-react), `X` (lucide-react), `GripVertical` (lucide-react), `EyeOff` (lucide-react), `Eye` (lucide-react), `ArrowLeft` (lucide-react), `Play` (lucide-react), `Settings2` (lucide-react)

### Props

- **`ArticlesPage`**: `viewRole?: "founder" | "customer"`

**Hooks used:** `useState`×18, `useEffect`×9, `useBrandColors` (lib/brand-color-context.tsx), `useRef`, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ArticlesPage` | component | `ArticlesPage({ viewRole = "customer" }: { viewRole?: "founder" \| "custom…)` | 157 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${apiBase}/guest-auth/hq-by-slug/${orgSlug}` (L280)
  - `GET ${apiBase}/public/organizations/${data.organization._id}/users` (L285)
  - `GET ${apiBase}/public/posts/${selectedArticleId}` (L305)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `art_viewMode` (localStorage: get/set), `art_sortOrder` (localStorage: get/set), `art_customOrder` (localStorage: get/set), `art_hiddenIds` (localStorage: get/set), `garage_org_id` (localStorage: get), `garage_org_slug` (localStorage: get)
- **Timers / queues:** `setTimeout` at L269

## Dependencies

- **Internal:**
  - `lib/feed-api.ts` — `getPosts`, `getPostShareLink`, `Post`
  - `lib/utils.ts` — `cn`
  - `lib/brand-color-context.tsx` — `useBrandColors`
  - `components/feed/article-editor.css` (side effect)
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`, `useRef`
  - `lucide-react` — `FileText`, `Clock`, `Loader2`, `Search`, `Send`, `Check`, …
  - `sonner` — `toast`
  - `dompurify`

## Used by

- `app/(dashboard)/layout.tsx`

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L574).
