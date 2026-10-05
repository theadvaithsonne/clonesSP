"use client";

import { ReactNode, useEffect, useRef, useCallback } from "react";
import { WhitelabelProvider } from "@/lib/whitelabel-context";
import { getCurrentDomain } from "@/lib/whitelabel";
import AnnouncementHost from "@/components/announcements/AnnouncementHost";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialViewportHeight = useRef<number>(0);

  // Prevent touch move except on inputs
  const preventTouchMove = useCallback((e: TouchEvent) => {
    const target = e.target as HTMLElement;
    // Allow touch on inputs
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest("[data-allow-scroll]")
    ) {
      return;
    }
    e.preventDefault();
  }, []);

  // Prevent zoom, scroll, and handle keyboard on auth pages
  useEffect(() => {
    // BAT246's gotobigwin.com funnel (components/welcome/Bat246Landing.tsx)
    // renders through this same (auth) route/layout, but it is a long,
    // scrollable story page — not the single-viewport login card this whole
    // effect is built for. Locking html/body to `position:fixed` +
    // `overflow:hidden` + `touch-action:none` (below) pins the page to one
    // screen's worth of content and swallows every scroll gesture, which is
    // exactly the "not able to scroll at all" bug reported on mobile.
    //
    // An earlier attempt patched this from the child (Bat246Landing's own
    // mount effect un-locking html/body again). That raced the async
    // whitelabel domain lookup Welcome() waits on before it even renders
    // Bat246Landing, and evidently still left the page locked on real
    // devices. Fixing it here instead — skip applying the lock in the first
    // place for this domain — removes the race entirely: nothing to undo
    // because nothing was ever applied. Checked via getCurrentDomain() (not
    // the WhitelabelProvider context, which is instantiated below as a
    // child of this very layout) — same helper useWhitelabel() itself calls,
    // so the LOCAL TESTING override in lib/whitelabel.ts also exercises this
    // skip when testing gotobigwin.com from localhost.
    if (/(^|\.)gotobigwin\.com$/i.test(getCurrentDomain())) {
      return;
    }

    // Find existing viewport meta or create one
    let viewport = document.querySelector('meta[name="viewport"]');
    const originalContent = viewport?.getAttribute("content") || "";

    if (viewport) {
      viewport.setAttribute(
        "content",
        "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
      );
    }

    // Store initial viewport height
    initialViewportHeight.current = window.innerHeight;

    // Add touch-action to prevent zoom and scroll gestures
    document.documentElement.style.cssText = `
      touch-action: none;
      overflow: hidden;
      overscroll-behavior: none;
      width: 100%;
      height: 100%;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
    `;

    document.body.style.cssText = `
      touch-action: none;
      overflow: hidden;
      overscroll-behavior: none;
      width: 100%;
      height: 100%;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
    `;

    // Prevent touch move to stop scrolling
    document.addEventListener("touchmove", preventTouchMove, { passive: false });

    // Scroll to top on focus to prevent browser auto-scroll
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        // Prevent browser from scrolling
        setTimeout(() => {
          window.scrollTo(0, 0);
          document.body.scrollTop = 0;
          document.documentElement.scrollTop = 0;
        }, 50);
      }
    };

    document.addEventListener("focusin", handleFocusIn);

    // Handle keyboard open/close on mobile using visualViewport
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile && window.visualViewport) {
      const handleViewportResize = () => {
        if (!containerRef.current || !window.visualViewport) return;

        const currentHeight = window.visualViewport.height;
        const heightDiff = initialViewportHeight.current - currentHeight;

        // Reset any scroll that might have happened
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;

        // Keyboard is likely open if height decreased significantly (> 100px)
        if (heightDiff > 100) {
          // Shift content up to accommodate keyboard
          const shiftAmount = Math.min(heightDiff * 0.5, 200);
          containerRef.current.style.transform = `translateY(-${shiftAmount}px)`;
        } else {
          // Keyboard closed, reset position
          containerRef.current.style.transform = "translateY(0)";
        }
      };

      window.visualViewport.addEventListener("resize", handleViewportResize);
      window.visualViewport.addEventListener("scroll", () => {
        // Prevent visual viewport scroll
        window.scrollTo(0, 0);
      });

      return () => {
        window.visualViewport?.removeEventListener("resize", handleViewportResize);
        document.removeEventListener("touchmove", preventTouchMove);
        document.removeEventListener("focusin", handleFocusIn);
        // Restore original styles
        if (viewport && originalContent) {
          viewport.setAttribute("content", originalContent);
        }
        document.documentElement.style.cssText = "";
        document.body.style.cssText = "";
      };
    }

    return () => {
      document.removeEventListener("touchmove", preventTouchMove);
      document.removeEventListener("focusin", handleFocusIn);
      // Restore original styles
      if (viewport && originalContent) {
        viewport.setAttribute("content", originalContent);
      }
      document.documentElement.style.cssText = "";
      document.body.style.cssText = "";
    };
  }, [preventTouchMove]);

  return (
    <WhitelabelProvider>
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{
          willChange: "transform",
          transition: "transform 0.15s ease-out",
        }}
      >
        {children}
      </div>
      {/* Alerts & Promotions, pre-login surface. Deliberately a SIBLING of the
          container above, not a child: that div carries a transform (and
          will-change: transform) for the mobile-keyboard shift, which would
          make it the containing block for our position:fixed overlay and pin
          the dialog to the top of the document instead of the viewport. */}
      <AnnouncementHost surface="pre-login" delayMs={600} />
    </WhitelabelProvider>
  );
}
