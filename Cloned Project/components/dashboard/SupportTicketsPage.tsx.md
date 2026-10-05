# `components/dashboard/SupportTicketsPage.tsx`

> React component `SupportTicketsPage`.

**Kind:** React component · **Lines:** 1564 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Badge`×12 (components/ui/badge.tsx), `SelectItem`×8 (components/ui/select.tsx), `Button`×6 (components/ui/button.tsx), `Loader2`×5 (lucide-react), `Avatar`×5 (components/ui/avatar.tsx), `AvatarImage`×5 (components/ui/avatar.tsx), `AvatarFallback`×5 (components/ui/avatar.tsx), `Building`×4 (lucide-react), `Select`×3 (components/ui/select.tsx), `SelectTrigger`×3 (components/ui/select.tsx), `Building2`×3 (lucide-react), `SelectValue`×3 (components/ui/select.tsx), `SelectContent`×3 (components/ui/select.tsx), `AnimatePresence`×3 (framer-motion), `MessageCircleQuestion`×2 (lucide-react), `SupportTicketModal`×2 (components/dashboard/SupportTicketModal.tsx), `Plus`×2 (lucide-react), `CheckCircle2`×2 (lucide-react), `ModIcon`×2 (local), `PriorityIcon`×2 (local), `Icon`×2 (local), `XCircle`×2 (lucide-react), `X`×2 (lucide-react), `User`×2 (lucide-react), `FileIcon`×2 (local), `MessageSquare`×2 (lucide-react), `ChevronLeft` (lucide-react), `RefreshCw` (lucide-react), `AlertCircle` (lucide-react), `Clock` (lucide-react), `Search` (lucide-react), `Input` (components/ui/input.tsx), `Filter` (lucide-react), `UserPlus` (lucide-react), `ChevronRight` (lucide-react), `Paperclip` (lucide-react), `Textarea` (components/ui/textarea.tsx), `Send` (lucide-react), `StatusIcon` (local)

**Hooks used:** `useState`×17, `useEffect`×7, `useAmIFounder` (lib/hooks/useAmIFounder.ts), `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (SupportTicketsPage)` | component | `SupportTicketsPage()` | 218 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/support-tickets/check-global-admin` (L279)
  - `GET /backend/support-tickets/assignment/team-members` (L298)
  - `GET /backend/support-tickets/assignment/floors` (L303)
  - `PATCH /backend/support-tickets/${selectedTicket._id}/assign` (L329)
  - `PATCH /backend/support-tickets/${selectedTicket._id}/unassign` (L356)
  - `POST /backend/upload` (L577)
- **Socket.IO events:**
  - emits: `support:join-org`, `support:join-global`, `support:leave-org`, `support:leave-global`, `support:join-ticket`, `support:leave-ticket`
  - listens for: `support:new-ticket`, `support:ticket-response`, `support:ticket-status-changed`, `support:ticket-assigned`, `support:ticket-unassigned`
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `lib/utils.ts` — `cn`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `components/dashboard/SupportTicketModal.tsx` — `SupportTicketModal (default)`
  - `lib/socket.ts` — `connectSocket`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useCallback`
  - `sonner` — `toast`
  - `lucide-react` — `MessageCircleQuestion`, `X`, `Loader2`, `Send`, `Clock`, `CheckCircle2`, …
  - `framer-motion` — `motion`, `AnimatePresence`

## Used by

- `app/(dashboard)/layout.tsx`

## Notes

- Large file (1564 lines) — read it by section; line numbers above point into it.
