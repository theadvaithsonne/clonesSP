# `lib/funnel-tree.ts`

> Type-only module that defines the question/option tree for video funnels: options, nested follow-up options and the videos attached to each node.

**Kind:** frontend library · **Lines:** 29

## Purpose
"Tree" funnels ask a root question. Each answer option can play videos and can lead to nested follow-up options. Two places edit this same tree: the admin global-template studio (Garage Funnels library) and the user-facing per-funnel builder. Only the API behind them differs, so the types live here and both sides share them.

## How it works
Only interfaces, no runtime code:
- `FunnelTemplate` is the root. It holds the `rootQuestion` and its top-level `options`.
- `FunnelNode` is one answer option. It has a `label` and an `order`, an optional follow-up `prompt` (the question asked next), its `videos`, and recursive `children` nodes.
- `FunnelVideo` is a video with a title, subtitle and order. The source can be an S3 object (`s3Key`, `thumbnailKey`) or a YouTube video (`youtubeId`). The resolved `videoUrl` / `thumbnailUrl` fields are optional.
- `id` and `key` are both optional on nodes and videos. Unsaved items that the editor creates may not have a persisted id yet.

## Exports
- `interface FunnelVideo` - `{ id?, key?, title, subtitle, s3Key?, youtubeId?, thumbnailKey?, videoUrl?, thumbnailUrl?, order }`
- `interface FunnelNode` - `{ id?, key?, label, order, prompt?, videos: FunnelVideo[], children: FunnelNode[] }`
- `interface FunnelTemplate` - `{ rootQuestion, options: FunnelNode[] }`

## Dependencies
- **Internal:** none
- **Packages:** none

## Used by
- `components/funnel-studio/funnel-studio.tsx`, `node-inspector.tsx`, `preview-canvas.tsx`, `structure-tree.tsx`, `tree-ops.ts` - the shared tree editor UI and its tree-manipulation helpers.
- `lib/nc-admin-api/admin-funnels.ts` - the admin Garage Funnels API client (which calls the external contacts-backend). It imports these types and re-exports them.

## Notes
- This file has no runtime checks. The backend that stores the tree must accept the same shape, and nothing in this repo enforces that.
- This tree is separate from the page-designer content model in `lib/funnel-pages.ts`.
