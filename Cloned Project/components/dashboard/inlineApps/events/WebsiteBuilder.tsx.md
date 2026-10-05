# `components/dashboard/inlineApps/events/WebsiteBuilder.tsx`

> The visual Event Web Builder.

**Kind:** React component · **Lines:** 1113 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The visual Event Web Builder.

Three panes, same shape as the NetworkMail editor: a block library on the
left, a live canvas in the middle, and an inspector on the right. The canvas
renders `EventSiteRenderer` — the exact component the public page uses — so
what the founder sees here is what ships.

Draft vs live: everything edited here is the draft. "Publish to live site"
snapshots it server-side; until then the public page keeps serving the last
published version.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TextInput`×16 (components/dashboard/inlineApps/events/ui.tsx), `TextArea`×9 (components/dashboard/inlineApps/events/ui.tsx), `Button`×5 (components/dashboard/inlineApps/events/ui.tsx), `Eye`×2 (lucide-react), `EyeOff`×2 (lucide-react), `ColorField`×2 (local), `Select`×2 (components/dashboard/inlineApps/events/ui.tsx), `Loader2` (lucide-react), `Layers` (lucide-react), `Monitor` (lucide-react), `Smartphone` (lucide-react), `RotateCcw` (lucide-react), `Minimize2` (lucide-react), `ExternalLink` (lucide-react), `Save` (lucide-react), `Upload` (lucide-react), `GripVertical` (lucide-react), `Plus` (lucide-react), `EventSiteRenderer` (components/events/site/EventSiteRenderer.tsx), `BlockInspector` (local), `Icon` (local), `ChevronUp` (lucide-react), `ChevronDown` (lucide-react), `Trash2` (lucide-react), `LayoutControls` (local), `CheckRow` (local)

### Props

- **`WebsiteBuilder`**: `eventId: string`, `publicUrl: string`, `onExit?: () => void`

**Hooks used:** `useState`×11, `useRef`, `useConfirm` (components/dashboard/inlineApps/events/ui.tsx), `useCallback`, `useEffect`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (WebsiteBuilder)` | component | `WebsiteBuilder({ eventId, publicUrl, onExit, }: { eventId: string; publicU…)` | 112 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/events/site/EventSiteRenderer.tsx` — `EventSiteRenderer (default)`, `PublicTier`
  - `components/dashboard/inlineApps/events/ui.tsx` — `Button`, `GOLD`, `Select`, `TextArea`, `TextInput`, `useConfirm`
  - `components/dashboard/inlineApps/events/api.ts` — `getWebsite`, `publishWebsite`, `resetWebsite`, `saveWebsite`
  - `components/dashboard/inlineApps/events/types.ts` — `EventBlock`, `EventBlockType`, `EventProgram`, `EventSiteData`, `EventTheme`, `(types only)`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `ChevronDown`, `ChevronUp`, `ExternalLink`, `Eye`, `EyeOff`, `GripVertical`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/events/EventsApp.tsx`
