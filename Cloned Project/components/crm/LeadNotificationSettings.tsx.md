# `components/crm/LeadNotificationSettings.tsx`

> React component `LeadNotificationSettings`.

**Kind:** React component · **Lines:** 186 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×4 (components/ui/button.tsx), `Label`×4 (components/ui/label.tsx), `Switch`×3 (components/ui/switch.tsx), `Dialog` (components/ui/dialog.tsx), `DialogTrigger` (components/ui/dialog.tsx), `Bell` (lucide-react), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `Smartphone` (lucide-react), `Mail` (lucide-react), `Input` (components/ui/input.tsx), `TestTube` (lucide-react)

### Props

- **`LeadNotificationSettings`**: `preferences: NotificationPreferences`, `onPreferencesChange: (prefs: NotificationPreferences) => void`, `isEnabled: boolean`, `onEnabledChange: (enabled: boolean) => void`, `onTestNotification?: () => void`

**Hooks used:** `useState`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `LeadNotificationSettings` | component | `LeadNotificationSettings({ preferences, onPreferencesChange, isEnabled, onEnabledCha…)` | 33 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogHeader`, `DialogTitle`, `DialogTrigger`
  - `components/ui/switch.tsx` — `Switch`
  - `components/ui/input.tsx` — `Input`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Bell`, `Mail`, `Smartphone`, `TestTube`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/deals/page.tsx`
