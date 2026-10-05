# `components/dashboard/docusign/shared/documentSeed.ts`

> Module exporting `seedFromDocument`.

**Kind:** React component · **Lines:** 41

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DocumentSeed` | interface |  | 19 |
| `seedFromDocument` | function | `seedFromDocument(doc: DsDocument \| DsExternalDocument): DocumentSeed` | 34 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/docusign/types.ts` — `DsDeliveryMode`, `(types only)`
  - `lib/docusign/internal-api.ts` — `DsDocument`, `(types only)`
  - `lib/docusign/external-api.ts` — `DsExternalDocument`, `(types only)`
- **Packages:** none

## Used by

- `components/dashboard/docusign/DocusignPage.tsx`
- `components/dashboard/docusign/external/ExternalFieldEditorView.tsx`
- `components/dashboard/docusign/internal/FieldEditorView.tsx`
