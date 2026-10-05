# `components/ui/accordion.tsx`

> React components `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 67 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AccordionPrimitive`×5 (@radix-ui/react-accordion), `ChevronDownIcon` (lucide-react)

### Props

- **`Accordion`**: `props: React.ComponentProps<typeof AccordionPrimitive.Root>`
- **`AccordionItem`**: `props: React.ComponentProps<typeof AccordionPrimitive.Item>`
- **`AccordionTrigger`**: `props: React.ComponentProps<typeof AccordionPrimitive.Trigger>`
- **`AccordionContent`**: `props: React.ComponentProps<typeof AccordionPrimitive.Content>`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Accordion` | component | `Accordion({ ...props }: React.ComponentProps<typeof AccordionPrimitiv…)` | 66 |
| `AccordionItem` | component | `AccordionItem({ className, ...props }: React.ComponentProps<typeof Accord…)` | 66 |
| `AccordionTrigger` | component | `AccordionTrigger({ className, children, ...props }: React.ComponentProps<typ…)` | 66 |
| `AccordionContent` | component | `AccordionContent({ className, children, ...props }: React.ComponentProps<typ…)` | 66 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react`
  - `@radix-ui/react-accordion`
  - `lucide-react` — `ChevronDownIcon`

## Used by

- `app/garage-admin/(admin-dashboard)/unilevel-plus-licenses/page.tsx`
