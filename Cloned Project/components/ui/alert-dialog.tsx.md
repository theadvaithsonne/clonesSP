# `components/ui/alert-dialog.tsx`

> React components `AlertDialogOverlay`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogFooter` and 4 more.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 148 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AlertDialogPrimitive`×6 (@radix-ui/react-alert-dialog), `AlertDialogPortal` (local), `AlertDialogOverlay` (local)

### Props

- **`AlertDialogHeader`**: `props: React.HTMLAttributes<HTMLDivElement>`
- **`AlertDialogFooter`**: `props: React.HTMLAttributes<HTMLDivElement>`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AlertDialog` | export |  | 136 |
| `AlertDialogPortal` | export |  | 137 |
| `AlertDialogOverlay` | component |  | 138 |
| `AlertDialogTrigger` | export |  | 139 |
| `AlertDialogContent` | component |  | 140 |
| `AlertDialogHeader` | component | `AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElemen…)` | 141 |
| `AlertDialogFooter` | component | `AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElemen…)` | 142 |
| `AlertDialogTitle` | component |  | 143 |
| `AlertDialogDescription` | component |  | 144 |
| `AlertDialogAction` | component |  | 145 |
| `AlertDialogCancel` | component |  | 146 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/ui/button.tsx` — `buttonVariants`
- **Packages:**
  - `react`
  - `@radix-ui/react-alert-dialog`

## Used by

- `app/(dashboard)/deals/leads/page-old.tsx`
- `app/(dashboard)/deals/products/page-old.tsx`
- `app/(dashboard)/deals/products/page.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/share-modal.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/chat-view.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/taskroom-group-chat.tsx`
- `app/(dashboard)/thoughts/components/NoteDrawer.tsx`
- `app/(dashboard)/thoughts/page.tsx`
- `app/(dashboard)/thoughts/recovery/page.tsx`
- `app/(dashboard)/thoughts/trash/page.tsx`
- `app/garage-admin/(admin-dashboard)/ai-providers/page.tsx`
- `app/garage-admin/(admin-dashboard)/coworking-spaces/[id]/page.tsx`
- `app/garage-admin/(admin-dashboard)/platform-fees/page.tsx`
- `app/garage-admin/(admin-dashboard)/roles/page.tsx`
- `app/meet/join/MeetAttendancePanel.tsx`
- `app/meet/join/MeetVideoCall.tsx`
- `components/athena/components/RoomSettingsPanel.tsx`
- `components/athena/components/SpaceSettingsPanel.tsx`
- `components/athena/components/WorkspaceSettingsDashboard.tsx`
- `components/athena/components/card-modal.tsx`
- `components/athena/components/share-modal.tsx`
- `components/checkout/CheckoutPaymentStep.tsx`
- `components/dashboard/CallsPage.tsx`
- `components/dashboard/ChannelsPage.tsx`
- `components/dashboard/ContentPage.tsx`
- _…and 16 more_
