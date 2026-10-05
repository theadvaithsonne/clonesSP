"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { fetchWhitelabelOrg } from "@/lib/whitelabel";
import { isBat246Domain } from "@/lib/bat246Office";
import { usePathname } from "next/navigation";
import { Apple, Smartphone, Loader2 } from "lucide-react";
import Image from "next/image";
import {
  playReferrer,
  refInstallLink,
  registerInstallIntent,
} from "@/lib/installIntent";

// Store URLs for Garage HQ
const IOS_APP_STORE_URL =
  process.env.NEXT_PUBLIC_IOS_APP_STORE_URL ||
  "https://apps.apple.com/in/app/garage-hq/id6754905027";

const ANDROID_PLAY_STORE_URL =
  process.env.NEXT_PUBLIC_ANDROID_PLAY_STORE_URL ||
  "https://play.google.com/store/apps/details?id=com.garageapp.hq";

// Custom URI scheme registered in the mobile app Info.plist / app.json
const APP_SCHEME = "garagehq";

// Android package id — kept in sync with the Play Store URL's `id=` param
const ANDROID_PACKAGE =
  ANDROID_PLAY_STORE_URL.match(/[?&]id=([^&]+)/)?.[1] || "com.garageapp.hq";

// How long to wait for the app to visibly take over before giving up and
// going to the store. Only used on the referral path — see the launch effect.
const APP_LAUNCH_FALLBACK_MS = 1500;

type Platform = "ios" | "android" | "other";

function detectPlatform(ua: string): Platform {
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  // iPadOS 13+ spoofs a desktop Mac UA but has touch points
  if (/Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

/**
 * Checks if the current pathname is in the list of paths excluded from the mobile app gate.
 * The following paths are allowed to open on the mobile browser without auto-redirect:
 * - /invoice, /magic-link, /webinar, /meet, /games/bat246 (and all subpaths),
 *   /checkout/product, /bat246-videos
 * - /guest/* — ALL guest store/product pages are excluded so the OpenInAppBanner
 *   handles deep linking instead of the gate auto-firing a Play Store redirect.
 */
function isPathExcluded(pathname: string): boolean {
  // 1. Direct prefix matches
  const prefixes = [
    "/invoice",
    // Public NetworkChain offer links — the recipient may not have the app
    // (or any Garage account); the page hands off to /invoice to pay.
    "/magic-link",
    "/webinar",
    "/meet",
    // Entire BAT 246 ecosystem (gotobigwin join flow, boards, dashboard, docs, lostmoney, members, etc.)
    "/games/bat246",
    // Product & board entry checkout pages
    "/checkout/product",
    // Bat246 intro videos
    "/bat246-videos",
    // GarageIRL links (counter QR, bill QR, product share). Their own page
    // hands off to that app; this gate would open HQ and read ?ref= wrongly.
    "/s",
    "/a",
    "/product",
  ];
  if (prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return true;
  }

  // 2. ALL /guest/* paths — the OpenInAppBanner in the guest pages handles
  //    the "open in app" flow for these routes. The gate must NOT intercept
  //    them, otherwise Chrome auto-redirects to the Play Store before the
  //    page even renders.
  if (pathname.startsWith("/guest/")) {
    return true;
  }

  return false;
}

interface OpenInAppGateProps {
  children: React.ReactNode;
}

/**
 * Mobile gate for all Garage HQ routes. On a mobile UA the gate:
 *
 *   - Android: fires an `intent://` URL matching com.garageapp.hq + https host that opens
 *     the app if installed, else follows S.browser_fallback_url to the Play Store.
 *
 *   - iOS: attempts to open the app via registered custom URI scheme `garagehq://`.
 *
 *   - Blocks mobile users from proceeding into web-only routes while providing fallback links.
 *   - Excluded paths (/invoice, /magic-link, /meet, /webinar, /games/bat246, /checkout/product, /bat246-videos, /guest/*) bypass the gate and open in browser.
 */
export default function OpenInAppGate({ children }: OpenInAppGateProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const [log, setLog] = useState<string[]>([]);
  const [isIframe, setIsIframe] = useState(false);
  const [isEmbeddedAuth, setIsEmbeddedAuth] = useState(false);

  // Client-side only query params to avoid Next.js build-time de-optimization
  const [previewMode, setPreviewMode] = useState(false);
  const [debug, setDebug] = useState(false);
  // Affiliate code on the URL (/login?referCode=aff_x). Read in the same
  // client-side pass as the params above — touching window.location during
  // render would de-optimize the whole tree at build time.
  const [referCode, setReferCode] = useState<string | null>(null);

  /**
   * Who invited them. On a phone this gate REPLACES the page, so the inviter
   * card /login renders on desktop (Welcome.tsx) is never seen — the one
   * moment the referral is worth anything, the visitor gets an anonymous
   * "install our app" wall instead. Naming the sender here is what makes the
   * store bounce read as accepting an invitation.
   *
   * Same source and same failure rule as the desktop card: `light=1` skips
   * the downline aggregation nothing here renders, and anything that doesn't
   * resolve to a real name leaves the card out rather than rendering an empty
   * one or the raw code.
   */
  const [inviter, setInviter] = useState<{
    name: string;
    profilePicture: string | null;
  } | null>(null);
  useEffect(() => {
    if (!referCode) {
      setInviter(null);
      return;
    }
    let cancelled = false;
    api<{
      success: boolean;
      referrer?: { name?: string; profilePicture?: string | null };
    }>(
      `/affiliate/referrer-info?affiliateId=${encodeURIComponent(
        referCode
      )}&light=1`
    )
      .then((r) => {
        if (cancelled) return;
        // The backend returns "" rather than "Unknown" for a nameless user.
        const name = r?.referrer?.name?.trim();
        setInviter(
          r?.success && name
            ? { name, profilePicture: r.referrer?.profilePicture ?? null }
            : null
        );
      })
      .catch(() => {
        if (!cancelled) setInviter(null);
      });
    return () => {
      cancelled = true;
    };
  }, [referCode]);

  // Single-run guard. A ref (not state) so setting it doesn't re-trigger the
  // effect and cancel the pending redirect.
  const attemptedRef = useRef(false);

  const dbg = (m: string) => {
    if (debug) setLog((l) => [...l, m]);
  };

  // Detect platform and query params client-side only (no SSR navigator)
  useEffect(() => {
    setMounted(true);

    if (typeof window === "undefined") return;

    if (window.self !== window.top) {
      setIsIframe(true);
    }

    const searchParams = new URLSearchParams(window.location.search);
    const gateParam = searchParams.get("gate");
    const debugParam = searchParams.get("debug") === "1";
    const flow = searchParams.get("flow");
    const hideBack = searchParams.get("hideBack");

    if (flow === "login" || hideBack === "1") {
      setIsEmbeddedAuth(true);
    }

    setDebug(debugParam);
    // Both spellings, matching what /login itself accepts (Welcome.tsx and
    // the page's generateMetadata): `referCode` on the app's own invite links,
    // `ref` on storefront share links. Reading only one of them silently lost
    // the affiliate on every link that used the other — no path on the launch
    // URL, no store fallback, no intent parked, and the signup on the far side
    // credited nobody.
    setReferCode(searchParams.get("referCode") || searchParams.get("ref"));

    if (gateParam === "ios" || gateParam === "android") {
      setPreviewMode(true);
      setPlatform(gateParam as Platform);
      return;
    }

    const ua = window.navigator.userAgent;
    const p = detectPlatform(ua);
    setPlatform(p);

    if (debugParam) {
      dbg(`mount: platform=${p}`);
      dbg(`ua=${ua.slice(0, 90)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Determine if current path is excluded from the gate
  const pathExcluded = useMemo(() => isPathExcluded(pathname), [pathname]);

  /**
   * Bat246 never sees this gate.
   *
   * Its funnel runs entirely on a white-label domain, so telling those
   * visitors to "continue in the Garage App" both breaks the journey and puts
   * Garage's brand in front of someone else's customers — the opposite of
   * what the domain is for.
   *
   * Scoped to the white-label org, so my.garage.app and every other office
   * keep the gate exactly as it is.
   */
  const BAT246_ORG_ID = "6a0d34e677323d1b81c6469b";
  /**
   * Resolved here rather than from WhitelabelProvider.
   *
   * This gate lives in the ROOT layout, while the provider is mounted lower
   * down in (auth) and (dashboard). The context is therefore always null here
   * — an earlier attempt to read it could never match, which is why the gate
   * kept appearing on Bat246's domain.
   *
   * `null` means "not decided yet": the gate holds off until the lookup
   * settles, so it cannot flash before we know the office.
   */
  const [gateOrgId, setGateOrgId] = useState<string | null | undefined>(
    undefined
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname;
    // bat246.com is BAT 246's login page (see Welcome.tsx) — keyed off the
    // hostname, not the lookup below, since the domain need not be
    // registered to the office.
    if (/(^|\.)gotobigwin\.com$/i.test(host) || isBat246Domain()) {
      setGateOrgId(BAT246_ORG_ID);
      return;
    }
    if (
      host === "my.garage.app" ||
      host.endsWith(".garage.app") ||
      host === "localhost" ||
      host === "127.0.0.1"
    ) {
      setGateOrgId(null);
      return;
    }
    let cancelled = false;
    fetchWhitelabelOrg(host)
      .then((org) => {
        if (!cancelled) setGateOrgId(org?.orgId ?? null);
      })
      .catch(() => {
        if (!cancelled) setGateOrgId(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  /**
   * While the white-label lookup is still in flight we do NOT know which
   * office this is, so the gate must not commit yet — rendering it and
   * hiding it a moment later would flash the interstitial (and, worse, fire
   * its redirect) on exactly the domain that is meant to be exempt.
   *
   * Treating "still loading" as excluded keeps the page usable for the extra
   * few hundred milliseconds; the gate reappears if the org turns out not to
   * be exempt.
   */
  const excluded =
    pathExcluded ||
    isIframe ||
    isEmbeddedAuth ||
    gateOrgId === undefined || // lookup still in flight — do not commit yet
    gateOrgId === BAT246_ORG_ID;

  /**
   * What an invited visitor is worth once the app opens: the affiliate to
   * credit. `null` for everyone else, and that null is what keeps the gate's
   * original behaviour intact below — no path on the launch URL, no store
   * fallback, no intent parked.
   *
   * A referral link names no destination, so this is the bare `/?ref=` form.
   * The app splits it on first launch: the ref goes to its sticky store and
   * is spent at signup (garage-chat lib/deferred-link.ts).
   */
  const installLink = useMemo(() => refInstallLink(referCode), [referCode]);

  // Android carries the link inside the Play URL itself; Play preserves
  // `referrer` through the install and hands it back via the Install Referrer
  // API, so an Android install never has to rely on the fingerprint.
  const storeUrl = useMemo(() => {
    const base =
      platform === "ios" ? IOS_APP_STORE_URL : ANDROID_PLAY_STORE_URL;
    if (platform !== "android" || !installLink) return base;
    return `${base}&referrer=${encodeURIComponent(playReferrer(installLink))}`;
  }, [platform, installLink]);

  // Android intent URL. Normally opens the app to its HOME screen (no path):
  // we deliberately don't embed the web pathname (e.g. /workspace) because the
  // mobile app uses different routes and would show "unmatched route", and
  // there is no S.browser_fallback_url — Chrome must NOT auto-redirect an
  // ordinary visitor to the Play Store.
  //
  // A referral link is the one exception on both counts. Its `?ref=` is the
  // whole point of the visit, so it rides along; and going to the store is
  // the desired outcome for someone who doesn't have the app yet, so the
  // fallback is set — which is also what puts the Play `referrer` in front of
  // them.
  const intentUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const path = installLink ? installLink.replace(/^\/+/, "") : "";
    const fallback = installLink
      ? `S.browser_fallback_url=${encodeURIComponent(storeUrl)};`
      : "";
    return `intent://${path}#Intent;scheme=${APP_SCHEME};package=${ANDROID_PACKAGE};${fallback}end`;
  }, [installLink, storeUrl]);

  // iOS custom scheme — the app's home screen, or the referral link when
  // there is one.
  const appSchemeUrl = useMemo(() => {
    return `${APP_SCHEME}://${installLink ? installLink.replace(/^\/+/, "") : ""}`;
  }, [installLink]);

  const appLink = platform === "android" ? intentUrl : appSchemeUrl;

  // On mount (mobile only, not preview, not excluded):
  // Automatically attempt to launch the native app via deep link / intent URL,
  // while displaying the gate UI block screen.
  useEffect(() => {
    if (!mounted || previewMode || excluded) return;
    if (platform === "other") return;
    if (!appLink) return;
    if (attemptedRef.current) return;
    attemptedRef.current = true;
    dbg(`auto launching appLink: ${appLink}`);

    // No referral to carry — the original behaviour, unchanged. Attempt the
    // app and stop there; the card below offers the store by hand. A visitor
    // who merely opened a Garage URL on their phone is never thrown out of
    // the browser to a listing they didn't ask for.
    if (!installLink) {
      try {
        window.location.href = appLink;
      } catch (err) {
        console.error("Auto deep link error:", err);
      }
      return;
    }

    // Invited visitor. If the app doesn't visibly take over, they don't have
    // it — send them to the store, parking the referral first so it survives
    // the install and the signup on the other side still credits the referrer.
    let handed = false;
    const goToStore = () => {
      if (handed) return;
      handed = true;
      dbg(`store fallback: ${storeUrl}`);
      // Not awaited: registerInstallIntent dispatches a `keepalive` fetch,
      // which the browser finishes even though the navigation below tears
      // this page down a moment later.
      void registerInstallIntent(
        platform === "ios" ? "ios" : "android",
        installLink
      );
      window.location.replace(storeUrl);
    };

    // The tab going hidden means the OS handed off to the app: there is no
    // install to defer, and bouncing to the store now would both interrupt
    // them and leave a decoy intent for the next person on this network.
    const cancel = () => {
      if (document.hidden) {
        handed = true;
        dbg("app took over — store fallback cancelled");
      }
    };
    document.addEventListener("visibilitychange", cancel);
    window.addEventListener("pagehide", cancel);

    // On a real Android device the intent:// navigation resolves this itself
    // (app, or S.browser_fallback_url to Play) and tears the timer down. The
    // timer is for iOS, and for environments that only spoof a mobile UA —
    // desktop DevTools emulation, some embedded webviews — which don't
    // understand either scheme and would otherwise sit here forever.
    const timer = window.setTimeout(goToStore, APP_LAUNCH_FALLBACK_MS);

    try {
      window.location.href = appLink;
    } catch (err) {
      console.error("Auto deep link error:", err);
    }

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", cancel);
      window.removeEventListener("pagehide", cancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, previewMode, excluded, platform, appLink, installLink, storeUrl]);

  // Server render, desktop, or excluded routes pass straight through to the web app
  if (!mounted || platform === "other" || excluded) {
    return <>{children}</>;
  }

  const storeLabel =
    platform === "ios" ? "Download on App Store" : "Get it on Google Play";

  return (
    <div className="min-h-screen w-full bg-[#0c0c0e] flex items-center justify-center p-6 select-none">
      <div className="w-full max-w-md bg-[#121218] rounded-2xl border border-[#2a2a35] overflow-hidden shadow-2xl relative">
        <div className="p-8 text-center flex flex-col items-center">
          {/* Logo container */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-white/5 flex items-center justify-center mb-6 shadow-lg">
            <Image
              src="/logo-icon.svg"
              alt="Garage Logo"
              width={48}
              height={48}
              className="object-contain"
              priority
            />
          </div>

          {/* Who invited them — the desktop card's counterpart, since this
              gate stands in for the whole page on a phone. */}
          {inviter && (
            <div className="mb-5 flex w-full items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5">
              {inviter.profilePicture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={inviter.profilePicture}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold uppercase text-primary">
                  {inviter.name.charAt(0)}
                </span>
              )}
              <p className="min-w-0 truncate text-left text-sm text-gray-300">
                <span className="font-semibold text-white">{inviter.name}</span>
                {" invited you to Garage"}
              </p>
            </div>
          )}

          <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">
            Open in the Garage App
          </h1>

          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            {inviter
              ? "Continue in the app to accept the invite and set up your account."
              : "Garage is optimized for mobile on our native app. Continue in the app to access your workspace."}
          </p>
        </div>

        <div className="px-8 pb-8 flex flex-col gap-3">
          {/* Primary CTA: Open the app directly */}
          <a
            href={appLink}
            className="flex items-center justify-center gap-2.5 w-full h-12 sm:h-14 rounded-xl bg-gradient-to-r from-primary to-secondary hover:from-primary/95 hover:to-secondary/95 text-black text-sm sm:text-base font-semibold shadow-lg transition-transform active:scale-[0.98]"
          >
            <Smartphone className="h-5 w-5" />
            Open Garage App
          </a>

          {/* Secondary CTA: Fallback store link */}
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 text-xs sm:text-sm font-medium text-gray-400 hover:text-white transition-colors text-center"
          >
            {platform === "ios" ? (
              <Apple className="h-4 w-4" />
            ) : (
              <Smartphone className="h-4 w-4" />
            )}
            {storeLabel}
          </a>
        </div>

        {/* Status footer — hidden in screenshot preview mode */}
        {!previewMode && (
          <div className="border-t border-[#2a2a35]/50 px-8 py-4 flex items-center justify-center gap-2 text-xs text-gray-500 bg-[#0f0f14]">
            {platform === "ios" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                Opening Garage App…
              </>
            ) : (
              <>
                <Smartphone className="h-3.5 w-3.5 text-primary" />
                Tap &quot;Open Garage App&quot; above to continue
              </>
            )}
          </div>
        )}

        {/* Diagnostic overlay — only when ?debug=1 is in the URL */}
        {debug && (
          <div className="border-t border-[#2a2a35] px-6 py-4 text-left text-[11px] leading-relaxed text-gray-400 font-mono break-all bg-black/40">
            <div className="mb-1 text-gray-500 font-bold">debug log:</div>
            {log.length === 0 ? (
              <div>(no events yet)</div>
            ) : (
              log.map((l, i) => <div key={i}>· {l}</div>)
            )}
          </div>
        )}
      </div>
    </div>
  );
}



