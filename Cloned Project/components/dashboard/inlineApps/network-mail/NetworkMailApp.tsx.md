# `components/dashboard/inlineApps/network-mail/NetworkMailApp.tsx`

> React components `NetworkMailApp`, `TemplateEditorView`.

**Kind:** React component · **Lines:** 5613 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `CollapsibleSection`×33 (local), `SliderInput`×32 (local), `PropertyField`×24 (local), `SearchSelect`×14 (local), `Check`×11 (lucide-react), `Trash2`×11 (lucide-react), `ColorPicker`×11 (local), `Icon`×9 (local), `ToolbarBtn`×8 (local), `PropInput`×6 (local), `SpacingInputs`×5 (local), `X`×3 (lucide-react), `ResponsiveEmailFrame`×3 (components/shared/EmailTemplatePreview.tsx), `Upload`×3 (lucide-react), `Plus`×3 (lucide-react), `Lock`×3 (lucide-react), `Unlock`×3 (lucide-react), `DynamicFieldsCard`×3 (components/dashboard/inlineApps/network-mail/merge-variable-picker.tsx), `Link`×3 (lucide-react), `Monitor`×2 (lucide-react), `Smartphone`×2 (lucide-react), `Pencil`×2 (lucide-react), `Code2`×2 (lucide-react), `ExternalLink`×2 (lucide-react), `MergeVariableAutocomplete`×2 (components/dashboard/inlineApps/network-mail/merge-variable-picker.tsx), `Tag`×2 (local), `ImageIcon`×2 (lucide-react), `Building2`×2 (lucide-react), `FooterBlockRenderer`×2 (components/dashboard/inlineApps/network-mail/footer-block.tsx), `GripVertical`×2 (lucide-react), `NetworkMailComingSoon`×2 (local), `TemplateLibrarySection` (local), `CampaignsSection` (local), `ReportsSection` (local), `SettingsSection` (local), `Clipboard` (lucide-react), `Download` (lucide-react), `SendHorizonal` (lucide-react), `MoveVertical` (lucide-react), `SocialIconGlyph` (components/dashboard/inlineApps/network-mail/social-icons.tsx), … +62 more

### Props

- **`NetworkMailApp`**: `props: InlineAppProps`
- **`TemplateEditorView`**: `template: EditorTemplate`, `onBack: () => void`, `exitRequestNonce?: number`

**Hooks used:** `useState`×71, `useEffect`×31, `useCallback`×31, `useRef`×17, `useMemo`×8, `useNetworkMailEditor`×4 (components/dashboard/inlineApps/network-mail/network-mail-editor-context.tsx), `useDrag`×3 (react-dnd), `useDrop`×3 (react-dnd)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (NetworkMailApp)` | component | `NetworkMailApp({ onClose, section }: InlineAppProps)` | 218 |
| `TemplateEditorView` | component | `TemplateEditorView({ template, onBack, exitRequestNonce = 0, }: { template: Ed…)` | 4103 |

## Interfaces

- **Timers / queues:** `setTimeout` at L670, L679, L718, L1969, L2162, …; `setInterval` at L5367
- **External hosts mentioned in the code:** `yourcompany.com`

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/registry.ts` — `InlineAppProps`, `(types only)`
  - `components/dashboard/inlineApps/network-mail/social-icons.tsx` — `SocialIconsBlockRenderer`, `SocialIconsPropertiesPanel`, `parseSocialIcons`, `getVisibleIcons`, `SocialIconGlyph`, `getIconContainerStyle`, `getIconFillColor`, `BRAND_COLORS`
  - `components/dashboard/inlineApps/network-mail/footer-block.tsx` — `FooterBlockRenderer`, `FooterPropertiesPanel`, `formatAddress`
  - `components/dashboard/inlineApps/network-mail/preheader-block.tsx` — `PreheaderBlockRenderer`, `PreheaderPropertiesPanel`, `sortComponentsWithPreheaderFirst`
  - `components/dashboard/inlineApps/network-mail/block-factory.ts` — `createBlock`, `makeId`, `parseColumns`, `serializeColumns`, `makeColumnsContent`, `BlockType`, `ComponentBlock`, `ColumnData`
  - `components/dashboard/inlineApps/network-mail/email-template-presets.ts` — `EMAIL_TEMPLATE_PRESETS`, `buildEmailTemplatePreset`, `EmailTemplatePresetId`
  - `components/dashboard/inlineApps/network-mail/email-html-export.ts` — `exportToHTML`, `resolveTemplatePreviewHtml`
  - `components/shared/EmailTemplatePreview.tsx` — `ResponsiveEmailFrame`
  - `components/dashboard/inlineApps/network-mail/merge-variables.ts` — `applyMergeSamples`, `mergeToken`, `pickableLinkVariables`
  - `components/dashboard/inlineApps/network-mail/merge-variable-picker.tsx` — `DynamicFieldsCard`, `MergeVariableAutocomplete`, `VariablePickerButton`, `editableFromSelection`, `insertTokenAtCaret`
  - `lib/network-mail-api.ts` — `createTemplate`, `deleteTemplate`, `formatTemplateListDate`, `getNetworkMailOrgId`, `getTemplate`, `listTemplates`, `publishTemplate`, `sendTemplateTestEmail`, … +4
  - `components/dashboard/inlineApps/network-mail/network-mail-editor-context.tsx` — `NetworkMailEditorProvider`, `useNetworkMailEditor`
  - `lib/api-config.ts` — `buildExternalUrl`
  - `components/dashboard/inlineApps/network-mail/template-image-upload.ts` — `resolveEditorImageSrc`
  - `components/dashboard/inlineApps/network-mail/campaign-table.tsx` — `CampaignTable`, `CampaignRow`
  - `components/dashboard/inlineApps/network-mail/campaign-details-view.tsx` — `CampaignDetailsView`
  - `components/dashboard/inlineApps/network-mail/campaign-create/campaign-create-flow.tsx` — `CampaignCreateFlow`
  - `components/dashboard/inlineApps/network-mail/create-template-modal.tsx` — `CreateTemplateModal`
  - `components/dashboard/inlineApps/network-mail/unsaved-changes-dialog.tsx` — `UnsavedChangesDialog`
  - `components/dashboard/inlineApps/network-mail/delete-campaign-dialog.tsx` — `DeleteCampaignDialog`
  - `lib/network-mail-campaigns-api.ts` — `apiStatusToDisplayStatus`, `apiStatusToTableFilter`, `deleteCampaign`, `duplicateCampaign`, `formatCampaignListDate`, `listCampaigns`, `CampaignListItem`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`
  - `lucide-react` — `LayoutGrid`, `Send`, `BarChart3`, `Settings`, `X`, `Mail`, …
  - `react-dnd` — `DndProvider`, `useDrag`, `useDrop`
  - `react-dnd-html5-backend` — `HTML5Backend`
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/network-mail/template-editor-modal.tsx`
- `components/dashboard/inlineApps/registry.ts`

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L1429).
- Large file (5613 lines) — read it by section; line numbers above point into it.
