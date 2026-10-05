"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Maximize2, X } from "lucide-react";

/**
 * Shared live preview for a Network Mail template, used by the product/course
 * order-alert section and by the organization welcome email section in Manage
 * Organization. Both render the same 600px email body, so they share the
 * scaling and full-screen behaviour rather than each owning a copy.
 */

/**
 * Width most templates are authored at, and the floor for the measured width
 * below. Only a starting point — a template whose canvas or hero image is wider
 * reports its own width and is scaled from that instead.
 */
const EMAIL_WIDTH = 600;
/** Filling the card width means ~1:1 scale, so the card has to be this tall to
 *  keep a useful amount of the email in view. */
const PREVIEW_HEIGHT = 360;

/** Reading a same-origin srcDoc document can still throw in edge cases, so every
 *  access goes through here. */
function frameDocument(frame: HTMLIFrameElement | null): Document | null {
  if (!frame) return null;
  try {
    return frame.contentDocument;
  } catch {
    return null;
  }
}

/**
 * Measures the rendered email inside the frame.
 *
 * Width matters as much as height: assuming every template is exactly 600px
 * wide clipped any template authored wider than that — the body was rendered in
 * a 600px frame with `overflow:hidden`, so a 700px-wide email lost its right
 * 100px, which reads as a centred logo sitting off-centre with half of it
 * missing. Scaling from the measured width instead makes the preview fit
 * whatever the builder produced.
 *
 * The returned width only ever grows (floor `minWidth`), so feeding it back as
 * the frame's own width converges on the first re-measure instead of
 * oscillating.
 *
 * Requires the frame to be same-origin — `sandbox="allow-same-origin"` without
 * `allow-scripts`, so nothing in the email can run.
 */
function useEmailContentSize(
  frameRef: { current: HTMLIFrameElement | null },
  html: string,
  minWidth: number,
  fallbackHeight: number,
) {
  const [size, setSize] = useState({ width: minWidth, height: fallbackHeight });

  // Switching template starts measurement over, so a narrow one after a wide
  // one doesn't inherit the wide one's width. Reset during render rather than
  // in an effect: an effect would run AFTER the one below and could wipe a
  // measurement it had already taken from an already-loaded frame.
  const [measuredHtml, setMeasuredHtml] = useState(html);
  if (measuredHtml !== html) {
    setMeasuredHtml(html);
    setSize({ width: minWidth, height: fallbackHeight });
  }

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    let bodyObserver: ResizeObserver | null = null;
    let pendingFrame = 0;
    const watchedImages: HTMLImageElement[] = [];

    const measure = () => {
      const doc = frameDocument(frame);
      const body = doc?.body;
      if (!doc || !body) return;
      const height = Math.max(
        body.scrollHeight,
        body.offsetHeight,
        doc.documentElement?.scrollHeight ?? 0,
      );
      // scrollWidth still reports the full extent of overflowing content under
      // `overflow:hidden`, which is exactly what we need here.
      const width = Math.max(
        body.scrollWidth,
        doc.documentElement?.scrollWidth ?? 0,
        minWidth,
      );
      if (height <= 0) return;
      setSize((prev) =>
        Math.abs(prev.height - height) > 1 || width > prev.width
          ? { width: Math.max(prev.width, width), height }
          : prev,
      );
    };

    const onLoad = () => {
      const doc = frameDocument(frame);
      if (doc) {
        // Kill the document's own scrollbars. The sized iframe is the viewport
        // now, and subpixel rounding on the scaled box would otherwise be
        // enough to trigger one.
        // height:auto matters as much as the overflow rule: email boilerplate
        // often sets html/body to height:100%, which would peg scrollHeight to
        // the iframe viewport and leave the frame stuck at its start height.
        const style = doc.createElement("style");
        style.textContent =
          "html,body{margin:0;padding:0;height:auto!important;min-height:0!important;overflow:hidden!important;}";
        (doc.head || doc.documentElement)?.appendChild(style);

        if (doc.body) {
          bodyObserver = new ResizeObserver(measure);
          bodyObserver.observe(doc.body);
        }
        // Images routinely settle after the load event and change the size — a
        // wide hero image is the usual reason a template measures over 600px.
        doc.querySelectorAll("img").forEach((img) => {
          img.addEventListener("load", measure);
          watchedImages.push(img);
        });
      }
      measure();
      pendingFrame = requestAnimationFrame(measure);
    };

    frame.addEventListener("load", onLoad);
    if (frameDocument(frame)?.readyState === "complete") onLoad();

    return () => {
      frame.removeEventListener("load", onLoad);
      bodyObserver?.disconnect();
      cancelAnimationFrame(pendingFrame);
      watchedImages.forEach((img) => img.removeEventListener("load", measure));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, minWidth]);

  return size;
}

/**
 * Renders email HTML at its own natural width and scales the whole thing to
 * whatever width the parent hands it, so the preview is fully responsive and
 * never overflows sideways.
 *
 * The iframe itself is grown to the exact height of its rendered content, so it
 * has no scrollbar of its own no matter how long the email is — a long email
 * makes this component tall and the surrounding page scrolls instead of a
 * scrollbar appearing inside the preview pane.
 *
 * The iframe keeps the email's real pixel width, so the table markup and the
 * exported HTML stay byte-for-byte email-client compatible; only the preview
 * wrapper is transformed.
 */
export function ResponsiveEmailFrame({
  html,
  title = "Email preview",
  /** Floor for the measured width — templates wider than this scale from their own. */
  emailWidth = EMAIL_WIDTH,
  /** Cap so a container wider than the email doesn't blow it up past 1:1. */
  maxScale = 1,
  /** Height used until the content has been measured. */
  fallbackHeight = 280,
  /** Blocks clicks/selection — for non-interactive thumbnail previews. */
  interactive = true,
  className = "",
}: {
  html: string;
  title?: string;
  emailWidth?: number;
  maxScale?: number;
  fallbackHeight?: number;
  interactive?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Match the iframe to its content so it never needs to scroll in either
  // direction. Height is fed straight back onto the element; width is a floor
  // that only grows, so neither can reflow the content into a measurement loop.
  const { width: contentWidth, height: contentHeight } = useEmailContentSize(
    frameRef,
    html,
    emailWidth,
    fallbackHeight,
  );

  // Scale off the measured container width rather than a breakpoint, so this
  // reacts to modal and panel resizes too, not just viewport ones.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale =
    containerWidth > 0
      ? Math.min(maxScale, containerWidth / contentWidth)
      : maxScale;

  return (
    <div ref={containerRef} className={`w-full min-w-0 overflow-hidden ${className}`}>
      <div
        className="relative mx-auto overflow-hidden"
        style={{
          width: Math.floor(contentWidth * scale),
          height: Math.ceil(contentHeight * scale),
        }}
      >
        <iframe
          ref={frameRef}
          title={title}
          srcDoc={html}
          // allow-same-origin (and deliberately not allow-scripts) so the
          // content size is readable. No script in the email HTML can run,
          // so it has no way to reach the parent document.
          sandbox="allow-same-origin"
          scrolling="no"
          className={`absolute top-0 left-0 origin-top-left ${
            interactive ? "" : "pointer-events-none"
          }`}
          style={{
            width: contentWidth,
            height: contentHeight,
            border: 0,
            transform: `scale(${scale})`,
          }}
        />
      </div>
    </div>
  );
}

export function EmailPreviewCard({
  srcDoc,
  loading,
  error,
  onExpand,
}: {
  srcDoc: string;
  loading: boolean;
  error: string | null;
  onExpand: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  // Scale the email to exactly the card width — a fixed scale left a dead
  // gutter on the right whenever the card was wider than the scaled email.
  const [cardWidth, setCardWidth] = useState(0);

  // Same measurement the full preview uses: a template authored wider than
  // EMAIL_WIDTH scales from its own width instead of being clipped.
  const { width: contentWidth } = useEmailContentSize(
    frameRef,
    srcDoc,
    EMAIL_WIDTH,
    PREVIEW_HEIGHT,
  );

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    setCardWidth(el.clientWidth);
    const observer = new ResizeObserver((entries) => {
      setCardWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = cardWidth > 0 ? cardWidth / contentWidth : 1;

  return (
    <div className="rounded-xl border border-[#2a2a35] bg-[#16161a] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a2a35]">
        <span className="text-xs font-semibold text-[#8b8c9d] uppercase tracking-wide">
          Preview
        </span>
        <button
          type="button"
          onClick={onExpand}
          disabled={!srcDoc}
          className="text-xs text-brand font-bold hover:underline flex items-center gap-1 disabled:opacity-40 disabled:no-underline"
        >
          <Maximize2 className="w-3.5 h-3.5" /> Full preview
        </button>
      </div>

      <div
        ref={viewportRef}
        className="relative w-full bg-[#f3f4f6] overflow-hidden"
        style={{ height: PREVIEW_HEIGHT }}
      >
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#16161a]">
            <Loader2 className="w-5 h-5 animate-spin text-[#8b8c9d]" />
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#16161a] px-4">
            <p className="text-xs text-red-400 text-center">{error}</p>
          </div>
        ) : srcDoc ? (
          // Rendered at the email's own natural width, then scaled to fill the
          // card exactly. Height is divided by the scale so the scaled result
          // is exactly PREVIEW_HEIGHT tall — no letterboxing above or below.
          <iframe
            ref={frameRef}
            title="Email preview"
            srcDoc={srcDoc}
            // allow-same-origin (never allow-scripts) so the width is
            // measurable; pointer-events are off and no script can run.
            sandbox="allow-same-origin"
            scrolling="no"
            className="absolute top-0 left-0 origin-top-left border-0 pointer-events-none"
            style={{
              width: contentWidth,
              height: Math.ceil(PREVIEW_HEIGHT / scale),
              transform: `scale(${scale})`,
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[#16161a]">
            <p className="text-xs text-[#8b8c9d]">No preview available</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function EmailFullPreviewModal({
  srcDoc,
  onClose,
  note = "Shown with sample data — real details are filled in when it sends.",
  zIndex = 735,
}: {
  srcDoc: string;
  onClose: () => void;
  /** Subtitle under the modal title. */
  note?: string;
  /** Manage Organization stacks higher than the product form, so this is a prop. */
  zIndex?: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex }}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[680px] max-h-[90vh] flex flex-col rounded-2xl border border-white/10 bg-[#111111] overflow-hidden shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <div>
            <h3 className="text-[15px] font-semibold text-white">Email preview</h3>
            <p className="text-xs text-[#7a7a7a] mt-0.5">{note}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4 text-[#7a7a7a]" />
          </button>
        </div>
        {/* The modal body is the only thing that scrolls — the frame inside it
            is sized to the whole email, however long that is. */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch] bg-[#f3f4f6] p-3 sm:p-4">
          <div className="w-full max-w-[600px] mx-auto rounded-lg overflow-hidden bg-white shadow-sm">
            <ResponsiveEmailFrame html={srcDoc} title="Email full preview" />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
