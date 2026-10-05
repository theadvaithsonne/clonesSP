# `components/ui/navigation-menu.tsx`

> React components `NavigationMenu`, `NavigationMenuList`, `NavigationMenuItem`, `NavigationMenuContent` and 4 more.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 169

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `NavigationMenuPrimitive`×8 (@radix-ui/react-navigation-menu), `NavigationMenuViewport` (local), `ChevronDownIcon` (lucide-react)

### Props

- **`NavigationMenu`**: `className`, `children`, `viewport`, `props`
- **`NavigationMenuList`**: `props: React.ComponentProps<typeof NavigationMenuPrimitive.List>`
- **`NavigationMenuItem`**: `props: React.ComponentProps<typeof NavigationMenuPrimitive.Item>`
- **`NavigationMenuContent`**: `props: React.ComponentProps<typeof NavigationMenuPrimitive.Content>`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `NavigationMenu` | component | `NavigationMenu({ className, children, viewport = true, ...props }: React.C…)` | 159 |
| `NavigationMenuList` | component | `NavigationMenuList({ className, ...props }: React.ComponentProps<typeof Naviga…)` | 160 |
| `NavigationMenuItem` | component | `NavigationMenuItem({ className, ...props }: React.ComponentProps<typeof Naviga…)` | 161 |
| `NavigationMenuContent` | component | `NavigationMenuContent({ className, ...props }: React.ComponentProps<typeof Naviga…)` | 162 |
| `NavigationMenuTrigger` | component | `NavigationMenuTrigger({ className, children, ...props }: React.ComponentProps<typ…)` | 163 |
| `NavigationMenuLink` | component | `NavigationMenuLink({ className, ...props }: React.ComponentProps<typeof Naviga…)` | 164 |
| `NavigationMenuIndicator` | component | `NavigationMenuIndicator({ className, ...props }: React.ComponentProps<typeof Naviga…)` | 165 |
| `NavigationMenuViewport` | component | `NavigationMenuViewport({ className, ...props }: React.ComponentProps<typeof Naviga…)` | 166 |
| `navigationMenuTriggerStyle` | export |  | 167 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react`
  - `@radix-ui/react-navigation-menu`
  - `class-variance-authority` — `cva`
  - `lucide-react` — `ChevronDownIcon`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
