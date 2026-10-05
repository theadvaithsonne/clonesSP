"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Apple, Smartphone } from "lucide-react";
import {
  IRL_IOS_STORE_URL,
  irlBillLink,
  irlIntentUrl,
  irlPlayUrl,
  irlProductLink,
  irlSchemeUrl,
  irlStoreLink,
  type IrlLinkKind,
  type IrlProductPreview,
} from "@/lib/garageIrl";
import { registerInstallIntent } from "@/lib/installIntent";

// How long iOS gets to visibly hand off to the app before we assume it isn't
// installed and go to the App Store. Same budget as OpenInAppGate.
const APP_LAUNCH_FALLBACK_MS = 1500;

type Platform = "ios" | "android" | "other";

function detectPlatform(ua: string): Platform {
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  // iPadOS 13+ spoofs a desktop Mac UA but has touch points
  if (/Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

const HEADLINE: Record<IrlLinkKind, string> = {
  store: "Open this store in GarageIRL",
  bill: "Join this bill in GarageIRL",
  product: "View this item in GarageIRL",
};

function buildLink(kind: IrlLinkKind, id: string, ref: string | null) {
  if (kind === "store") return irlStoreLink(id, ref);
  if (kind === "bill") return irlBillLink(id);
  return irlProductLink(id, ref);
}

interface IrlHandoffProps {
  kind: IrlLinkKind;
  /** The path segment: store slug, bill code or product id. Validated here. */
  id: string;
  /** Product links: the item, fetched server-side. Null if it couldn't be. */
  product?: IrlProductPreview | null;
}

/**
 * Phone handoff for GarageIRL links (see lib/garageIrl.ts).
 *
 *   - Android: `intent://` — opens the app if installed, else Chrome follows
 *     S.browser_fallback_url to Play, with the link in the install referrer.
 *   - iOS: `garagepayseller://`; if the page is still visible after the
 *     timeout, park the link as an install intent and go to the App Store.
 *   - Desktop: no redirect, just the store buttons.
 *
 * The page itself always renders — it's what the OS dialog sits over, and
 * what someone returning from the store lands on, with buttons to retry.
 */
export default function IrlHandoff({ kind, id, product }: IrlHandoffProps) {
  const [platform, setPlatform] = useState<Platform>("other");
  // undefined until mounted; null when the link didn't validate.
  const [link, setLink] = useState<string | null | undefined>(undefined);

  // Single-run guard. A ref (not state) so setting it doesn't re-trigger the
  // effect and cancel the pending redirect.
  const attemptedRef = useRef(false);

  // Query read client-side, like OpenInAppGate, so the page never needs
  // useSearchParams (and the Suspense boundary that comes with it).
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    setLink(buildLink(kind, id, ref));
    setPlatform(detectPlatform(window.navigator.userAgent));
  }, [kind, id]);

  const playUrl = irlPlayUrl(link ?? null, kind);

  const launch = useCallback((): (() => void) | undefined => {
    if (link === undefined || platform === "other") return;

    if (platform === "android") {
      window.location.replace(irlIntentUrl(link, kind));
      return;
    }

    // iOS. The tab going hidden means the app took over: there's no install
    // to defer, and bouncing to the store now would interrupt them and leave
    // a decoy intent for the next person on this network.
    let handed = false;
    const cancel = () => {
      if (document.hidden) handed = true;
    };
    document.addEventListener("visibilitychange", cancel);
    window.addEventListener("pagehide", cancel);

    const timer = window.setTimeout(() => {
      if (handed) return;
      handed = true;
      // Not awaited: a `keepalive` fetch survives the navigation below.
      if (link) void registerInstallIntent("ios", link, "pay");
      window.location.replace(IRL_IOS_STORE_URL);
    }, APP_LAUNCH_FALLBACK_MS);

    window.location.href = irlSchemeUrl(link);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", cancel);
      window.removeEventListener("pagehide", cancel);
    };
  }, [link, platform, kind]);

  // Auto-attempt once on mount. A link that didn't validate isn't launched
  // automatically — the buttons below still work.
  useEffect(() => {
    if (!link || platform === "other") return;
    if (attemptedRef.current) return;
    attemptedRef.current = true;
    return launch();
  }, [link, platform, launch]);

  const isPhone = platform !== "other";

  return (
    <div className="min-h-screen w-full bg-[#0B0906] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#161209] shadow-2xl overflow-hidden">
        <div className="p-8 text-center flex flex-col items-center">
          <Image
            src="/garage-irl-icon.png"
            alt="GarageIRL"
            width={72}
            height={72}
            className="rounded-2xl mb-6"
            priority
          />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand mb-2">
            GarageIRL
          </p>
          <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">
            {HEADLINE[kind]}
          </h1>
          {product && (
            <div className="w-full mt-4 mb-5 flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-3 text-left">
              {product.image && (
                // eslint-disable-next-line @next/next/no-img-element -- remote seller upload
                <img
                  src={product.image}
                  alt=""
                  className="h-16 w-16 flex-none rounded-lg object-cover bg-white/10"
                />
              )}
              <div className="min-w-0">
                <p className="text-base font-semibold text-white truncate">
                  {product.title}
                </p>
                {product.storeName && (
                  <p className="text-xs text-white/50 truncate">
                    {product.storeName}
                  </p>
                )}
                {product.price && (
                  <p className="text-sm font-semibold text-brand mt-0.5">
                    {product.price}
                  </p>
                )}
              </div>
            </div>
          )}
          <p className="text-sm text-white/60 leading-relaxed">
            {isPhone
              ? "Opening the app… If nothing happens, tap below or get GarageIRL from your app store."
              : "Open this link on your phone to continue in GarageIRL, or get the app below."}
          </p>
        </div>

        <div className="px-8 pb-8 flex flex-col gap-3">
          {isPhone && (
            <button
              type="button"
              onClick={() => {
                attemptedRef.current = true;
                launch();
              }}
              className="flex items-center justify-center gap-2.5 w-full h-12 rounded-xl bg-gradient-to-r from-[#FFE066] via-brand to-[#FF9A00] text-[#1A1305] text-base font-semibold shadow-lg transition-transform active:scale-[0.98]"
            >
              <Smartphone className="h-5 w-5" />
              Open GarageIRL
            </button>
          )}

          <div className="grid grid-cols-2 gap-3">
            <a
              href={IRL_IOS_STORE_URL}
              onClick={() => {
                // Same deferral as the automatic fallback, for a visitor
                // who goes to the store by hand.
                if (platform === "ios" && link) {
                  void registerInstallIntent("ios", link, "pay");
                }
              }}
              className="flex items-center justify-center gap-2 h-11 rounded-xl border border-white/15 bg-white/5 text-sm font-medium text-white hover:bg-white/10 transition-colors"
            >
              <Apple className="h-4 w-4" />
              App Store
            </a>
            <a
              href={playUrl}
              className="flex items-center justify-center gap-2 h-11 rounded-xl border border-white/15 bg-white/5 text-sm font-medium text-white hover:bg-white/10 transition-colors"
            >
              <Smartphone className="h-4 w-4" />
              Google Play
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
