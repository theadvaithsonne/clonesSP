# `components/shared/OrgWelcomeEmailSection.tsx`

> React component `OrgWelcomeEmailSection`.

**Kind:** React component · **Lines:** 423 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TemplatePickerDropdown` (components/dashboard/inlineApps/network-mail/campaign-create/template-picker-dropdown.tsx), `EmailPreviewCard` (components/shared/EmailTemplatePreview.tsx), `Check` (lucide-react), `Loader2` (lucide-react), `SendHorizonal` (lucide-react), `ArrowUpRight` (lucide-react), `CreateTemplateModal` (components/dashboard/inlineApps/network-mail/create-template-modal.tsx), `TemplateEditorModal` (components/dashboard/inlineApps/network-mail/template-editor-modal.tsx), `EmailFullPreviewModal` (components/shared/EmailTemplatePreview.tsx)

### Props

- **`OrgWelcomeEmailSection`**: `orgId: string`, `value: OrgWelcomeEmailValue`, `onChange: (next: OrgWelcomeEmailValue) => void`, `onTemplateHtmlChange: (html: string | null, failure?: string | null) …`, `org: OrgWelcomePreviewContext`

**Hooks used:** `useState`×10, `useEffect`×5, `useRef`×3, `useMemo`×3, `useCallback`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `OrgWelcomeEmailValue` | interface |  | 65 |
| `OrgWelcomeEmailSection` | component | `OrgWelcomeEmailSection({ orgId, value, onChange, onTemplateHtmlChange, org, }: { o…)` | 70 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/org/${orgId}/welcome-email/test` (L253)
- **Timers / queues:** `setTimeout` at L267

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `lib/network-mail-api.ts` — `createTemplate`, `formatTemplateListDate`, `getNetworkMailOrgId`, `listTemplates`, `updateTemplate`, `TemplateCategory as MailTemplateCategory`
  - `components/dashboard/inlineApps/network-mail/email-template-presets.ts` — `buildEmailTemplatePreset`
  - `components/dashboard/inlineApps/network-mail/email-html-export.ts` — `buildTemplateHtmlBody`
  - `components/dashboard/inlineApps/network-mail/create-template-modal.tsx` — `CreateTemplateModal`
  - `components/dashboard/inlineApps/network-mail/template-editor-modal.tsx` — `TemplateEditorModal`, `EditorModalTemplate`
  - `components/dashboard/inlineApps/network-mail/campaign-create/template-picker-dropdown.tsx` — `TemplatePickerDropdown`
  - `components/dashboard/inlineApps/network-mail/campaign-create/types.ts` — `CampaignTemplateItem`, `(types only)`
  - `components/shared/EmailTemplatePreview.tsx` — `EmailFullPreviewModal`, `EmailPreviewCard`
  - `lib/org-welcome-email-template.ts` — `DEFAULT_ORG_WELCOME_TEMPLATE_ID`, `DEFAULT_ORG_WELCOME_TEMPLATE_NAME`, `applyOrgWelcomeSampleData`, `buildOrgWelcomeOverrides`, `resolveOrgWelcomeEmailHtml`, `OrgWelcomePreviewContext`
  - `utils/api.ts` — `getUserData`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `react-dom` — `createPortal`
  - `lucide-react` — `ArrowUpRight`, `Check`, `Loader2`, `SendHorizonal`
  - `sonner` — `toast`

## Used by

- `components/shared/ManageOrgPopover.tsx`
