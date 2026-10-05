# `components/dashboard/docusign/shared/listFormat.ts`

> Formatting shared by the two document list screens (Agreements and External Signatures), which present the same inbox-style rows.

**Kind:** React component · **Lines:** 25

<!-- docgen:auto -->

## Purpose
Formatting shared by the two document list screens (Agreements and External Signatures), which
present the same inbox-style rows.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `formatMailTimestamp` | function | `formatMailTimestamp(value: string)` — Mail-client style: the time for anything sent today, otherwise the date. | 6 |
| `isUnreadDocument` | function | `isUnreadDocument(doc: { status: string; myRecipientStatus?: string })` — "Still needs someone's attention" — drives the bold title and the accent dot. | 21 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `components/dashboard/docusign/external/ExternalSignaturesList.tsx`
- `components/dashboard/docusign/internal/AgreementsView.tsx`
