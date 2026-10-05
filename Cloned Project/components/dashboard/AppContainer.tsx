"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { isSSOEnabled, generateExchangeToken, buildSSOUrl } from "@/lib/sso";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { RotateCw, ExternalLink, ArrowLeft, Loader2 } from "lucide-react";
import { INLINE_APP_REGISTRY } from "./inlineApps/registry";

type AppRow = { id: string; name: string; url: string };

export default function AppContainer({
  id,
  isFounder = false,
  adminApps = [],
  onClose,
  teamforceSection,
  dealsSection,
  networkMailSection,
  thoughtsSection,
}: {
  id: string;
  isFounder?: boolean;
  adminApps?: AppRow[];
  onClose?: () => void;
  teamforceSection?: string;
  dealsSection?: string;
  networkMailSection?: string;
  thoughtsSection?: string;
}) {
  // Check if this is an inline app (renders a React component, not an iframe)
  const InlineComponent = INLINE_APP_REGISTRY[id];
  if (InlineComponent) {
    // Wrap in a fully opaque pure-neutral black background to block the parent's
    // backdrop-blur from bleeding colored UI underneath through
    return (
      <div className="absolute inset-0 bg-[#0e0e0e]">
        <InlineComponent
          onClose={onClose || (() => {})}
          section={
            id === "teamforce"
              ? teamforceSection
              : id === "deals"
                ? dealsSection
                : id === "network-mail"
                  ? networkMailSection
                  : id === "thoughts"
                    ? thoughtsSection
                    : undefined
          }
        />
      </div>
    );
  }
  const router = useRouter();

  const [apps, setApps] = useState<AppRow[]>([]);
  const [app, setApp] = useState<AppRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [iframeKey, setIframeKey] = useState(() => Date.now());
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [ssoLoading, setSsoLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (isFounder) {
      setApps(adminApps || []);
      setApp(adminApps?.find((a) => a.id === id) || null);
      return;
    }

    (async () => {
      const orgId = localStorage.getItem("garage_org_id");
      const res = await api<{ apps: AppRow[] }>(
        `/apps/my?orgId=${orgId}`,
        {},
        getToken()!
      );
      const rows = res.apps || [];
      setApps(rows);
      setApp(rows.find((a) => a.id === id) || null);
    })();
  }, [id, isFounder, adminApps]);

  // SSO token generation for enabled apps
  useEffect(() => {
    if (!app) return;

    console.log("[SSO] App loaded:", app.id, "SSO enabled:", isSSOEnabled(app.id));

    if (isSSOEnabled(app.id)) {
      setSsoLoading(true);
      console.log("[SSO] Generating exchange token for:", app.id);
      generateExchangeToken(app.id)
        .then((token) => {
          const ssoUrl = buildSSOUrl(app.url, token);
          console.log("[SSO] Exchange token generated, iframe URL:", ssoUrl);
          setIframeSrc(ssoUrl);
        })
        .catch((err) => {
          console.error("[SSO] Failed to generate exchange token, falling back to direct URL:", err);
          setIframeSrc(app.url);
        })
        .finally(() => setSsoLoading(false));
    } else {
      console.log("[SSO] SSO not enabled for app:", app.id, "- loading direct URL");
      setIframeSrc(app.url);
    }
  }, [app]);

  // Post logout message to iframe
  const postToIframe = useCallback(
    (type: string, payload?: Record<string, unknown>) => {
      if (!iframeRef.current?.contentWindow || !app?.url) return;
      try {
        const targetOrigin = new URL(app.url).origin;
        iframeRef.current.contentWindow.postMessage({ type, ...payload }, targetOrigin);
      } catch {
        // Silently fail for cross-origin issues
      }
    },
    [app?.url]
  );

  // Listen for garage:logout event and forward to iframe
  useEffect(() => {
    const handleLogout = () => postToIframe("GARAGE_LOGOUT");
    window.addEventListener("garage:logout", handleLogout);
    return () => window.removeEventListener("garage:logout", handleLogout);
  }, [postToIframe]);

  // Listen for SSO_READY from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!app?.url) return;
      try {
        const expectedOrigin = new URL(app.url).origin;
        if (event.origin !== expectedOrigin) return;
      } catch {
        return;
      }
      if (event.data?.type === "SSO_READY") {
        console.log("[SSO] Iframe reports SSO ready");
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [app?.url]);

  // favicon helper
  const favicon = useMemo(() => {
    if (!app?.url) return "";
    try {
      const hostname = new URL(app.url).hostname;
      return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
    } catch {
      return "";
    }
  }, [app?.url]);

  // show an inline hint if the site blocks embedding
  useEffect(() => {
    setLoaded(false);
    const t = setTimeout(() => {
      // if still not loaded, show hint (kept subtle in UI)
      // (Some sites set X-Frame-Options / CSP and won't render)

    }, 1500);
    return () => clearTimeout(t);
  }, [iframeKey]);

  if (!app) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="rounded-xl border border-[#2a2a35] bg-[#0e0e12] p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">App not found</h2>
              <p className="text-sm text-[#a5a6bf]">
                You may need to subscribe first.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-[#3d3d51] text-[#ddd] hover:bg-[#191923]"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                className="bg-brand-2 hover:bg-[#5c0c9a] border border-[#7b31c2]/40"
                asChild
              >
                Go to Marketplace
              </Button>
            </div>
          </div>
          <p className="text-sm text-[#c7c7da]">
            Tip: Subscribe to an app from the marketplace. It will then appear
            in your sidebar under <strong>Apps</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="">
      {/* Iframe container */}
      <div className="border border-[#2a2a35] bg-[#0e0e12] overflow-hidden">
        {ssoLoading ? (
          <div className="w-full h-screen flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#a5a6bf]" />
            <span className="ml-3 text-sm text-[#a5a6bf]">Authenticating...</span>
          </div>
        ) : iframeSrc ? (
          <iframe
            ref={iframeRef}
            key={iframeKey}
            src={iframeSrc}
            className="w-full h-screen"
            onLoad={() => setLoaded(true)}
            referrerPolicy="no-referrer"
            allow="clipboard-read; clipboard-write"
          />
        ) : null}
        {!loaded && !ssoLoading && iframeSrc && (
          <div className="p-3 text-xs text-[#a5a6bf] border-t border-[#2a2a35]">
            If the site doesn't load here, it may block embedding in iframes.
            Use "Open in new tab".
          </div>
        )}
      </div>
    </div>
  );
}
