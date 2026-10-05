# `components/ui/sheet.tsx`

> React components `Sheet`, `SheetTrigger`, `SheetClose`, `SheetContent` and 4 more.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 140 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `SheetPrimitive`×8 (@radix-ui/react-dialog), `SheetPortal` (local), `SheetOverlay` (local)

### Props

- **`Sheet`**: `props: React.ComponentProps<typeof SheetPrimitive.Root>`
- **`SheetTrigger`**: `props: React.ComponentProps<typeof SheetPrimitive.Trigger>`
- **`SheetClose`**: `props: React.ComponentProps<typeof SheetPrimitive.Close>`
- **`SheetContent`**: `className`, `children`, `side`, `props`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Sheet` | component | `Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Ro…)` | 131 |
| `SheetTrigger` | component | `SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Tr…)` | 132 |
| `SheetClose` | component | `SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Cl…)` | 133 |
| `SheetContent` | component | `SheetContent({ className, children, side = "right", ...props }: React.Co…)` | 134 |
| `SheetHeader` | component | `SheetHeader({ className, ...props }: React.ComponentProps<"div">)` | 135 |
| `SheetFooter` | component | `SheetFooter({ className, ...props }: React.ComponentProps<"div">)` | 136 |
| `SheetTitle` | component | `SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetP…)` | 137 |
| `SheetDescription` | component | `SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetP…)` | 138 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react`
  - `@radix-ui/react-dialog`
  - `lucide-react` — `XIcon`

## Used by

- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/chat-view.tsx`
- `app/(dashboard)/thoughts/components/NoteDrawer.tsx`
- `app/(dashboard)/thoughts/components/VersionHistory.tsx`
- `app/garage-admin/(admin-dashboard)/platform-coupons/page.tsx`
- `app/taskroom/components/ListView.tsx`
- `app/taskroom/components/backuplistlive.tsx`
- `components/athena/components/ListView.tsx`
- `components/dashboard/CashbackCodeSheet.tsx`
- `components/dashboard/CouponAssignmentSheet.tsx`
- `components/dashboard/CouponRuleEditor.tsx`
- `components/dashboard/FounderPlatformCouponsPage.tsx`
- `components/dashboard/HqRoomSchedule.tsx`
- `components/dashboard/OpenClawMarketplacePage.tsx`
- `components/dashboard/inlineApps/deals/DealsMobileNav.tsx`
- `components/shared/Header.tsx`
- `components/shared/ProfilePopover.tsx`
- `components/ui/searchable-select.tsx`
