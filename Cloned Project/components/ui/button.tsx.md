# `components/ui/button.tsx`

> React component `Button`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 60

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Comp` (local)

### Props

- **`Button`**: `className`, `variant`, `size`, `asChild`, `props`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Button` | component | `Button({ className, variant, size, asChild = false, ...props }: Re…)` | 59 |
| `buttonVariants` | export |  | 59 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react`
  - `@radix-ui/react-slot` — `Slot`
  - `class-variance-authority` — `cva`, `VariantProps`

## Used by

- `app/(affiliate)/[orgSlug]/[channelId]/page.tsx`
- `app/(affiliate)/[orgSlug]/page.tsx`
- `app/(auth)/guest-login/GuestLogin.tsx`
- `app/(auth)/guest-verify/GuestVerify.tsx`
- `app/(auth)/verify/page.tsx`
- `app/(dashboard)/ask-cabinet/page.tsx`
- `app/(dashboard)/auction/components/StartAuctionDialog.tsx`
- `app/(dashboard)/cabinet/editor/[documentId]/page.tsx`
- `app/(dashboard)/deals/companies/page.tsx`
- `app/(dashboard)/deals/contacts/page.tsx`
- `app/(dashboard)/deals/facebook/facebookintegration.jsx`
- `app/(dashboard)/deals/funnel/page.tsx`
- `app/(dashboard)/deals/leads/[id]/page.tsx`
- `app/(dashboard)/deals/leads/page-old.tsx`
- `app/(dashboard)/deals/leads/page.tsx`
- `app/(dashboard)/deals/page.tsx`
- `app/(dashboard)/deals/products/page-old.tsx`
- `app/(dashboard)/deals/products/page.tsx`
- `app/(dashboard)/domains/page.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/card-activity.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/card-attachments.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/card-modal.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/kanban-board-list-view.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/kanban-board.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/kanban-card.tsx`
- _…and 435 more_
