# `components/dashboard/SupportTicketModal.tsx`

> React component `SupportTicketModal`.

**Kind:** React component · **Lines:** 536 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/ui/button.tsx), `MessageCircleQuestion`×2 (lucide-react), `Select`×2 (components/ui/select.tsx), `SelectTrigger`×2 (components/ui/select.tsx), `SelectValue`×2 (components/ui/select.tsx), `SelectContent`×2 (components/ui/select.tsx), `SelectItem`×2 (components/ui/select.tsx), `Loader2`×2 (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogTrigger` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `Input` (components/ui/input.tsx), `ModIcon` (local), `Icon` (local), `Textarea` (components/ui/textarea.tsx), `AnimatePresence` (framer-motion), `FileIcon` (local), `X` (lucide-react), `Paperclip` (lucide-react)

### Props

- **`SupportTicketModal`**: `children?: React.ReactNode`, `onTicketCreated?: () => void`

**Hooks used:** `useState`×7, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (SupportTicketModal)` | component | `SupportTicketModal({ children, onTicketCreated, }: SupportTicketModalProps)` | 132 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/upload` (L164)
  - `POST /backend/support-tickets?orgId=${orgId}` (L220)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L258

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogTrigger`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`, `useRef`
  - `lucide-react` — `MessageCircleQuestion`, `X`, `CheckCircle`, `Loader2`, `Paperclip`, `AlertTriangle`, …
  - `sonner` — `toast`
  - `framer-motion` — `motion`, `AnimatePresence`

## Used by

- `components/dashboard/SupportTicketsPage.tsx`
