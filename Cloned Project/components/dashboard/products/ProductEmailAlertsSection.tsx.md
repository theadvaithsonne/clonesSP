# `components/dashboard/products/ProductEmailAlertsSection.tsx`

> React component `ProductEmailAlertsSection`.

**Kind:** React component · **Lines:** 404 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TemplatePickerDropdown` (components/dashboard/inlineApps/network-mail/campaign-create/template-picker-dropdown.tsx), `EmailPreviewCard` (components/shared/EmailTemplatePreview.tsx), `ArrowUpRight` (lucide-react), `CreateTemplateModal` (components/dashboard/inlineApps/network-mail/create-template-modal.tsx), `TemplateEditorModal` (components/dashboard/inlineApps/network-mail/template-editor-modal.tsx), `EmailFullPreviewModal` (components/shared/EmailTemplatePreview.tsx)

### Props

- **`ProductEmailAlertsSection`**: `value: ProductEmailAlertsValue`, `onChange: (next: ProductEmailAlertsValue) => void`, `onTemplateHtmlChange: (html: string | null, failure?: string | null) …`, `error?: string | null`, `product?: ProductEmailPreviewContext`

**Hooks used:** `useState`×9, `useEffect`×4, `useMemo`×3, `useRef`×2, `useCallback`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ProductEmailAlertsValue` | interface |  | 50 |
| `ProductEmailPreviewContext` | interface | Live form values, so the preview shows this product rather than sample text. | 57 |
| `ProductEmailAlertsSection` | component | `ProductEmailAlertsSection({ value, onChange, onTemplateHtmlChange, error, product, }:…)` | 64 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/org/${orgId}` (L187)

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/shared/EmailTemplatePreview.tsx` — `EmailFullPreviewModal`, `EmailPreviewCard`
  - `lib/network-mail-api.ts` — `createTemplate`, `formatTemplateListDate`, `getNetworkMailOrgId`, `listTemplates`, `updateTemplate`, `TemplateCategory as MailTemplateCategory`
  - `components/dashboard/inlineApps/network-mail/email-template-presets.ts` — `buildEmailTemplatePreset`
  - `components/dashboard/inlineApps/network-mail/email-html-export.ts` — `buildTemplateHtmlBody`
  - `components/dashboard/inlineApps/network-mail/create-template-modal.tsx` — `CreateTemplateModal`
  - `components/dashboard/inlineApps/network-mail/template-editor-modal.tsx` — `TemplateEditorModal`, `EditorModalTemplate`
  - `components/dashboard/inlineApps/network-mail/campaign-create/template-picker-dropdown.tsx` — `TemplatePickerDropdown`
  - `components/dashboard/inlineApps/network-mail/campaign-create/types.ts` — `CampaignTemplateItem`, `(types only)`
  - `lib/product-email-template.ts` — `DEFAULT_PRODUCT_EMAIL_TEMPLATE_ID`, `DEFAULT_PRODUCT_EMAIL_TEMPLATE_NAME`, `applySampleMergeData`, `escapeMergeValue`, `formatPreviewMoney`, `resolveProductEmailHtml`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `utils/api.ts` — `getUserData`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `ArrowUpRight`
  - `sonner` — `toast`

## Used by

- `components/dashboard/ChannelsPage.tsx`
- `components/dashboard/CoursesPage.tsx`
- `components/dashboard/ProductsPage.tsx`
- `components/dashboard/WorkshopsPage.tsx`
- `components/dashboard/products/useEmailAlerts.ts`
