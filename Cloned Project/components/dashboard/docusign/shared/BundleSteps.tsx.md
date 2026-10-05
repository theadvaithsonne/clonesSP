# `components/dashboard/docusign/shared/BundleSteps.tsx`

> React component `BundleSteps`.

**Kind:** React component · **Lines:** 66 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Icon` (local)

### Props

- **`BundleSteps`**: `bundle: DsBundleStepper`, `currentId: string`, `onSelect: (documentId: string) => void`, `disabled?: boolean`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `isStepOpen` | function | `isStepOpen(d: Step)` | 12 |
| `nextOpenStep` | function | `nextOpenStep(bundle: DsBundleStepper \| null \| undefined, currentId: string): Step \| null` | 15 |
| `BundleSteps` | component | `BundleSteps({ bundle, currentId, onSelect, disabled }: BundleStepsProps)` | 30 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/docusign/types.ts` — `DsBundleStepper`, `(types only)`
- **Packages:**
  - `lucide-react` — `CheckCircle2`, `Circle`, `XCircle`

## Used by

- `app/(dashboard)/workspace/sign/[token]/PublicSigningView.tsx`
- `components/dashboard/docusign/internal/SigningView.tsx`
