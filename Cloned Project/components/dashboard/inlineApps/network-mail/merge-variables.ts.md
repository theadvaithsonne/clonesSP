# `components/dashboard/inlineApps/network-mail/merge-variables.ts`

> Module exporting `pickableTextVariables`, `pickableLinkVariables`, `sampleLabel`, `mergeToken` and 2 more.

**Kind:** React component · **Lines:** 337

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MergeVariableCategory` | type | Dynamic fields for the Network Mail visual builder. | 36 |
| `MergeVariable` | interface |  | 42 |
| `MERGE_VARIABLES` | const | `= [ // ── Customer Details ── { key: "first_name", label: "Customer / Member First Name",…` | 84 |
| `MERGE_VARIABLE_BY_KEY` | const | `= Object.fromEntries(MERGE_VARIABLES.map((v) => [v.key, v]))` | 264 |
| `MERGE_VARIABLE_CATEGORY_ORDER` | const | `= [ "Customer Details", "Order & Purchase", "Organization Info", "Action Links", ]` — Picker order, as specified for the Dynamic Fields menu. | 268 |
| `MERGE_CATEGORY_HINTS` | const | `= { "Action Links": "For buttons & hyperlinks", }` — Section heading shown above the link group — longer than the category name. | 276 |
| `pickableTextVariables` | function | `pickableTextVariables(): MergeVariable[]` — Everything the Dynamic Fields menu offers. | 285 |
| `pickableLinkVariables` | function | `pickableLinkVariables(): MergeVariable[]` — The variables offered as a button/link destination. | 290 |
| `sampleLabel` | function | `sampleLabel(variable: MergeVariable): string` — What a picker row shows after the token: `e.g. | 295 |
| `MERGE_SAMPLE_VALUES` | const | `= Object.fromEntries( MERGE_VARIABLES.map((v) => [v.key, v.sample]), )` | 300 |
| `mergeToken` | function | `mergeToken(key: string): string` — The token as it is stored and exported. | 305 |
| `applyMergeSamples` | function | `applyMergeSamples(html: string, overrides?: Record<string, string>): string` — Swaps `{{tags}}` for readable values so a founder previews an email rather than a page of placeholders. | 318 |
| `stripEmptyImages` | function | `stripEmptyImages(html: string): string` — Drops `<img>` tags left with an empty `src` after substitution. | 334 |

## Interfaces

- **External hosts mentioned in the code:** `garage.app`

## Dependencies

- **Internal:** none
- **Packages:**
  - `lucide-react` — `BellOff`, `Building`, `Building2`, `Calendar`, `CreditCard`, `ExternalLink`, …

## Used by

- `components/dashboard/inlineApps/network-mail/NetworkMailApp.tsx`
- `components/dashboard/inlineApps/network-mail/merge-variable-picker.tsx`
- `lib/org-welcome-email-template.ts`
- `lib/product-email-template.ts`
