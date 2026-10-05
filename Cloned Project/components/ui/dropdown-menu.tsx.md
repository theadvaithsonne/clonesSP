# `components/ui/dropdown-menu.tsx`

> React components `DropdownMenu`, `DropdownMenuPortal`, `DropdownMenuTrigger`, `DropdownMenuContent` and 11 more.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 259 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DropdownMenuPrimitive`×17 (@radix-ui/react-dropdown-menu), `CheckIcon` (lucide-react), `CircleIcon` (lucide-react), `ChevronRightIcon` (lucide-react)

### Props

- **`DropdownMenu`**: `props: React.ComponentProps<typeof DropdownMenuPrimitive.Root>`
- **`DropdownMenuPortal`**: `props: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>`
- **`DropdownMenuTrigger`**: `props: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>`
- **`DropdownMenuContent`**: `props: React.ComponentProps<typeof DropdownMenuPrimitive.Content>`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DropdownMenu` | component | `DropdownMenu({ ...props }: React.ComponentProps<typeof DropdownMenuPrimi…)` | 243 |
| `DropdownMenuPortal` | component | `DropdownMenuPortal({ ...props }: React.ComponentProps<typeof DropdownMenuPrimi…)` | 244 |
| `DropdownMenuTrigger` | component | `DropdownMenuTrigger({ ...props }: React.ComponentProps<typeof DropdownMenuPrimi…)` | 245 |
| `DropdownMenuContent` | component | `DropdownMenuContent({ className, sideOffset = 4, ...props }: React.ComponentPro…)` | 246 |
| `DropdownMenuGroup` | component | `DropdownMenuGroup({ ...props }: React.ComponentProps<typeof DropdownMenuPrimi…)` | 247 |
| `DropdownMenuLabel` | component | `DropdownMenuLabel({ className, inset, ...props }: React.ComponentProps<typeof…)` | 248 |
| `DropdownMenuItem` | component | `DropdownMenuItem({ className, inset, variant = "default", ...props }: React.…)` | 249 |
| `DropdownMenuCheckboxItem` | component | `DropdownMenuCheckboxItem({ className, children, checked, ...props }: React.Component…)` | 250 |
| `DropdownMenuRadioGroup` | component | `DropdownMenuRadioGroup({ ...props }: React.ComponentProps<typeof DropdownMenuPrimi…)` | 251 |
| `DropdownMenuRadioItem` | component | `DropdownMenuRadioItem({ className, children, ...props }: React.ComponentProps<typ…)` | 252 |
| `DropdownMenuSeparator` | component | `DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof Dropdo…)` | 253 |
| `DropdownMenuShortcut` | component | `DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">)` | 254 |
| `DropdownMenuSub` | component | `DropdownMenuSub({ ...props }: React.ComponentProps<typeof DropdownMenuPrimi…)` | 255 |
| `DropdownMenuSubTrigger` | component | `DropdownMenuSubTrigger({ className, inset, children, ...props }: React.ComponentPr…)` | 256 |
| `DropdownMenuSubContent` | component | `DropdownMenuSubContent({ className, ...props }: React.ComponentProps<typeof Dropdo…)` | 257 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react`
  - `@radix-ui/react-dropdown-menu`
  - `lucide-react` — `CheckIcon`, `ChevronRightIcon`, `CircleIcon`

## Used by

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
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/SubtaskRow.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/files-view.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/right-side-panel.tsx`
- `app/(dashboard)/taskroom/assigned-to-me/components/edit-task-dialog.tsx`
- `app/(dashboard)/taskroom/assigned-to-me/page.tsx`
- `app/(dashboard)/thoughts/components/NoteCard.tsx`
- `app/(dashboard)/thoughts/components/NoteDrawer.tsx`
- `app/(dashboard)/thoughts/components/NoteSharePopover.tsx`
- `app/(dashboard)/thoughts/components/NoteViewer.tsx`
- `app/(dashboard)/thoughts/page.tsx`
- `app/careers/components/VacancyCard.tsx`
- `app/garage-admin/(admin-dashboard)/layout.tsx`
- `app/taskroom/[workspace]/settings/people/[space]/page.tsx`
- `app/taskroom/components/create-room-dialog.tsx`
- `app/taskroom/components/create-space-dialog.tsx`
- _…and 48 more_
