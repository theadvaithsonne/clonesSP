# `components/ui/command.tsx`

> React components `Command`, `CommandDialog`, `CommandInput`, `CommandList` and 5 more.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 152

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `CommandPrimitive`×7 (cmdk), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `Command` (local), `Search` (lucide-react)

### Props

- **`CommandDialog`**: `props: DialogProps`
- **`CommandShortcut`**: `props: React.HTMLAttributes<HTMLSpanElement>`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Command` | component |  | 142 |
| `CommandDialog` | component | `CommandDialog({ children, ...props }: DialogProps)` | 143 |
| `CommandInput` | component |  | 144 |
| `CommandList` | component |  | 145 |
| `CommandEmpty` | component |  | 146 |
| `CommandGroup` | component |  | 147 |
| `CommandItem` | component |  | 148 |
| `CommandShortcut` | component | `CommandShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanEleme…)` | 149 |
| `CommandSeparator` | component |  | 150 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`
- **Packages:**
  - `react`
  - `@radix-ui/react-dialog` — `DialogProps`
  - `cmdk` — `Command as CommandPrimitive`
  - `lucide-react` — `Search`

## Used by

- `app/(dashboard)/deals/leads/page.tsx`
- `app/(dashboard)/deals/page.tsx`
- `app/(onboarding)/organization/page.tsx`
- `app/taskroom/components/create-space-dialog.tsx`
- `components/athena/components/create-space-dialog.tsx`
- `components/crm/DealsNavbar.tsx`
- `components/deals/LeadDetailFigmaView.tsx`
- `components/deals/NewLeadFlow.tsx`
