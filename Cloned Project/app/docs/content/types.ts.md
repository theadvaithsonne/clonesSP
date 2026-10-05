# `app/docs/content/types.ts`

> app/docs/content/types.ts

**Kind:** Next.js app-directory module (colocated) · **Lines:** 77

<!-- docgen:auto -->

## Purpose
app/docs/content/types.ts

The docs are structured data, not hand-written JSX. Every chapter is a list
of blocks; a small renderer turns blocks into layout, and the same array is
flattened into the ⌘K search index. Adding a section means adding an object.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FlowStep` | type | A node in a flow diagram's vertical rail. | 8 |
| `Flow` | type |  | 21 |
| `SequenceMessage` | type | A message on a sequence diagram. | 29 |
| `Sequence` | type |  | 39 |
| `Block` | type |  | 46 |
| `Chapter` | type |  | 66 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `app/docs/components/Blocks.tsx`
- `app/docs/components/ChapterPage.tsx`
- `app/docs/components/FlowRail.tsx`
- `app/docs/components/SequenceDiagram.tsx`
- `app/docs/content/chapters/01-overview.ts`
- `app/docs/content/chapters/02-access.ts`
- `app/docs/content/chapters/03-office-setup.ts`
- `app/docs/content/chapters/04-office.ts`
- `app/docs/content/chapters/05-meetings.ts`
- `app/docs/content/chapters/06-communication.ts`
- `app/docs/content/chapters/07-work.ts`
- `app/docs/content/chapters/08-business-apps.ts`
- `app/docs/content/chapters/09-commerce.ts`
- `app/docs/content/chapters/10-money.ts`
- `app/docs/content/chapters/11-ai.ts`
- `app/docs/content/chapters/12-public.ts`
- `app/docs/content/chapters/13-games.ts`
- `app/docs/content/chapters/14-architecture.ts`
- `app/docs/content/index.ts`
