# `components/dashboard/docusign/shared/recipientConstants.ts`

> Recipient constants used by BOTH flows.

**Kind:** React component · **Lines:** 27

<!-- docgen:auto -->

## Purpose
Recipient constants used by BOTH flows.

These used to live in internal/RecipientsPanel.tsx, which meant the external editor and
ExternalRecipientsPanel imported from an internal-only component — the one place external
code reached across the internal/external boundary. They are pure data with no flow of
their own (a colour ramp and a backend limit), so they belong here.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MAX_SEPARATE_COPIES` | const | `= 500` | 11 |
| `RECIPIENT_COLORS` | const | `= [ "#6366f1", // indigo "#ec4899", // pink "#22c55e", // green "#f59e0b", // amber "#06b…` | 15 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `components/dashboard/docusign/external/ExternalFieldEditorView.tsx`
- `components/dashboard/docusign/external/ExternalRecipientsPanel.tsx`
- `components/dashboard/docusign/internal/FieldEditorView.tsx`
- `components/dashboard/docusign/internal/RecipientsPanel.tsx`
