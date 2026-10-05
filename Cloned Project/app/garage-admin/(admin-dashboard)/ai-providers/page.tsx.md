# `app/garage-admin/(admin-dashboard)/ai-providers/page.tsx`

> Next.js page rendered at `/garage-admin/ai-providers`.

**Kind:** Next.js page · **Lines:** 498 · **Directive:** `"use client"` · **Route:** `/garage-admin/ai-providers` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×5 (components/ui/button.tsx), `Loader2`×3 (lucide-react), `Info`×2 (lucide-react), `Pencil` (lucide-react), `Trash2` (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `ExternalLink` (lucide-react), `Input` (components/ui/input.tsx), `EyeOff` (lucide-react), `Eye` (lucide-react), `DialogFooter` (components/ui/dialog.tsx), `AlertDialog` (components/ui/alert-dialog.tsx), `AlertDialogContent` (components/ui/alert-dialog.tsx), `AlertDialogHeader` (components/ui/alert-dialog.tsx), `AlertDialogTitle` (components/ui/alert-dialog.tsx), `AlertDialogDescription` (components/ui/alert-dialog.tsx), `AlertDialogFooter` (components/ui/alert-dialog.tsx), `AlertDialogCancel` (components/ui/alert-dialog.tsx), `AlertDialogAction` (components/ui/alert-dialog.tsx)

**Hooks used:** `useState`×9, `useAdminAccess` (components/garage-admin/use-admin-access.ts), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AIProvidersPage)` | component | `AIProvidersPage()` | 133 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/ai-providers/keys?orgId=${parsedAdmin.organizationId || ""}` (L167)
  - `POST /backend/ai-providers/keys` (L222)
  - `DELETE /backend/ai-providers/keys/${deleteProvider.id}?orgId=${parsedAdmin.organizationId || ""}` (L261)
- **Browser storage / cookies:** `garage_admin_token` (localStorage: get), `garage_admin_info` (localStorage: get)
- **External hosts mentioned in the code:** `platform.openai.com`, `console.anthropic.com`, `replicate.com`, `aistudio.google.com`

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`
  - `lib/api.ts` — `api`
  - `components/garage-admin/use-admin-access.ts` — `useAdminAccess`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Pencil`, `Trash2`, `ExternalLink`, `Info`, `Loader2`, `Eye`, …
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/ai-providers` (page).
