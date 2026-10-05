# `components/ui/form.tsx`

> React components `FormItem`, `FormLabel`, `FormControl`, `FormDescription` and 2 more.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 168 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `FormFieldContext` (local), `Controller` (react-hook-form), `FormItemContext` (local), `Label` (components/ui/label.tsx), `Slot` (@radix-ui/react-slot)

### Props

- **`FormItem`**: `props: React.ComponentProps<"div">`
- **`FormLabel`**: `props: React.ComponentProps<typeof LabelPrimitive.Root>`
- **`FormControl`**: `props: React.ComponentProps<typeof Slot>`
- **`FormDescription`**: `props: React.ComponentProps<"p">`

**Hooks used:** `useFormField`×4 (local), `useFormContext` (react-hook-form), `useFormState` (react-hook-form)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useFormField` | hook | `useFormField()` | 159 |
| `Form` | export |  | 160 |
| `FormItem` | component | `FormItem({ className, ...props }: React.ComponentProps<"div">)` | 161 |
| `FormLabel` | component | `FormLabel({ className, ...props }: React.ComponentProps<typeof LabelP…)` | 162 |
| `FormControl` | component | `FormControl({ ...props }: React.ComponentProps<typeof Slot>)` | 163 |
| `FormDescription` | component | `FormDescription({ className, ...props }: React.ComponentProps<"p">)` | 164 |
| `FormMessage` | component | `FormMessage({ className, ...props }: React.ComponentProps<"p">)` | 165 |
| `FormField` | component | `FormField({ ...props }: ControllerProps<TFieldValues, TName>)` | 166 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/ui/label.tsx` — `Label`
- **Packages:**
  - `react`
  - `@radix-ui/react-label`
  - `@radix-ui/react-slot` — `Slot`
  - `react-hook-form` — `Controller`, `FormProvider`, `useFormContext`, `useFormState`, `ControllerProps`, `FieldPath`, …

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
