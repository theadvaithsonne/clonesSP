# `server/scripts/reencode-bat246-videos.ts`

> src/scripts/reencode-bat246-videos.ts

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 185

<!-- docgen:auto -->

## Purpose
src/scripts/reencode-bat246-videos.ts

Re-encode the four oversized BAT 246 intro videos and replace them on S3.

Measured problem (28 Sep 2026): four of the seven clips were uploaded as
near-master exports — ~9 Mb/s, up to 570 MB — while the three that play
fine sit at 0.8-2.6 Mb/s. Measured throughput to the bucket is ~6.2 Mb/s,
so the heavy files cannot download as fast as they play. The buffering is
not intermittent; it is arithmetic.

They also have the `moov` atom at 99.9% of the file, so the player must
range-request the tail of a 570 MB file before it can decode a single
frame. `-movflags +faststart` moves it to the front.

Safety: every original is copied to `public/bat246/originals/` on S3 BEFORE
its key is overwritten, so this is reversible with a single copy back. The […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment variables (`process.env`):** `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- **Filesystem writes:** `unlinkSync(inFile)` (L174), `unlinkSync(outFile)` (L174), `rmSync(tmp)` (L181)

## Dependencies

- **Internal:** none
- **Packages:**
  - `dotenv`
  - `child_process` — `spawn`
  - `fs`
  - `path`
  - `os`
  - `@aws-sdk/client-s3` — `S3Client`, `GetObjectCommand`, `PutObjectCommand`, `CopyObjectCommand`, `HeadObjectCommand`

## Used by

Entry: run by hand: `npx tsx server/scripts/reencode-bat246-videos.ts`.

## Notes

- Command-line flags referenced: `--confirm`.
- Security-relevant constructs: `spawn()` (L73), `spawn()` (L83).
