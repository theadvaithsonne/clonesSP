# `components/deals/DashboardFollowUpCard.tsx`

> React component `DashboardFollowUpCard`.

**Kind:** React component · **Lines:** 278 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DropdownMenuItem`×4 (components/ui/dropdown-menu.tsx), `FollowUpWhatsAppIcon` (components/deals/DashboardFollowUpActionIcons.tsx), `FollowUpEmailIcon` (components/deals/DashboardFollowUpActionIcons.tsx), `DropdownMenu` (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger` (components/ui/dropdown-menu.tsx), `FollowUpMoreIcon` (components/deals/DashboardFollowUpActionIcons.tsx), `DropdownMenuContent` (components/ui/dropdown-menu.tsx), `FollowUpLeadPinIcon` (components/deals/DashboardFollowUpActionIcons.tsx)

### Props

- **`DashboardFollowUpCard`**: `activity: DashboardFollowUpActivity`, `leadName?: string`, `leadId?: string`, `leadPhone?: string`, `leadEmail?: string`, `onClick?: () => void`, `onWhatsApp?: () => void`, `onEmail?: () => void`, `onEditLead?: () => void`, `onEditFollowUp?: () => void`, `onStopFollowUp?: () => void`, `onStartAutoFollowUp?: () => void`, `showDate?: boolean`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DashboardFollowUpActivity` | type |  | 16 |
| `toDisplayText` | function | `toDisplayText(value: unknown): string` | 34 |
| `default (DashboardFollowUpCard)` | component | `DashboardFollowUpCard({ activity, leadName, leadId, leadPhone, leadEmail, onClick…)` | 121 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/deals/DashboardFollowUpActionIcons.tsx` — `FollowUpEmailIcon`, `FollowUpLeadPinIcon`, `FollowUpMoreIcon`, `FollowUpWhatsAppIcon`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
- **Packages:** none

## Used by

- `app/(dashboard)/deals/page.tsx`
