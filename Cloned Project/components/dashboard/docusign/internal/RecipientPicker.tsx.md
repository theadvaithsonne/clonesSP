# `components/dashboard/docusign/internal/RecipientPicker.tsx`

> React component `RecipientPicker`.

**Kind:** React component · **Lines:** 194 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/ui/button.tsx), `UserPlus` (lucide-react), `ChevronDown` (lucide-react), `Search` (lucide-react), `Input` (components/ui/input.tsx), `Loader2` (lucide-react), `ChevronLeft` (lucide-react), `ChevronRight` (lucide-react)

### Props

- **`RecipientPicker`**: `members: OrgMemberLite[]`, `excludeIds: string[]`, `onLoadMembers: () => Promise<boolean>`, `onPick: (member: OrgMemberLite) => void`

**Hooks used:** `useState`×5, `useMemo`×2, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RECIPIENT_PICKER_PAGE_SIZE` | const | `= 8` | 9 |
| `filterMembers` | function | `filterMembers(members: OrgMemberLite[], query: string, excludeIds: Set<string>): OrgMemberLite[]` | 17 |
| `RecipientPicker` | component | `RecipientPicker({ members, excludeIds, onLoadMembers, onPick }: RecipientPi…)` | 42 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `store/docusign/docusignStore.ts` — `OrgMemberLite`, `(types only)`
- **Packages:**
  - `react` — `useMemo`, `useRef`, `useState`
  - `lucide-react` — `ChevronDown`, `ChevronLeft`, `ChevronRight`, `Loader2`, `Search`, `UserPlus`

## Used by

- `components/dashboard/docusign/internal/RecipientsPanel.tsx`
