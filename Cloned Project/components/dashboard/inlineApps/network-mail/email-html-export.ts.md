# `components/dashboard/inlineApps/network-mail/email-html-export.ts`

> Module exporting `esc`, `renderEmailTableBody`, `exportToHTML`, `resolveTemplatePreviewHtml` and 1 more.

**Kind:** React component · **Lines:** 322

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `esc` | function | `esc(str: string): string` | 6 |
| `renderEmailTableBody` | function | `renderEmailTableBody(components: ComponentBlock[]): string` — Table body fragment for in-app preview panes (no full HTML document wrapper). | 202 |
| `exportToHTML` | function | `exportToHTML(components: ComponentBlock[], title?: string): string` | 210 |
| `resolveTemplatePreviewHtml` | function | `resolveTemplatePreviewHtml(template: { components?: ComponentBlock[]; htmlBody?: strin…): string` — Prefer fresh client render from components so preview matches the editor. | 304 |
| `buildTemplateHtmlBody` | function | `buildTemplateHtmlBody(components: ComponentBlock[], name?: string): string` — Re-export stored htmlBody from current components before send/launch. | 316 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/network-mail/block-factory.ts` — `parseColumns`, `ComponentBlock`
  - `components/dashboard/inlineApps/network-mail/preheader-block.tsx` — `buildPreheaderExportFragments`
  - `components/dashboard/inlineApps/network-mail/footer-block.tsx` — `renderFooterEmail`
  - `components/dashboard/inlineApps/network-mail/social-icons.tsx` — `renderSocialIconsEmail`
- **Packages:** none

## Used by

- `components/dashboard/inlineApps/network-mail/NetworkMailApp.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-create/step-4-review.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-details-view.tsx`
- `components/dashboard/products/ProductEmailAlertsSection.tsx`
- `components/shared/OrgWelcomeEmailSection.tsx`
- `lib/network-mail-api.ts`
- `lib/org-welcome-email-template.ts`
- `lib/product-email-template.ts`
