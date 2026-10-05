# `components/dashboard/inlineApps/network-mail/email-template-presets.ts`

> Module exporting `buildEmailTemplatePreset`.

**Kind:** React component · **Lines:** 575

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EmailTemplatePresetId` | type |  | 11 |
| `EmailTemplatePreset` | interface |  | 19 |
| `ORDER_CONFIRMATION_BANNER_URL` | const | `= "https://nela-app.s3.us-east-1.amazonaws.com/network-mail/miQW7D60qk/6a76d827c28044471c…` — Garage default for digital-product order alerts. | 216 |
| `EMAIL_TEMPLATE_PRESETS` | const | `= [ { id: "welcome", name: "Welcome Email", description: "Logo, welcome message, hero ima…` | 531 |
| `buildEmailTemplatePreset` | function | `buildEmailTemplatePreset(id: EmailTemplatePresetId): ComponentBlock[]` | 570 |

## Interfaces

- **External hosts mentioned in the code:** `yourcompany.com`, `nela-app.s3.us-east-1.amazonaws.com`

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/network-mail/block-factory.ts` — `createComponent`, `makeId`, `serializeColumns`, `ComponentBlock`, `ColumnData`
  - `components/dashboard/inlineApps/network-mail/footer-block.tsx` — `FOOTER_PRESETS`, `serializeFooterLinks`
  - `components/dashboard/inlineApps/network-mail/preheader-block.tsx` — `sortComponentsWithPreheaderFirst`
- **Packages:** none

## Used by

- `components/dashboard/inlineApps/network-mail/NetworkMailApp.tsx`
- `components/dashboard/products/ProductEmailAlertsSection.tsx`
- `components/shared/OrgWelcomeEmailSection.tsx`
- `lib/network-mail-api.ts`
- `lib/org-welcome-email-template.ts`
- `lib/product-email-template.ts`
