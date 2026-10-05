# `components/dashboard/TestimonialsPage.tsx`

> React component `TestimonialsPage`.

**Kind:** React component · **Lines:** 2512 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Input`×29 (components/ui/input.tsx), `Button`×28 (components/ui/button.tsx), `Label`×21 (components/ui/label.tsx), `Loader2`×8 (lucide-react), `X`×8 (lucide-react), `Star`×7 (lucide-react), `SelectItem`×7 (components/ui/select.tsx), `Plus`×6 (lucide-react), `Trash2`×6 (lucide-react), `Textarea`×5 (components/ui/textarea.tsx), `Building2`×4 (lucide-react), `Icon`×3 (local), `Edit`×3 (lucide-react), `Upload`×3 (lucide-react), `BarChart3`×3 (lucide-react), `ImageIcon`×3 (lucide-react), `Select`×2 (components/ui/select.tsx), `SelectTrigger`×2 (components/ui/select.tsx), `SelectValue`×2 (components/ui/select.tsx), `SelectContent`×2 (components/ui/select.tsx), `CategoryChip`×2 (local), `DropdownMenuItem`×2 (components/ui/dropdown-menu.tsx), `StatusBadge`×2 (local), `ArrowLeft`×2 (lucide-react), `ChevronDown`×2 (lucide-react), `Save`×2 (lucide-react), `Globe`×2 (lucide-react), `FileText`×2 (lucide-react), `Tag`×2 (lucide-react), `Quote`×2 (lucide-react), `Link2`×2 (lucide-react), `TestimonialCreateView` (local), `TestimonialEditView` (local), `ExternalLink` (lucide-react), `Search` (lucide-react), `Grid` (lucide-react), `List` (lucide-react), `DropdownMenu` (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger` (components/ui/dropdown-menu.tsx), `MoreVertical` (lucide-react), … +21 more

**Hooks used:** `useState`×30, `useEffect`×2, `useRef`×2, `useAmIFounder` (lib/hooks/useAmIFounder.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TestimonialsPage` | component | `TestimonialsPage()` | 163 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/affiliate/my-affiliate-id` (L189)
  - `POST /backend/upload?orgId=${getOrgId()}` (L784)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get), `garage_org_slug` (localStorage: get)
- **Timers / queues:** `setTimeout` at L326
- **External hosts mentioned in the code:** `youtube.com`, `www.youtube.com`

## Dependencies

- **Internal:**
  - `lib/testimonials-api.ts` — `getTestimonials`, `getTestimonial`, `createTestimonial`, `updateTestimonial`, `deleteTestimonial`, `publishTestimonial`, `addContentBlock`, `updateContentBlock`, … +10
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`, `DropdownMenuSeparator`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`
  - `lib/utils.ts` — `cn`
  - `lib/auth.ts` — `getToken`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `components/ui/rich-text-editor.tsx` — `RichTextEditor`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`
  - `framer-motion` — `motion`, `AnimatePresence`
  - `lucide-react` — `Star`, `Search`, `Grid`, `List`, `Filter`, `X`, …
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/layout.tsx`

## Notes

- Large file (2512 lines) — read it by section; line numbers above point into it.
