# `components/deals/ProductOnboardingFlow.tsx`

> React component `ProductOnboardingFlow`.

**Kind:** React component · **Lines:** 930 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×12 (components/ui/label.tsx), `Input`×8 (components/ui/input.tsx), `Button`×6 (components/ui/button.tsx), `TabsTrigger`×5 (components/ui/tabs.tsx), `ArrowLeft`×4 (lucide-react), `TabsContent`×3 (components/ui/tabs.tsx), `SelectItem`×3 (components/ui/select.tsx), `Tabs`×2 (components/ui/tabs.tsx), `TabsList`×2 (components/ui/tabs.tsx), `Select`×2 (components/ui/select.tsx), `SelectTrigger`×2 (components/ui/select.tsx), `SelectValue`×2 (components/ui/select.tsx), `SelectContent`×2 (components/ui/select.tsx), `UploadCloud`×2 (lucide-react), `Textarea` (components/ui/textarea.tsx), `Download` (lucide-react), `X` (lucide-react), `Plus` (lucide-react)

### Props

- **`ProductOnboardingFlow`**: `setIsAddProductOpen?: (isOpen: boolean) => void`, `onProductCreated?: () => void`, `editProduct?: any`, `isEditMode?: boolean`

**Hooks used:** `useState`×19, `useUser` (context/UserContext.tsx), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ProductOnboardingFlow)` | component | `ProductOnboardingFlow({ setIsAddProductOpen, onProductCreated, editProduct, isEdi…)` | 116 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/tabs.tsx` — `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `utils/uploadthing.ts` — `uploadFiles`
  - `utils/api.ts` — `authenticatedFetch`
  - `lib/api-config.ts` — `buildExternalUrl`
  - `context/UserContext.tsx` — `useUser`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `ArrowLeft`, `UploadCloud`, `Download`, `Plus`, `X`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/deals/products/page.tsx`
