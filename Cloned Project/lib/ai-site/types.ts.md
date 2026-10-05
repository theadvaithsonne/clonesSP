# `lib/ai-site/types.ts`

> Shared TypeScript types for AI-generated "site" funnels, plus a type guard for the `fnsite:*` postMessage bridge.

**Kind:** frontend library · **Lines:** 29

## Purpose
AI-generated funnel sites are multi-step HTML pages produced by a background job. This file names the shapes everything else agrees on: a site step, the generation job's status, the stored content of a site-mode funnel, and the messages a sandboxed site page sends up to its host frame.

## How it works
- `SiteStep` is one page of the generated site: `id`, `title` and raw `html`.
- `JobStage` / `JobStatus` describe a generation job: a coarse `status` (`queued`, `running`, `done`, `error`) and a finer `stage` (`planning`, `building`, `reviewing`, `refining`, `done`, `error`), with an optional `plan`, the finished `steps` and an `error` message.
- `AiSiteContent` is the persisted content of a funnel whose `content.mode` is `"site"`; `AiSiteMeta` carries optional generation hints (`archetype`, `palette`, `prompt`, `opportunityId`).
- `FnBridgeMessage` is a discriminated union of the messages a generated page posts to its parent: `fnsite:ready`, `fnsite:cta` (with an `FnCtaAction` of `buy`, `url`, `scroll`, `next`, `prev` or `goto`), `fnsite:lead` (form fields, optionally partial), `fnsite:track` (analytics event) and `fnsite:resize` (iframe height).
- `isFnBridgeMessage(x)` validates untrusted `message` event data: it must be an object whose `type` string starts with `fnsite:`; anything other than `fnsite:ready` must also carry a non-null object `payload`. It does not check the payload's fields.

## Exports
- `SiteStep` (interface) - one generated page.
- `JobStage` (type) - fine-grained generation stage.
- `JobStatus` (interface) - generation job status.
- `AiSiteMeta` (interface) - optional generation metadata.
- `AiSiteContent` (interface) - stored content of a `mode: "site"` funnel.
- `FnCtaAction` (type) - CTA action names.
- `FnBridgeMessage` (type) - union of bridge messages.
- `isFnBridgeMessage(x: unknown): x is FnBridgeMessage` - shallow runtime guard.

## Dependencies
- **Internal:** none.
- **Packages:** none.

## Used by
- `lib/api/funnels.ts` (type import of `SiteStep` for `FunnelResponse.steps`).

## Notes
- A search of the repo finds no caller of `isFnBridgeMessage` or of the job/bridge types beyond this file, so the site renderer and generator that use them appear to live outside this repo (the funnels backend is external; see `lib/api/funnels.ts.md`).
- The guard is shallow, so a consumer still has to validate payload fields (for example `href` on a `url` CTA) before acting on them.
