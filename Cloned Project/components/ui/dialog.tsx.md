# `components/ui/dialog.tsx`

> React components `Dialog`, `DialogClose`, `DialogContent`, `DialogDescription` and 6 more.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 144 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DialogPrimitive`×9 (@radix-ui/react-dialog), `DialogPortal` (local), `DialogOverlay` (local), `XIcon` (lucide-react)

### Props

- **`Dialog`**: `props: React.ComponentProps<typeof DialogPrimitive.Root>`
- **`DialogClose`**: `props: React.ComponentProps<typeof DialogPrimitive.Close>`
- **`DialogContent`**: `className`, `children`, `showCloseButton`, `props`
- **`DialogDescription`**: `props: React.ComponentProps<typeof DialogPrimitive.Description>`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Dialog` | component | `Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.R…)` | 133 |
| `DialogClose` | component | `DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.C…)` | 134 |
| `DialogContent` | component | `DialogContent({ className, children, showCloseButton = true, ...props }: …)` | 135 |
| `DialogDescription` | component | `DialogDescription({ className, ...props }: React.ComponentProps<typeof Dialog…)` | 136 |
| `DialogFooter` | component | `DialogFooter({ className, ...props }: React.ComponentProps<"div">)` | 137 |
| `DialogHeader` | component | `DialogHeader({ className, ...props }: React.ComponentProps<"div">)` | 138 |
| `DialogOverlay` | component | `DialogOverlay({ className, ...props }: React.ComponentProps<typeof Dialog…)` | 139 |
| `DialogPortal` | component | `DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.P…)` | 140 |
| `DialogTitle` | component | `DialogTitle({ className, ...props }: React.ComponentProps<typeof Dialog…)` | 141 |
| `DialogTrigger` | component | `DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.T…)` | 142 |

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

- `app/(dashboard)/auction/components/StartAuctionDialog.tsx`
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
- `app/(dashboard)/flowboard/[symbol]/components/card-attachments.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/card-modal.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/kanban-board.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/kanban-card.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/kanban-column.tsx`
- `app/(dashboard)/mail/page.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/SubtaskRow.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/ai-copilot.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/create-task-dialog.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/edit-task-dialog.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/files-view.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/manage-stages-dialog.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/right-side-panel.tsx`
- _…and 149 more_
