# `components/dashboard/InitialSetupPage.tsx`

> React component `InitialSetupPage`.

**Kind:** React component · **Lines:** 2288 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×20 (components/ui/button.tsx), `Loader2`×12 (lucide-react), `Check`×6 (lucide-react), `Server`×6 (lucide-react), `Input`×5 (components/ui/input.tsx), `X`×5 (lucide-react), `RefreshCw`×5 (lucide-react), `AnimatePresence`×5 (framer-motion), `CheckCircle2`×4 (lucide-react), `Globe`×4 (lucide-react), `Copy`×4 (lucide-react), `Trash2`×4 (lucide-react), `Plus`×4 (lucide-react), `Send`×3 (lucide-react), `Paperclip`×3 (lucide-react), `Mail`×2 (lucide-react), `Badge`×2 (components/ui/badge.tsx), `Inbox`×2 (lucide-react), `FileEdit`×2 (lucide-react), `ShieldAlert`×2 (lucide-react), `FolderArchive`×2 (lucide-react), `ChevronDown`×2 (lucide-react), `UserCircle`×2 (lucide-react), `AlertCircle` (lucide-react), `EmailSenderSetup` (components/dashboard/EmailSenderSetup.tsx), `ArrowRight` (lucide-react), `Menu` (lucide-react), `Image` (next/image), `Search` (lucide-react), `PenSquare` (lucide-react), `ChevronUp` (lucide-react), `MoreVertical` (lucide-react), `Star` (lucide-react), `ArrowLeft` (lucide-react), `Archive` (lucide-react), `MailOpen` (lucide-react)

**Hooks used:** `useState`×39, `useEffect`×2, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (InitialSetupPage)` | component | `InitialSetupPage()` | 122 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/initial-setup/domain-config?orgId=${orgId}` (L187)
  - `GET /backend/initial-setup/status?orgId=${orgId}` (L192)
  - `GET /backend/initial-setup/user-mailboxes?orgId=${orgId}` (L193)
  - `POST /backend/initial-setup/domain-config` (L225)
  - `POST /backend/initial-setup/verify-dns` (L253)
  - `POST /backend/initial-setup/add-domain-to-mailcow` (L290)
  - `POST /backend/initial-setup/save-mailbox` (L343)
  - `GET /backend/initial-setup/emails?orgId=${orgId}&folder=${folder}&limit=50` (L373)
  - `POST /backend/initial-setup/sync-emails` (L397)
  - `GET /backend/initial-setup/fetch-inbox?orgId=${orgId}&folder=${folder}&limit=50` (L421)
  - `POST /backend/initial-setup/reset-domain-config` (L578)
  - `POST /backend/initial-setup/send-email` (L612)
  - `POST /backend/initial-setup/switch-mailbox` (L1274)
  - `POST /backend/initial-setup/add-user-mailbox` (L2020)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L630, L1304

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/badge.tsx` — `Badge`
  - `components/dashboard/EmailSenderSetup.tsx` — `EmailSenderSetup (default)`
  - `lib/mail-api.ts` — `createMailbox as createMailboxDirect`, `isApiSuccess`, `getApiErrorMessage`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useCallback`
  - `framer-motion` — `motion`, `AnimatePresence`
  - `lucide-react` — `Globe`, `Mail`, `Check`, `X`, `RefreshCw`, `Copy`, …
  - `next`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/layout.tsx`

## Notes

- Large file (2288 lines) — read it by section; line numbers above point into it.
