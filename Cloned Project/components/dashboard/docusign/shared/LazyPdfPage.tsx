"use client";

import { memo, Suspense, useEffect, useRef, useState } from "react";
import { Page } from "react-pdf";

// Placeholder aspect ratio (US Letter) for a page that hasn't rendered yet — replaced by
// the page's real ratio as soon as it loads once.
const DEFAULT_ASPECT = 11 / 8.5;
// A page starts rendering once it's within RENDER_MARGIN of the visible scroll area (~2-3
// pages ahead, so a fast scroll doesn't outrun the canvas), and is only released again
// once it's beyond the much larger KEEP_MARGIN. The gap between the two means scrolling
// back and forth a little never re-renders a page that was just drawn.
const RENDER_MARGIN = "1200px 0px";
const KEEP_MARGIN = "3000px 0px";
// Canvas resolution cap. On a 2x/3x screen react-pdf otherwise draws each page at full
// device resolution (~1440x1860 px at 720 CSS px wide) — 1.5x keeps text sharp while
// cutting the pixels Chrome has to paint per page roughly in half, which is what keeps
// fast scrolling from outrunning the paint.
const MAX_PIXEL_RATIO = 1.5;

const findScrollParent = (el: HTMLElement | null): HTMLElement | null => {
  let node = el?.parentElement ?? null;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return null;
};

// Drop-in for react-pdf's <Page> in the signing/editor views. Mapping every page straight
// to <Page> keeps one full-size canvas alive per page — fine for a 3-page NDA, but a
// 100+ page contract gets very slow and can crash the tab on phones/low-memory laptops.
// This renders the canvas only while the page is near the visible scroll area and keeps
// a same-size placeholder otherwise, so the parent's absolutely-positioned field
// overlays (percent-based) and drop targets stay exactly where they were.
function LazyPdfPageImpl({
  pageNumber,
  width,
  onPageSize,
}: {
  pageNumber: number;
  width: number;
  // Reports the page's real size in PDF points once it has loaded (font sizes are stored in pt).
  onPageSize?: (page: number, widthPt: number, heightPt: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isNear, setIsNear] = useState(pageNumber <= 2);
  const [height, setHeight] = useState(Math.round(width * DEFAULT_ASPECT));

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setIsNear(true);
      return;
    }
    // Observed against the actual scroll container: with the default (viewport) root,
    // the container's overflow clipping would cancel out the margins.
    const root = findScrollParent(el);
    const render = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsNear(true);
      },
      { root, rootMargin: RENDER_MARGIN }
    );
    const release = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) setIsNear(false);
      },
      { root, rootMargin: KEEP_MARGIN }
    );
    render.observe(el);
    release.observe(el);
    return () => {
      render.disconnect();
      release.disconnect();
    };
  }, []);

  // White, like the page itself — while a canvas is still drawing (or released), the
  // editor's dark background would otherwise show through as a black page.
  // Fixed height (not min-height) plus `contain` so a page mounting/unmounting can't resize or
  // repaint anything outside its own box.
  return (
    <div ref={ref} style={{ width, height, background: "#ffffff", contain: "layout paint" }}>
      {isNear && (
        // react-pdf v11 loads each <Page> through Suspense (`use(getPage(n))`). Without a boundary
        // of its own, mounting a page as you scroll suspends up to the nearest ancestor boundary
        // (the empty `dynamic()` wrapper around DocusignPage) and React hides the ENTIRE editor
        // until that page's promise resolves — the whole screen going blank for a second or two,
        // once per page. This local boundary confines the wait to this page's white placeholder.
        <Suspense fallback={null}>
          <Page
            pageNumber={pageNumber}
            width={width}
            devicePixelRatio={Math.min((typeof window !== "undefined" && window.devicePixelRatio) || 1, MAX_PIXEL_RATIO)}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            onLoadSuccess={(page) => {
              setHeight(Math.round((page.originalHeight / page.originalWidth) * width));
              onPageSize?.(pageNumber, page.originalWidth, page.originalHeight);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

// memo: the editor re-renders on every pointer-move while a field is dragged; the PDF canvases must not
// re-render with it (props are all stable: numbers + a useCallback'd onPageSize).
export const LazyPdfPage = memo(LazyPdfPageImpl);
