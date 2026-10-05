import { pdfjs } from "react-pdf";

// Bundled via webpack's `new URL(..., import.meta.url)` worker pattern so the worker
// always matches the installed pdfjs-dist version and works offline — no CDN dependency.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

let workerPreloaded = false;

// The worker bundle is ~1.26 MB and react-pdf only fetches it when the first <Document>
// mounts — i.e. inside the critical path of the first PDF the user opens in a session. Call
// this as soon as it's plausible they'll open one (on the DocuSign tab mounting, say) and the
// download happens while they're still reading the list instead of while they wait on a viewer.
//
// Only warms the HTTP cache: no worker is started, so this costs nothing but the transfer,
// and the transfer was going to happen anyway. Idempotent, and deliberately silent on failure
// — a rejected prefetch must never surface as an error, react-pdf will simply fetch it again
// for real later.
export function preloadPdfWorker() {
  if (workerPreloaded || typeof window === "undefined") return;
  workerPreloaded = true;
  fetch(pdfjs.GlobalWorkerOptions.workerSrc, { credentials: "same-origin" }).catch(() => {});
}
