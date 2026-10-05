# `server/bat246/services/bat246TestMode.ts`

> Tells whether a request came from a frontend running at `http://localhost:3000`, which is the condition for serving developer-only "test" BAT246 boards.

**Kind:** BAT246 game module (backend) — service · **Lines:** 16

## Purpose
BAT246 boards with mode `"test"` are meant only for developers. The backend reveals them only when the browser's page origin is the local dev server. Deployed sites such as bat246.com and gotobigwin.com send their own origin, so they never see test boards.

## How it works
- `isLocalFrontend(origin, referer)`:
  - if an `Origin` header is present, it must equal `http://localhost:3000` exactly;
  - otherwise the `Referer` must be that origin, or start with `http://localhost:3000/`.
- `requestIsFromLocalFrontend(req)` reads `req.headers.origin` and `req.headers.referer` and passes them to `isLocalFrontend`.

## Exports
- `isLocalFrontend(origin?: string | null, referer?: string | null): boolean`
- `requestIsFromLocalFrontend(req: { headers?: Record<string, any> }): boolean`

## Dependencies
- **Internal:** none.
- **Packages:** none.

## Used by
`server/bat246/controllers/bat246.controller.ts` uses it to decide whether board listings and the `getBoardById` lookups include test boards.

## Notes
- **This is a visibility filter, not a security boundary.** `Origin` and `Referer` are set by browsers, but any non-browser client can forge them. Anyone sending `Origin: http://localhost:3000` will see test boards.
- **The local origin is now the same app.** In this merged single-process project, the frontend and backend share one origin, so a local dev run on port 3000 is the same app.
- **A model comment points to the wrong file.** `bat246Board.model.ts` says `isLocalFrontend()` is in `bat246.service.ts`; it actually lives here.
