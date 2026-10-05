# `components/shared/ChannelMultiSelect.tsx`

> ChannelMultiSelect — a founder-facing picker for restricting an item (course / product / workshop / etc.) to members of specific channels.

**Kind:** React component · **Lines:** 146 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
ChannelMultiSelect — a founder-facing picker for restricting an item
(course / product / workshop / etc.) to members of specific channels.

When the item's `channelIds` array is empty, the item is unrestricted
(visible to every stakeholder in the org). When non-empty, the BE
filter (see services/channelMembership.ts::getUserChannelIds) shows the
item only to members of at least one of the selected channels.

Extracted from the inline picker in WorkshopsPage.tsx (audience block).
All Workshops-page behaviours preserved: individual per-row toggle
switches, a header "Select All / Deselect All" affordance, per-channel
avatar + member count, and an empty state when the org has no channels.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Users` (lucide-react), `Switch` (components/ui/switch.tsx)

### Props

- **`ChannelMultiSelect`**: `channels: ChannelOption[]`, `selectedIds: string[]`, `onChange: (nextSelectedIds: string[]) => void`, `label?: string`, `required?: boolean`, `hint?: string`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ChannelOption` | interface |  | 22 |
| `ChannelMultiSelect` | component | `ChannelMultiSelect({ channels, selectedIds, onChange, label = "Select Communit…)` | 50 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/ui/switch.tsx` — `Switch`
- **Packages:**
  - `react`
  - `lucide-react` — `Users`

## Used by

- `components/dashboard/CoursesPage.tsx`
- `components/dashboard/ProductsPage.tsx`
