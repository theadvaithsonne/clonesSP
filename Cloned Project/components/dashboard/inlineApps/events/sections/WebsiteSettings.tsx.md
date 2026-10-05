# `components/dashboard/inlineApps/events/sections/WebsiteSettings.tsx`

> Everything about the event's public site except the blocks themselves: the domain it answers on, the brand marks, how it appears in search, and how it unfurls when someone pastes the link.

**Kind:** React component · **Lines:** 806 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Everything about the event's public site except the blocks themselves:
the domain it answers on, the brand marks, how it appears in search, and
how it unfurls when someone pastes the link.

Domain is deliberately a three-step flow — claim, create DNS records,
verify — rather than a text field that instantly says "connected". Nothing
here marks a domain live; only a real DNS lookup on the server does.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Card`×4 (components/dashboard/inlineApps/events/ui.tsx), `SectionHead`×4 (local), `TextInput`×4 (components/dashboard/inlineApps/events/ui.tsx), `Button`×3 (components/dashboard/inlineApps/events/ui.tsx), `ImageSlot`×3 (local), `Loader2`×2 (lucide-react), `CopyButton`×2 (local), `AlertTriangle`×2 (lucide-react), `Upload`×2 (lucide-react), `TextArea`×2 (components/dashboard/inlineApps/events/ui.tsx), `Label`×2 (components/dashboard/inlineApps/events/ui.tsx), `Globe` (lucide-react), `DomainStatus` (local), `ExternalLink` (lucide-react), `Trash2` (lucide-react), `RefreshCw` (lucide-react), `Search` (lucide-react), `KeywordInput` (local), `Toggle` (components/dashboard/inlineApps/events/ui.tsx), `Share2` (lucide-react), `Select` (components/dashboard/inlineApps/events/ui.tsx), `ImageCropDialog` (components/shared/ImageCropDialog.tsx), `Check` (lucide-react), `Copy` (lucide-react)

### Props

- **`WebsiteSettings`**: `eventId: string`, `eventName: string`, `publicUrl: string`

**Hooks used:** `useState`×15, `useRef`×3, `useEffect`×2, `useConfirm` (components/dashboard/inlineApps/events/ui.tsx), `useCallback`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (WebsiteSettings)` | component | `WebsiteSettings({ eventId, eventName, publicUrl, }: { eventId: string; even…)` | 63 |

## Interfaces

- **Timers / queues:** `setTimeout` at L675
- **External hosts mentioned in the code:** `my.garage.app`

## Dependencies

- **Internal:**
  - `components/shared/ImageCropDialog.tsx` — `ImageCropDialog (default)`
  - `lib/share-image.ts` — `SHARE_IMAGE_HEIGHT`, `SHARE_IMAGE_WIDTH`, `checkShareImage`, `toShareJpeg`, `ShareImageIssue`
  - `components/dashboard/inlineApps/events/ui.tsx` — `Button`, `Card`, `GOLD`, `Label`, `Select`, `TextArea`, `TextInput`, `Toggle`, … +1
  - `components/dashboard/inlineApps/events/api.ts` — `addEventDomain`, `getWebsite`, `removeEventDomain`, `saveWebsiteSettings`, `uploadEventImage`, `verifyEventDomain`, `DnsRecord`, `EventDomain`, … +1
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `AlertTriangle`, `Check`, `Copy`, `ExternalLink`, `Globe`, `Loader2`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/events/EventConsole.tsx`
