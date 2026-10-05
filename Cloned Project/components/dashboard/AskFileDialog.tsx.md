# `components/dashboard/AskFileDialog.tsx`

> React component `AskFileDialog`.

**Kind:** React component · **Lines:** 260 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `TypingBubble` (local), `Button` (components/ui/button.tsx), `Send` (lucide-react)

### Props

- **`AskFileDialog`**: `open: boolean`, `onOpenChange: (v: boolean) => void`, `fileId: string | null`, `fileName?: string`

**Hooks used:** `useState`×4, `useRef`×3, `useEffect`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AskFileDialog` | component | `AskFileDialog({ open, onOpenChange, fileId, fileName, }: { open: boolean;…)` | 24 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/ask-cabinet` (L148)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L54

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
  - `components/ui/button.tsx` — `Button`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `lib/askCabinetUtils.ts` — `generateAskCabinetPrompt`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `Loader2`, `Send`

## Used by

- `components/dashboard/CabinetPage.tsx`
- `components/dashboard/FloorCabinetPage.tsx`
- `components/dashboard/FounderCabinetPage.tsx`
- `components/dashboard/OrganizationCabinetPage.tsx`
