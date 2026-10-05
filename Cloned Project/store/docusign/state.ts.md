# `store/docusign/state.ts`

> The composed store shape.

**Kind:** client state store · **Lines:** 10

<!-- docgen:auto -->

## Purpose
The composed store shape. Lives in its own file so each slice can type its `set`/`get`
against the whole store (a slice legitimately reads fields other slices own) without the
slices having to import the store module that creates them.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DocusignState` | type |  | 9 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `store/docusign/sharedSlice.ts` — `SharedSlice`, `(types only)`
  - `store/docusign/internalSlice.ts` — `InternalSlice`, `(types only)`
  - `store/docusign/externalSlice.ts` — `ExternalSlice`, `(types only)`
- **Packages:** none

## Used by

- `store/docusign/docusignStore.ts`
- `store/docusign/externalSlice.ts`
- `store/docusign/internalSlice.ts`
- `store/docusign/sharedSlice.ts`
