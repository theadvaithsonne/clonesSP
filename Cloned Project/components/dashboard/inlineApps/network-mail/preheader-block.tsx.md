# `components/dashboard/inlineApps/network-mail/preheader-block.tsx`

> React components `PreheaderBlockRenderer`, `PreheaderPropertiesPanel`.

**Kind:** React component · **Lines:** 346 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `PropertyField`×4 (local), `CollapsibleSection`×3 (local), `EyeOff` (lucide-react), `Trash2` (lucide-react), `SliderInput` (local)

### Props

- **`PreheaderBlockRenderer`**: `block: EmailBlock`, `onUpdate: (b: EmailBlock) => void`
- **`PreheaderPropertiesPanel`**: `block: EmailBlock`, `onUpdate: (b: EmailBlock) => void`, `onDelete: () => void`, `ColorPicker: React.ComponentType<{ label: string; value: string; onCh…`

**Hooks used:** `useState`×2, `useRef`, `useEffect`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `createPreheaderBlockContent` | function | `createPreheaderBlockContent(): Record<string, string>` | 19 |
| `createPreheaderBlockStyles` | function | `createPreheaderBlockStyles(): Record<string, string>` | 25 |
| `renderPreheaderHidden` | function | `renderPreheaderHidden(content: Record<string, string>, esc: (str: string) => string): string` | 41 |
| `renderPreheaderVisibleRow` | function | `renderPreheaderVisibleRow(s: Record<string, string>, content: Record<string, string>, esc: (str: string) => string): string` | 49 |
| `buildPreheaderExportFragments` | function | `buildPreheaderExportFragments(components: EmailBlock[], esc: (str: string) => string): { hiddenHtml: string; visibleRows: string }` | 59 |
| `sortComponentsWithPreheaderFirst` | function | `sortComponentsWithPreheaderFirst(components: T[]): T[]` | 75 |
| `PreheaderBlockRenderer` | component | `PreheaderBlockRenderer({ block, onUpdate, }: { block: EmailBlock; onUpdate: (b: Em…)` | 81 |
| `PreheaderPropertiesPanel` | component | `PreheaderPropertiesPanel({ block, onUpdate, onDelete, ColorPicker, }: { block: Email…)` | 232 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useMemo`
  - `lucide-react` — `EyeOff`, `Trash2`

## Used by

- `components/dashboard/inlineApps/network-mail/NetworkMailApp.tsx`
- `components/dashboard/inlineApps/network-mail/block-factory.ts`
- `components/dashboard/inlineApps/network-mail/email-html-export.ts`
- `components/dashboard/inlineApps/network-mail/email-template-presets.ts`
