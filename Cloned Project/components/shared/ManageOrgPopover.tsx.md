# `components/shared/ManageOrgPopover.tsx`

> React component `ManageOrgPopover`.

**Kind:** React component · **Lines:** 2276 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×24 (components/ui/label.tsx), `Input`×16 (components/ui/input.tsx), `Loader2`×8 (lucide-react), `UploadThingFileUpload`×8 (components/ui/uploadthing-file-upload.tsx), `MapPin`×7 (lucide-react), `SelectItem`×6 (components/ui/select.tsx), `Button`×6 (components/ui/button.tsx), `X`×4 (lucide-react), `Textarea`×4 (components/ui/textarea.tsx), `Select`×4 (components/ui/select.tsx), `SelectTrigger`×4 (components/ui/select.tsx), `SelectValue`×4 (components/ui/select.tsx), `SelectContent`×4 (components/ui/select.tsx), `Crop`×2 (lucide-react), `AnimatePresence`×2 (framer-motion), `Building`×2 (lucide-react), `Check`×2 (lucide-react), `CountryNamePicker`×2 (components/ui/country-name-picker.tsx), `CoverFramingControls`×2 (local), `Link`×2 (lucide-react), `Palette`×2 (lucide-react), `Type`×2 (lucide-react), `Mail`×2 (lucide-react), `OrgWelcomeEmailSection`×2 (components/shared/OrgWelcomeEmailSection.tsx), `OrgKycSection`×2 (components/shared/OrgKycSection.tsx), `Trash2`×2 (lucide-react), `Save` (lucide-react), `ImageCropDialog` (components/shared/ImageCropDialog.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `AlertTriangle` (lucide-react), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `DialogFooter` (components/ui/dialog.tsx)

### Props

- **`ManageOrgPopover`**: `isOpen: boolean`, `onClose: () => void`

**Hooks used:** `useState`×20, `useRef`×2, `useEffect`×2, `useCallback`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ManageOrgPopover` | component | `ManageOrgPopover({ isOpen, onClose }: ManageOrgPopoverProps)` | 210 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/org/categories` (L311)
  - `GET /backend/org/resolve-pincode?pincode=${encodeURIComponent(pincode)}` (L328)
  - `GET /backend/org/${orgId}` (L363)
  - `PUT /backend/org/${orgId}` (L551)
  - `DELETE /backend/org/${orgId}` (L634)
- **Other fetch/api calls (target not statically resolvable):**
  - `PUT ${apiUrl}/org/${orgId}/branding` (L602)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get/remove)
- **Timers / queues:** `setTimeout` at L354, L620
- **External hosts mentioned in the code:** `youtube.com`

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `lib/utils.ts` — `cn`
  - `components/ui/country-name-picker.tsx` — `CountryNamePicker (default)`
  - `components/shared/OrgKycSection.tsx` — `OrgKycSection (default)`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `lib/brand-color-context.tsx` — `notifyBrandingChanged`
  - `components/ui/uploadthing-file-upload.tsx` — `UploadThingFileUpload`
  - `components/shared/ImageCropDialog.tsx` — `ImageCropDialog (default)`, `CropState`
  - `lib/uploadthing.ts` — `uploadFiles`
  - `lib/coverOriginal.ts` — `resolveCropSource`, `resolveOriginalToRemember`, `writeCoverOriginal`
  - `components/shared/OrgWelcomeEmailSection.tsx` — `OrgWelcomeEmailSection`, `OrgWelcomeEmailValue`
  - `lib/org-welcome-email-template.ts` — `DEFAULT_ORG_WELCOME_TEMPLATE_ID`, `DEFAULT_ORG_WELCOME_TEMPLATE_NAME`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useCallback`, `useMemo`
  - `sonner` — `toast`
  - `lucide-react` — `Building`, `Crop`, `MapPin`, `Save`, `X`, `Loader2`, …
  - `framer-motion` — `motion`, `AnimatePresence`

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/MainSidebar.tsx`

## Notes

- Large file (2276 lines) — read it by section; line numbers above point into it.
