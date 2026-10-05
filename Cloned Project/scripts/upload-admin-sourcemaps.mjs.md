# `scripts/upload-admin-sourcemaps.mjs`

> Post-build step that uploads the Next.js build's source maps a second time, to the admin console's own Sentry project, and no-ops when that is not configured.

**Kind:** build/deploy script · **Lines:** 63

## Purpose
One Next.js bundle serves both the main app (my.garage.app) and the admin console (admin.garage.app). `withSentryConfig()` in `next.config` uploads source maps to only one Sentry project (`SENTRY_PROJECT`). When the admin console reports to a separate project (through `NEXT_PUBLIC_SENTRY_DSN_ADMIN`), its errors would show minified stack frames. Because the Sentry plugin embeds Debug IDs in both bundles and maps, re-uploading the identical `.next` artifacts to the second project resolves them without rebuilding.

## How it works
1. Reads `SENTRY_ORG`, `SENTRY_ADMIN_PROJECT` and `SENTRY_AUTH_TOKEN` from the environment.
2. If `SENTRY_ADMIN_PROJECT` is unset: logs that the upload is skipped and exits 0 — the normal case when the split is not switched on.
3. If the project is set but `SENTRY_ORG` or `SENTRY_AUTH_TOKEN` is missing: logs a loud warning (the admin project's traces will stay minified) and exits 0.
4. If there is no `.next` directory: warns to run it after the build and exits 0.
5. Uses `node_modules/.bin/sentry-cli` when present, else `sentry-cli` from PATH, and runs `sentry-cli sourcemaps upload --org <org> --project <project> .next` with inherited stdio and environment (no shell).
6. A non-zero exit from sentry-cli only produces a warning; the script never fails the build, so a Sentry outage cannot block a deploy.

## Exports
None. ES module script.

## Interfaces
- **External services:** Sentry (source-map upload through `sentry-cli`).
- **Environment variables:** `SENTRY_ADMIN_PROJECT` - target project, its presence turns the step on; `SENTRY_ORG` - Sentry organisation slug; `SENTRY_AUTH_TOKEN` - upload token (secret, passed to sentry-cli through the inherited environment, never printed).

## Dependencies
- **Packages:** Node built-ins `node:child_process` (`spawnSync`), `node:fs` (`existsSync`), `node:path` (`join`); the `sentry-cli` binary (from the Sentry packages in `node_modules`, or PATH).

## Used by
Not imported. Wired into `package.json`: `sentry:sourcemaps:admin` runs `node scripts/upload-admin-sourcemaps.mjs`, and `build:web` runs `next build --turbopack && npm run sentry:sourcemaps:admin`, so it executes on every `npm run build` (and therefore on deploy builds). Can also be run by hand from the repo root after a build.

## Notes
- Must run from the repo root: both the `.next` check and the local CLI path are relative to `process.cwd()`.
- Always exits 0 by design; watch the build log for the `[sentry]` warnings.
