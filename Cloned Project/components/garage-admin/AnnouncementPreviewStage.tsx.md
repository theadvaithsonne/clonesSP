# `components/garage-admin/AnnouncementPreviewStage.tsx`

> The preview backdrop for Alerts & Promotions.

**Kind:** React component · **Lines:** 191 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The preview backdrop for Alerts & Promotions.

The card on its own tells an admin nothing about *placement* — a Compact
dialog and a Top Banner look equally fine floating in a void. This renders
the announcement over a schematic of the page it will actually land on
(the login screen, or the dashboard), dimmed exactly the way the live
overlay dims it.

It is a scaled-down fixed viewport, not a responsive layout: the card is
the real component at its real pixel width, and the whole 1200×750 stage is
transform-scaled to fit whatever space the preview pane has. That way a
Wide (768px) card and a Compact (384px) card stay honestly different sizes
relative to the page behind them.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Bar`×11 (local), `AnnouncementCard`×2 (components/announcements/AnnouncementCard.tsx), `PreLoginBackdrop` (local), `PostLoginBackdrop` (local)

### Props

- **`AnnouncementPreviewStage`**: `data: AnnouncementDraft`, `surface: "pre-login" | "post-login"`

**Hooks used:** `useRef`, `useState`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AnnouncementPreviewStage)` | component | `AnnouncementPreviewStage({ data, surface, }: { data: AnnouncementDraft; /** Which pa…)` | 119 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/announcements/AnnouncementCard.tsx` — `AnnouncementCard (default)`
  - `lib/announcements.ts` — `AnnouncementDraft`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`

## Used by

- `components/garage-admin/AnnouncementsConsole.tsx`
