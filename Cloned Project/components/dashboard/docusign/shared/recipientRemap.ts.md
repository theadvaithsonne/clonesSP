# `components/dashboard/docusign/shared/recipientRemap.ts`

> The editors store each field's owner as an INDEX into the recipients list (`recipientIndex`), which also drives its colour.

**Kind:** React component · **Lines:** 40

<!-- docgen:auto -->

## Purpose
The editors store each field's owner as an INDEX into the recipients list (`recipientIndex`), which also
drives its colour. When that list is reordered or someone is removed the indices must follow the people,
otherwise every field silently changes owner: moving Bob above Alice would hand Alice's fields to Bob, and
removing a middle recipient would pass their fields on to the next person.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RemapResult` | interface |  | 6 |
| `remapFieldOwners` | function | `remapFieldOwners(prev: R[], next: R[], fields: F[], keyOf: (recipient: R) => string): RemapResult<F>` | 16 |
| `shortRecipientName` | function | `shortRecipientName(r: { name?: string; email?: string } \| undefined)` | 38 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `components/dashboard/docusign/external/ExternalFieldEditorView.tsx`
- `components/dashboard/docusign/internal/FieldEditorView.tsx`
