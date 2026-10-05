# `lib/pdfWorkerSetup.ts`

> Points react-pdf's pdf.js worker at the locally bundled worker file and exports a helper that pre-fetches the worker so the first PDF opens faster.

**Kind:** frontend library · **Lines:** 26

## Purpose
`react-pdf` needs a pdf.js web worker to parse PDFs. This module sets that worker source globally, once, as a side effect of being imported. It uses the bundler's `new URL(..., import.meta.url)` pattern rather than a CDN, so the worker always matches the installed `pdfjs-dist` version and works offline. The DocuSign-style signing screens import it before rendering any `<Document>`.

## How it works
- **Side effect on import:** sets `pdfjs.GlobalWorkerOptions.workerSrc` to the URL of `pdfjs-dist/build/pdf.worker.min.mjs`, resolved relative to this module by the bundler.
- **`preloadPdfWorker()`:** the worker bundle is about 1.26 MB, and react-pdf only downloads it when the first `<Document>` mounts. That puts the download in the way of the first PDF a user opens. Calling `preloadPdfWorker()` early (for example when the DocuSign tab mounts) runs a plain `fetch` of the worker URL with `credentials: "same-origin"` to warm the HTTP cache. It does not start a worker.
  - A module-level `workerPreloaded` flag makes it idempotent, and it returns immediately during SSR.
  - Failures are swallowed (`.catch(() => {})`). If the prefetch fails, react-pdf just downloads the worker itself later.

## Exports
- `preloadPdfWorker(): void` - warms the browser cache with the pdf.js worker. Safe to call repeatedly.
- (Side effect) importing the module configures `pdfjs.GlobalWorkerOptions.workerSrc`.

## Dependencies
- **Internal:** none
- **Packages:** `react-pdf` - provides the `pdfjs` handle whose global worker options are set. The worker file itself comes from `pdfjs-dist`, a dependency of react-pdf.

## Used by
- `app/(dashboard)/workspace/sign/[token]/PublicSigningView.tsx` - the public signing page.
- `components/dashboard/docusign/DocusignPage.tsx`
- `components/dashboard/docusign/external/ExternalFieldEditorView.tsx`
- `components/dashboard/docusign/internal/FieldEditorView.tsx`
- `components/dashboard/docusign/internal/SigningView.tsx`

## Notes
- Import this module before rendering a react-pdf `<Document>`. Otherwise react-pdf falls back to its own default worker configuration.
