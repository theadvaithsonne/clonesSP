# `lib/product-email-template.ts`

> Module exporting `applySampleMergeData`, `escapeMergeValue`, `formatPreviewMoney`, `buildDefaultProductEmailHtml` and 1 more.

**Kind:** frontend library · **Lines:** 115

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DEFAULT_PRODUCT_EMAIL_TEMPLATE_ID` | const | `= "__default__"` — Sentinel for the built-in Garage order-confirmation template. | 16 |
| `DEFAULT_PRODUCT_EMAIL_TEMPLATE_NAME` | const | `= "Default — Order Confirmation"` | 17 |
| `PRODUCT_EMAIL_MERGE_TAGS` | const | `= [ { key: "first_name", label: "Customer first name", sample: "Priya" }, { key: "busines…` — The merge-tag contract between this form and the backend sender (`garagenew-backend/src/services/productOrderEmail.ts`). | 24 |
| `applySampleMergeData` | function | `applySampleMergeData(html: string, overrides?: Record<string, string>): string` — Swaps `{{tags}}` for readable values so the founder previews an email rather than a page of raw placeholders. | 59 |
| `escapeMergeValue` | function | `escapeMergeValue(value: unknown): string` — Merge values are user-authored — escape before splicing into the preview. | 70 |
| `formatPreviewMoney` | function | `formatPreviewMoney(amount: number, currency?: string): string` — Mirrors the backend's `formatMoney` so the previewed total matches what the customer will actually receive. | 82 |
| `buildDefaultProductEmailHtml` | function | `buildDefaultProductEmailHtml(): string` — The built-in default, rendered from the shared preset builders. | 93 |
| `resolveProductEmailHtml` | function | `async resolveProductEmailHtml(orgId: string, templateId: string): Promise<string>` — Resolves the HTML that will be snapshotted onto the product. | 105 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/network-mail/email-template-presets.ts` — `buildEmailTemplatePreset`
  - `components/dashboard/inlineApps/network-mail/email-html-export.ts` — `exportToHTML`, `resolveTemplatePreviewHtml`
  - `components/dashboard/inlineApps/network-mail/merge-variables.ts` — `MERGE_SAMPLE_VALUES`
  - `lib/network-mail-api.ts` — `getTemplate`
- **Packages:** none

## Used by

- `components/dashboard/products/ProductEmailAlertsSection.tsx`
- `components/dashboard/products/useEmailAlerts.ts`
- `lib/org-welcome-email-template.ts`
