# `components/dashboard/docusign/shared/downscaleImage.ts`

> Shrinks a signature image before it leaves the browser.

**Kind:** React component · **Lines:** 86

<!-- docgen:auto -->

## Purpose
Shrinks a signature image before it leaves the browser. Every source goes through it — drawn,
typed and uploaded — because a phone photo of a signature can be several MB, and the public
signing page sends images inline in the sign request: the backend rejects an image over 1 MB
(decoded) or 2000x2000 px, and the whole public request body is capped at 4 MB.

A signature printed into a PDF field never needs more than about 800x400 px, so that is the
default bound. The result is a PNG (keeps transparency, which typed signatures with a colour rely
on) unless the PNG is still large — which in practice means a photo — in which case it is a JPEG.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `downscaleImage` | function | `async downscaleImage(blob: Blob, opts: { maxWidth?: number; maxHeight?: number; maxBytes?: n…): Promise<Blob>` | 51 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `components/dashboard/docusign/shared/SignatureCaptureModal.tsx`
