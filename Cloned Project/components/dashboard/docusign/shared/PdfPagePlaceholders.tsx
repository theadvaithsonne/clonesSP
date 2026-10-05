"use client";

import { Loader2 } from "lucide-react";

// US Letter, the same assumption LazyPdfPage's DEFAULT_ASPECT makes for a page it hasn't
// rendered yet — close enough to the real ratio that swapping in the actual canvases barely
// moves the scroll position.
const DEFAULT_ASPECT = 11 / 8.5;
// How many of the placeholder pages get the pulse animation — see the note where it's applied.
// Roughly "everything plausibly on screen at once".
const ANIMATED_PAGES = 3;

// What the page column shows while pdf.js downloads and parses the PDF, passed as
// <Document loading={...}>. Given a page count (the caller usually knows it — it's stored on
// the document at upload time) this draws that many correctly-sized white pages, so the
// editor looks like the editor immediately instead of showing an empty spinner on a blank
// background.
//
// Deliberately NOT built on LazyPdfPage: these render before pdf.js has confirmed how many
// pages exist, and mounting a real <Page> for an out-of-range page number would ask the
// worker for a page that may not be there.
export function PdfPagePlaceholders({ count, width }: { count: number; width: number }) {
  const height = Math.round(width * DEFAULT_ASPECT);

  return (
    <div className="mx-auto flex flex-col items-center gap-6">
      <div className="flex items-center gap-2 text-xs text-black/50">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading document…
      </div>
      {/* No known page count (documents created before pageCount was stored) — one page's
          worth of white space is still a better backdrop for the spinner than a bare
          background, but don't invent a length. */}
      {Array.from({ length: count > 0 ? count : 1 }, (_, i) => (
        <div
          key={i}
          style={{ width, height, contain: "layout paint" }}
          // Every page is rendered, so the scroll height matches the real document and nothing
          // jumps when the canvases replace these. But only the pages near the top are animated:
          // a 500-page contract would otherwise put 500 simultaneous pulse animations on screen,
          // which costs far more than the placeholder is worth for pages nobody has scrolled to.
          className={`bg-white ring-1 ring-black/15 ${i < ANIMATED_PAGES ? "animate-pulse" : ""}`}
        />
      ))}
    </div>
  );
}
