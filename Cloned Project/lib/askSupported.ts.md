# `lib/askSupported.ts`

> One predicate that decides whether a Cabinet file's MIME type can be sent to Ask Cabinet (video or PDF).

**Kind:** frontend library · **Lines:** 30

## Purpose
The Cabinet pages show an "Ask" action only for files the AI analysis supports. This helper centralises that check so the personal, floor, founder and organisation cabinets agree on which files qualify.

## How it works
`isAskSupported(mimeType)` returns:
- `false` for an empty MIME type.
- `true` for any `video/*` type.
- `true` when the lower-cased MIME contains one of a list of video container hints, which catches containers browsers or servers label oddly (for example `application/x-matroska`, `video/quicktime`, `x-msvideo`, `x-ms-wmv`, `x-flv`, `mp2t`, `3gpp`, `3gpp2`, `webm`, `mp4`, `mpeg`, `m4v`, `ogg`, `mxf`, HLS `x-mpegurl` / `vnd.apple.mpegurl`, DASH `dash+xml`).
- `true` for `application/pdf` or anything containing `pdf`.
- `false` otherwise.

## Exports
- `isAskSupported(mimeType: string): boolean` - whether Ask Cabinet should be offered for this file.

## Dependencies
None.

## Used by
- `components/dashboard/CabinetPage.tsx`
- `components/dashboard/FloorCabinetPage.tsx`
- `components/dashboard/FounderCabinetPage.tsx`
- `components/dashboard/OrganizationCabinetPage.tsx`

## Notes
- Audio is not deliberately supported (unlike `lib/askCabinetUtils.ts`, which can label audio), but because the hints are substring matches, some audio types pass anyway: `audio/ogg`, `audio/mpeg`, `audio/webm` and `audio/mp4` all contain a hint. `audio/wav` or `audio/x-m4a` do not.
