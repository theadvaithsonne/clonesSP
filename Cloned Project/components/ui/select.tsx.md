# `components/ui/select.tsx`

> React components `Select`, `SelectContent`, `SelectGroup`, `SelectItem` and 6 more.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 186 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `SelectPrimitive`×15 (@radix-ui/react-select), `ChevronDownIcon`×2 (lucide-react), `SelectScrollUpButton` (local), `SelectScrollDownButton` (local), `CheckIcon` (lucide-react), `ChevronUpIcon` (lucide-react)

### Props

- **`Select`**: `props: React.ComponentProps<typeof SelectPrimitive.Root>`
- **`SelectContent`**: `props: React.ComponentProps<typeof SelectPrimitive.Content>`
- **`SelectGroup`**: `props: React.ComponentProps<typeof SelectPrimitive.Group>`
- **`SelectItem`**: `props: React.ComponentProps<typeof SelectPrimitive.Item>`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Select` | component | `Select({ ...props }: React.ComponentProps<typeof SelectPrimitive.R…)` | 175 |
| `SelectContent` | component | `SelectContent({ className, children, position = "popper", ...props }: Rea…)` | 176 |
| `SelectGroup` | component | `SelectGroup({ ...props }: React.ComponentProps<typeof SelectPrimitive.G…)` | 177 |
| `SelectItem` | component | `SelectItem({ className, children, ...props }: React.ComponentProps<typ…)` | 178 |
| `SelectLabel` | component | `SelectLabel({ className, ...props }: React.ComponentProps<typeof Select…)` | 179 |
| `SelectScrollDownButton` | component | `SelectScrollDownButton({ className, ...props }: React.ComponentProps<typeof Select…)` | 180 |
| `SelectScrollUpButton` | component | `SelectScrollUpButton({ className, ...props }: React.ComponentProps<typeof Select…)` | 181 |
| `SelectSeparator` | component | `SelectSeparator({ className, ...props }: React.ComponentProps<typeof Select…)` | 182 |
| `SelectTrigger` | component | `SelectTrigger({ className, size = "default", children, ...props }: React.…)` | 183 |
| `SelectValue` | component | `SelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.V…)` | 184 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react`
  - `@radix-ui/react-select`
  - `lucide-react` — `CheckIcon`, `ChevronDownIcon`, `ChevronUpIcon`

## Used by

- `app/(dashboard)/auction/components/StartAuctionDialog.tsx`
- `app/(dashboard)/deals/companies/page.tsx`
- `app/(dashboard)/deals/contacts/page.tsx`
- `app/(dashboard)/deals/facebook/facebookintegration.jsx`
- `app/(dashboard)/deals/leads/[id]/page.tsx`
- `app/(dashboard)/deals/leads/page-old.tsx`
- `app/(dashboard)/deals/leads/page.tsx`
- `app/(dashboard)/deals/page.tsx`
- `app/(dashboard)/deals/products/page-old.tsx`
- `app/(dashboard)/deals/products/page.tsx`
- `app/(dashboard)/domains/page.tsx`
- `app/(dashboard)/mail/page.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/create-task-dialog.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/edit-task-dialog.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/list-view.tsx`
- `app/(dashboard)/taskroom/assigned-to-me/components/edit-task-dialog.tsx`
- `app/(dashboard)/taskroom/overview/page.tsx`
- `app/(landing)/book-demo/page.tsx`
- `app/(onboarding)/organization/page.tsx`
- `app/careers/components/ApplicationsTab.tsx`
- `app/careers/components/CreateVacancyDialog.tsx`
- `app/garage-admin/(admin-dashboard)/unilevel-plus-licenses/page.tsx`
- `app/taskroom/components/ListView.tsx`
- `app/taskroom/components/task-stage-template-dialog.tsx`
- `components/admin/AdminSavedCardsPanel.tsx`
- _…and 62 more_
