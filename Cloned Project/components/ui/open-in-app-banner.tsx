"use client";

/**
 * OpenInAppBanner
 *
 * Shows a sticky bottom banner on mobile browsers offering to open the
 * Garage Store app. Behaviour:
 *
 *  Android (Chrome):
 *    Uses the Android Intent URL format: intent://<path>#Intent;scheme=...;package=...;end
 *    WITHOUT S.browser_fallback_url — so if the app is not installed Chrome
 *    simply shows its native "can't open" state instead of auto-redirecting
 *    to the Play Store. The user can visit the Play Store manually if they wish.
 *
 *  iOS (Safari):
 *    Fires the custom-scheme URI (garagestore://). After a 1.8 s timeout,
 *    if the page is still visible (app didn't open), redirects to the App Store.
 *
 * The banner is only rendered on narrow viewports (phones), hidden on
 * desktop. Dismissed state persists in sessionStorage so it doesn't
 * re-appear on the same tab after dismissal.
 */

import { useEffect, useRef, useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const ANDROID_PACKAGE = "app.garage.store";

const SESSION_KEY = "garage_banner_dismissed";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface OpenInAppBannerProps {
  /** Custom-scheme deep-link path, e.g. "product/abc123" or "store/my-shop" */
  deepLinkPath: string;
  /** Store / product name shown in the banner subtitle */
  contentTitle?: string;
}

export function OpenInAppBanner({ deepLinkPath, contentTitle }: OpenInAppBannerProps) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!isMobileBrowser()) return;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(SESSION_KEY)) return;
    // Slight delay for the slide-up entrance animation
    const t = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleDismiss() {
    setVisible(false);
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // ignore
    }
  }

  function handleOpenApp() {
    setLoading(true);

    if (isAndroid()) {
      // ─── Android: Intent URL (NO Play Store fallback) ───────────────────────
      // Chrome on Android requires Intent URL format to open apps.
      // We deliberately OMIT S.browser_fallback_url so Chrome does NOT
      // auto-redirect to the Play Store when the app is not installed.
      // Chrome will instead show a native prompt that the app cannot be opened.
      const intentUrl =
        `intent://${deepLinkPath}` +
        `#Intent;scheme=garagestore;package=${ANDROID_PACKAGE};end`;

      window.location.href = intentUrl;

      // Reset loading state after a short delay so the button recovers
      // if the user returns to the tab.
      setTimeout(() => setLoading(false), 2500);
    } else if (isIOS()) {
      // ─── iOS: custom scheme only (NO timed App Store fallback) ──────────────
      // The old 1.8s visibilityState timer couldn't distinguish "app not
      // installed" from "user still looking at the Open-in-app popup", so
      // hesitating on the popup sent people to the App Store even with the
      // app installed. If the scheme no-ops the user simply stays on the
      // page; the banner remains available for another tap.
      window.location.href = `garagestore://${deepLinkPath}`;

      // Reset loading state after a short delay so the button recovers
      // if the user returns to the tab.
      timerRef.current = setTimeout(() => setLoading(false), 2500);
    } else {
      setLoading(false);
    }
  }

  if (!mounted || !visible) return null;

  return (
    <>
      {/* ── Apple Glassmorphic Banner ── */}
      <div
        data-garage-banner
        style={{
          position: "fixed",
          bottom: 12,
          left: 12,
          right: 12,
          zIndex: 9999,
          borderRadius: 26,
          // Core glassmorphism: translucent dark + heavy blur + saturation
          background: "rgba(28, 28, 32, 0.35)",
          backdropFilter: "blur(34px) saturate(180%)",
          WebkitBackdropFilter: "blur(34px) saturate(180%)",
          // Silver border on all sides — frosted chrome edge
          border: "1px solid rgba(200, 200, 210, 0.28)",
          // Floating card shadow + silver inner highlight
          boxShadow:
            "0 12px 34px rgba(0,0,0,0.45), inset 0 1px 0 rgba(220,220,230,0.22), inset 0 -1px 0 rgba(200,200,210,0.08)",
          padding: "12px 16px",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          display: "flex",
          alignItems: "center",
          gap: "14px",
          animation: "garageSlideUp 0.38s cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        <style>{`
          @keyframes garageSlideUp {
            from { transform: translateY(110%); opacity: 0; }
            to   { transform: translateY(0);     opacity: 1; }
          }
          .garage-open-btn {
            -webkit-tap-highlight-color: transparent;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
          }
          .garage-open-btn:active {
            transform: scale(0.95);
            box-shadow: 0 1px 6px color-mix(in srgb, var(--brand-2) 30%, transparent) !important;
          }
          .garage-dismiss-btn {
            -webkit-tap-highlight-color: transparent;
            transition: background 0.15s ease;
          }
          .garage-dismiss-btn:active {
            background: rgba(255,255,255,0.12) !important;
          }
          @media (prefers-reduced-transparency: reduce) {
            /* Solid opaque fallback for users who prefer reduced transparency */
            [data-garage-banner] {
              background: rgb(28, 28, 32) !important;
              backdrop-filter: none !important;
              -webkit-backdrop-filter: none !important;
            }
          }
          @supports not (backdrop-filter: blur(1px)) {
            /* Fallback for browsers without backdrop-filter support */
            [data-garage-banner] {
              background: rgba(20, 20, 24, 0.92) !important;
            }
          }
        `}</style>

        {/* ── App Icon — rounded rect with glass border ── */}
        <div
          style={{
            flexShrink: 0,
            width: 52,
            height: 52,
            borderRadius: 14,
            overflow: "hidden",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.14)",
            boxShadow: "0 2px 10px rgba(0,0,0,0.50)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.png"
            alt="Garage"
            width={52}
            height={52}
            style={{ objectFit: "cover" }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>

        {/* ── Text ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', system-ui, sans-serif",
              fontWeight: 600,
              fontSize: 15,
              color: "#ffffff",
              lineHeight: 1.25,
              letterSpacing: "-0.015em",
            }}
          >
            Open in Garage Shop
          </p>
          {contentTitle && (
            <p
              style={{
                margin: "2px 0 0",
                fontFamily:
                  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', system-ui, sans-serif",
                fontSize: 12,
                color: "rgba(255,255,255,0.48)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                letterSpacing: "-0.005em",
              }}
            >
              {contentTitle}
            </p>
          )}
          <p
            style={{
              margin: "3px 0 0",
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', system-ui, sans-serif",
              fontSize: 11,
              fontWeight: 500,
              color: "color-mix(in srgb, var(--brand-2) 85%, transparent)",
              letterSpacing: "0.01em",
            }}
          >
            Better experience in the app
          </p>
        </div>

        {/* ── Open App — pill button with amber gradient ── */}
        <button
          className="garage-open-btn"
          onClick={handleOpenApp}
          disabled={loading}
          style={{
            flexShrink: 0,
            padding: "9px 20px",
            borderRadius: 980,
            border: "none",
            background: loading
              ? "color-mix(in srgb, var(--brand-2) 30%, transparent)"
              : "linear-gradient(135deg, #FBA70A 0%, #F59E0B 100%)",
            color: loading ? "rgba(0,0,0,0.40)" : "#000000",
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', system-ui, sans-serif",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "-0.01em",
            cursor: loading ? "default" : "pointer",
            minWidth: 76,
            outline: "none",
            boxShadow: loading
              ? "none"
              : "0 2px 14px color-mix(in srgb, var(--brand-2) 50%, transparent), inset 0 1px 0 rgba(255,255,255,0.28)",
          }}
        >
          {loading ? "Opening…" : "Open App"}
        </button>

        {/* ── Dismiss — circular glass button ── */}
        <button
          className="garage-dismiss-btn"
          onClick={handleDismiss}
          aria-label="Dismiss"
          style={{
            flexShrink: 0,
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.11)",
            color: "rgba(255,255,255,0.42)",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
            outline: "none",
          }}
        >
          ✕
        </button>
      </div>

      {/* Spacer so page content isn't hidden behind the banner */}
      <div style={{ height: 88, paddingBottom: "env(safe-area-inset-bottom)" }} />
    </>
  );
}
