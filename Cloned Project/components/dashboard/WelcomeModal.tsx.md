# `components/dashboard/WelcomeModal.tsx`

> React component `WelcomeModal`.

**Kind:** React component · **Lines:** 92 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/ui/button.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `Sparkles` (lucide-react), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `Users` (lucide-react), `TrendingUp` (lucide-react), `Zap` (lucide-react), `DialogFooter` (components/ui/dialog.tsx)

### Props

- **`WelcomeModal`**: `open: boolean`, `onClose: () => void`, `onGoToWallet: () => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (WelcomeModal)` | component | `WelcomeModal({ open, onClose, onGoToWallet, }: WelcomeModalProps)` | 20 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`
  - `components/ui/button.tsx` — `Button`
- **Packages:**
  - `lucide-react` — `Sparkles`, `Zap`, `Users`, `TrendingUp`

## Used by

- `app/(dashboard)/layout.tsx`
