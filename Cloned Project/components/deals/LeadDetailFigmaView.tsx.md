# `components/deals/LeadDetailFigmaView.tsx`

> React component `LeadDetailFigmaView`.

**Kind:** React component · **Lines:** 1238 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `CardShell`×7 (local), `Input`×6 (components/ui/input.tsx), `SectionHeader`×5 (local), `Button`×4 (components/ui/button.tsx), `Check`×2 (lucide-react), `StageNavButton`×2 (local), `Textarea`×2 (components/ui/textarea.tsx), `Trash2`×2 (lucide-react), `Copy`×2 (lucide-react), `Mail`×2 (lucide-react), `FigmaSquareCheckIcon` (local), `Circle` (lucide-react), `Icon` (local), `StagePipelineBar` (local), `X` (lucide-react), `ShoppingBag` (lucide-react), `ActivityTabs` (local), `Popover` (components/ui/popover.tsx), `PopoverTrigger` (components/ui/popover.tsx), `ChevronsUpDown` (lucide-react), `PopoverContent` (components/ui/popover.tsx), `Command` (components/ui/command.tsx), `CommandInput` (components/ui/command.tsx), `CommandList` (components/ui/command.tsx), `CommandEmpty` (components/ui/command.tsx), `CommandGroup` (components/ui/command.tsx), `CommandItem` (components/ui/command.tsx), `Switch` (components/ui/switch.tsx), `Info` (lucide-react), `TimelineIcon` (local), `RoundTaskCheckbox` (local), `User` (lucide-react), `Edit` (lucide-react), `Phone` (lucide-react), `WhatsAppIcon` (components/icons/WhatsAppIcon.tsx), `MapPin` (lucide-react), `Tag` (lucide-react), `FileText` (lucide-react), `Download` (lucide-react)

### Props

- **`LeadDetailFigmaView`**: `lead: any`, `tags: string[]`, `products: any[]`, `funnelStages: Array<{ name: string; probability?: number } | string>`, `displayLeadName: string`, `displayEmail: string`, `displayPhone: string`, `funnelDisplayName: string`, `dateAddedLabel: string`, `lastActivityLabel: string`, `ownerName: string`, `company: { name: string; location: string; industry: string; } | null`, `hasCompany: boolean`, `timelineItems: TimelineItem[]`, `activityTab: ActivityTab`, `onActivityTabChange: (tab: ActivityTab) => void`, `taskForm: { title: string; description: string; dueDate: string; prio…`, `onTaskFormChange: (form: LeadDetailFigmaViewProps["taskForm"]) => void`, `inlineFollowupForm: InlineFollowupForm`, `onInlineFollowupFormChange: (form: InlineFollowupForm) => void`, `editLeadUsers: any[]`, `isSubmittingTask: boolean`, `isSubmittingFollowUp: boolean`, `isSubmittingAutoFollowUp: boolean`, `… +17 more`

**Hooks used:** `useState`×4, `useCallback`×2, `useEffect`×2, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FIGMA` | const | `= { bg: "#181818", card: "#1a1a1a", activityCard: "#121215", border: "#3a3a3a", borderSub…` | 45 |
| `ActivityTab` | type |  | 64 |
| `TimelineItem` | type |  | 66 |
| `InlineFollowupForm` | type |  | 81 |
| `default (LeadDetailFigmaView)` | component | `LeadDetailFigmaView({ lead, tags, products, funnelStages, displayLeadName, disp…)` | 467 |
| `formatDueLabel` | function | `formatDueLabel(dateStr?: string): string \| undefined` | 1237 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/switch.tsx` — `Switch`
  - `components/ui/command.tsx` — `Command`, `CommandEmpty`, `CommandGroup`, `CommandInput`, `CommandItem`, `CommandList`
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
  - `components/icons/WhatsAppIcon.tsx` — `WhatsAppIcon`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`
  - `lucide-react` — `Check`, `ChevronsUpDown`, `Circle`, `ChevronLeft`, `ChevronRight`, `Copy`, …
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/deals/leads/[id]/page.tsx`
- `app/(dashboard)/deals/page.tsx`
- `components/deals/AddCompanyDialog.tsx`
- `components/deals/AddContactDialog.tsx`
- `components/deals/AddDocumentDialog.tsx`
- `components/deals/AddProductDialog.tsx`
- `components/deals/AddTagDialog.tsx`
- `components/deals/EditLeadProfileDialog.tsx`
- `components/deals/cms/CmsPasswordDialog.tsx`
