# `components/dashboard/ProductThankYouPageEditor.tsx`

> React component `ProductThankYouPageEditor`.

**Kind:** React component · **Lines:** 765 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Info`×2 (lucide-react), `ArrowUpRight`×2 (lucide-react), `CheckCircle2`×2 (lucide-react), `Sparkles` (lucide-react), `X` (lucide-react), `Trash2` (lucide-react), `Plus` (lucide-react), `Eye` (lucide-react), `ThankYouPreview` (local), `Button` (components/ui/button.tsx), `Loader2` (lucide-react), `FileText` (lucide-react), `ExternalLink` (lucide-react)

### Props

- **`ProductThankYouPageEditor`**: `item: ThankYouEditorItem | null`, `itemType?: ThankYouEditorItemType`, `open: boolean`, `onClose: () => void`, `onSaved?: (updated: ThankYouEditorItem) => void`

**Hooks used:** `useState`×7, `useEffect`×2, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ThankYouEditorItem` | type |  | 37 |
| `ThankYouEditorItemType` | type |  | 38 |
| `default (ProductThankYouPageEditor)` | component | `ProductThankYouPageEditor({ item, itemType = "product", open, onClose, onSaved, }: { …)` — Full-height right-side editor for the buyer's post-payment Thank You Page. | 79 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/org/${orgId}` (L143)
- **Browser storage / cookies:** `garage_org_slug` (localStorage: get/set), `garage_org_name` (localStorage: get/set), `garage_org_icon` (localStorage: get/set), `garage_org_id` (localStorage: get)
- **External hosts mentioned in the code:** `your-course-onboarding.com`

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `lib/feed-api.ts` — `updateProduct`, `updateCourse`, `updateChannel`, `Product`, `Course`, `Channel`, `ThankYouPage`, `ThankYouPageSection`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `X`, `Plus`, `Trash2`, `Info`, `Sparkles`, `Loader2`, …

## Used by

- `components/dashboard/ChannelsPage.tsx`
- `components/dashboard/CoursesPage.tsx`
- `components/dashboard/ProductsPage.tsx`
