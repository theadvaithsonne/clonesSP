# `components/dashboard/AskCabinetSidebar.tsx`

> React component `AskCabinetSidebar`.

**Kind:** React component · **Lines:** 769 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `FormattedAnswer`×2 (local), `Bot`×2 (lucide-react), `TypingBubble` (local), `Send` (lucide-react), `AIProviderSelector` (components/dashboard/AIProviderSelector.tsx), `Clock` (lucide-react), `FileQnAAccordion` (local), `AIProviderRequiredModal` (components/dashboard/AIProviderRequiredModal.tsx)

### Props

- **`AskCabinetSidebar`**: `onClose?: () => void`

**Hooks used:** `useState`×7, `useEffect`×5, `useRef`×3, `useAIProvider` (lib/hooks/useAIProvider.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AskCabinetSidebar)` | component | `AskCabinetSidebar({ onClose, }: { onClose?: () => void; })` | 481 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/ask-cabinet` (L331)
  - `GET /backend/cabinet/search?query=${encodeURIComponent(
                item.fileName
              )}&organizationId=${orgId}` (L521)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get), `ask-cabinet-items` (localStorage: get/set)
- **Timers / queues:** `setTimeout` at L238, L584, L594

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `lib/askCabinetUtils.ts` — `generateAskCabinetPrompt`
  - `lib/hooks/useAIProvider.ts` — `useAIProvider`
  - `components/dashboard/AIProviderRequiredModal.tsx` — `AIProviderRequiredModal (default)`
  - `components/dashboard/AIProviderSelector.tsx` — `AIProviderSelector (default)`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `lucide-react` — `Clock`, `Send`, `Bot`, `ChevronDown`, `ChevronUp`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/layout.tsx`
