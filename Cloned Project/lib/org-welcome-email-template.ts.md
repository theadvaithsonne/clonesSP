# `lib/org-welcome-email-template.ts`

> Module exporting `formatOrgLocation`, `buildOrgWelcomeOverrides`, `applyOrgWelcomeSampleData`, `buildDefaultOrgWelcomeHtml` and 1 more.

**Kind:** frontend library · **Lines:** 131

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DEFAULT_ORG_WELCOME_TEMPLATE_ID` | const | `= "__default__"` — Sentinel for the built-in Garage welcome email. | 22 |
| `DEFAULT_ORG_WELCOME_TEMPLATE_NAME` | const | `= "Default — Organization Welcome"` | 23 |
| `ORG_WELCOME_MERGE_TAGS` | const | `= MERGE_VARIABLES.filter( (v) => v.category !== "Order & Purchase", ).map((v) => ({ key: v.key, lab…` — The merge-tag contract between this form and the backend sender (`garagenew-backend/src/services/welcomeEmail.ts`). | 33 |
| `OrgWelcomePreviewContext` | interface | Real org values the founder should see instead of sample text. | 38 |
| `formatOrgLocation` | function | `formatOrgLocation(org: OrgWelcomePreviewContext): string` — "City, State, Country", skipping whatever the org hasn't filled in. | 50 |
| `buildOrgWelcomeOverrides` | function | `buildOrgWelcomeOverrides(org: OrgWelcomePreviewContext): Record<string, string>` — Merge values for the tags we can know at design time — everything about the organization. | 62 |
| `applyOrgWelcomeSampleData` | function | `applyOrgWelcomeSampleData(html: string, overrides?: Record<string, string>): string` — Swaps `{{tags}}` for readable values so the founder previews an email rather than a page of raw placeholders. | 100 |
| `stripEmptyImages` | const | `= stripEmptyImagesFromHtml` — Drops `<img>` tags left with an empty `src` after substitution. | 108 |
| `buildDefaultOrgWelcomeHtml` | function | `buildDefaultOrgWelcomeHtml(): string` — The built-in default, rendered from the shared preset builders. | 111 |
| `resolveOrgWelcomeEmailHtml` | function | `async resolveOrgWelcomeEmailHtml(orgId: string, templateId: string): Promise<string>` — Resolves the HTML that will be snapshotted onto the organization. | 121 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/network-mail/email-template-presets.ts` — `buildEmailTemplatePreset`
  - `components/dashboard/inlineApps/network-mail/email-html-export.ts` — `exportToHTML`, `resolveTemplatePreviewHtml`
  - `components/dashboard/inlineApps/network-mail/merge-variables.ts` — `MERGE_VARIABLES`, `applyMergeSamples`, `stripEmptyImages as stripEmptyImagesFromHtml`
  - `lib/network-mail-api.ts` — `getTemplate`
  - `lib/product-email-template.ts` — `escapeMergeValue`
- **Packages:** none

## Used by

- `components/shared/ManageOrgPopover.tsx`
- `components/shared/OrgWelcomeEmailSection.tsx`
