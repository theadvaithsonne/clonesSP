# `components/dashboard/DomainManagementPage.tsx`

> React component `DomainManagementPage`.

**Kind:** React component · **Lines:** 1047 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Badge`×13 (components/ui/badge.tsx), `Button`×12 (components/ui/button.tsx), `CheckCircle2`×7 (lucide-react), `Loader2`×6 (lucide-react), `Globe`×4 (lucide-react), `Server`×3 (lucide-react), `RefreshCw`×3 (lucide-react), `AlertCircle`×3 (lucide-react), `Copy`×3 (lucide-react), `Clock`×2 (lucide-react), `Star`×2 (lucide-react), `Shield` (lucide-react), `X` (lucide-react), `Plus` (lucide-react), `DomainSearchPanel` (components/dashboard/DomainSearchPanel.tsx), `AnimatePresence` (framer-motion), `Input` (components/ui/input.tsx), `ExternalLink` (lucide-react), `Trash2` (lucide-react)

**Hooks used:** `useState`×15, `useEffect`×3, `useCallback`×2, `useAmIFounder` (lib/hooks/useAmIFounder.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (DomainManagementPage)` | component | `DomainManagementPage()` | 74 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/initial-setup/domain-config?orgId=${orgId}` (L128)
  - `GET /backend/initial-setup/app-domains?orgId=${orgId}` (L132)
  - `POST /backend/initial-setup/verify-dns` (L179)
  - `POST /backend/initial-setup/add-domain-to-mailcow` (L215)
  - `POST /backend/initial-setup/add-app-domain` (L247)
  - `POST /backend/initial-setup/verify-app-domain` (L276)
  - `DELETE /backend/initial-setup/app-domain` (L308)
  - `POST /backend/initial-setup/set-primary-app-domain` (L325)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/dashboard/DomainSearchPanel.tsx` — `DomainSearchPanel`
  - `components/ui/badge.tsx` — `Badge`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `lib/whitelabel-addon-api.ts` — `fetchWhitelabelStatus`, `WhitelabelStatusResponse`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useCallback`
  - `framer-motion` — `motion`, `AnimatePresence`
  - `lucide-react` — `Globe`, `Check`, `X`, `RefreshCw`, `Copy`, `CheckCircle2`, …
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/ManagementPage.tsx`
