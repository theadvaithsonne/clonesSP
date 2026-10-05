"use client";

// Share an event — and get paid when the link converts.
//
// The link a signed-in user copies carries THEIR affiliate id, never the one
// they arrived with. That is the same rule the rest of the product follows
// (see `lib/affiliate-share.ts`), and it is what makes the chain work: B
// shares A's event, C buys through B's link, B earns.
//
// A guest gets the plain event URL plus a reason to sign in. We deliberately
// do not mint an affiliate id for someone who has not asked for one.

import React, { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Link2,
  Loader2,
  Mail,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import {
  copyToClipboard,
  fetchMyAffiliateId,
  withAffiliateRef,
} from "@/lib/affiliate-share";
import type {
  EventProgram,
  EventTheme,
} from "@/components/dashboard/inlineApps/events/types";

const FALLBACK_ACCENT = "#FACC15";

/** Each network wants the text and the URL in its own shape. */
export function shareTargets(url: string, message: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(message);
  return [
    {
      key: "whatsapp",
      label: "WhatsApp",
      href: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${message} ${url}`)}`,
    },
    { key: "x", label: "X", href: `https://twitter.com/intent/tweet?text=${t}&url=${u}` },
    {
      key: "linkedin",
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    },
    { key: "telegram", label: "Telegram", href: `https://t.me/share/url?url=${u}&text=${t}` },
    {
      key: "email",
      label: "Email",
      href: `mailto:?subject=${t}&body=${encodeURIComponent(`${message}\n\n${url}`)}`,
    },
  ];
}

export default function ShareEventModal({
  open,
  onOpenChange,
  event,
  theme,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: EventProgram;
  theme?: EventTheme;
}) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accent = theme?.primaryColor || FALLBACK_ACCENT;

  const [affiliateId, setAffiliateId] = useState("");
  const [loadingId, setLoadingId] = useState(false);
  const [copied, setCopied] = useState(false);

  const baseUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/events/${event.slug || event._id}`;

  /**
   * Resolved on open rather than on mount: most visitors never share, and the
   * endpoint mints an affiliate id as a side effect for anyone who asks.
   */
  useEffect(() => {
    if (!open || !isAuthenticated) return;
    let alive = true;
    setLoadingId(true);
    void fetchMyAffiliateId()
      .then((id) => {
        if (alive) setAffiliateId(id);
      })
      .finally(() => {
        if (alive) setLoadingId(false);
      });
    return () => {
      alive = false;
    };
  }, [open, isAuthenticated]);

  // A fresh copy button every time the sheet opens.
  useEffect(() => {
    if (open) setCopied(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const link = affiliateId ? withAffiliateRef(baseUrl, affiliateId) : baseUrl;
  const message = `${event.name} — I thought you'd want to be there.`;

  const copy = useCallback(async () => {
    const ok = await copyToClipboard(link);
    setCopied(ok);
    if (ok) window.setTimeout(() => setCopied(false), 2000);
  }, [link]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-[#e9e9ee] px-5 py-4">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-[#15151a]">
            <Share2 className="h-4 w-4" />
            Share this event
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[#8c8d9c] transition-colors hover:bg-[#f1f1f4] hover:text-[#15151a]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-5">
          {isAuthenticated && affiliateId ? (
            <div
              className="flex items-start gap-2.5 rounded-xl px-3.5 py-3"
              style={{ background: `${accent}1f` }}
            >
              <Sparkles
                className="mt-0.5 h-4 w-4 shrink-0"
                style={{ color: "#9a7b00" }}
              />
              <p className="text-[12px] leading-5 text-[#5f6070]">
                <span className="font-semibold text-[#15151a]">
                  Earn commission on every ticket bought through your link.
                </span>{" "}
                Anyone who opens this link is credited to you for the whole
                event.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#e9e9ee] px-3.5 py-3">
              <p className="text-[12px] leading-5 text-[#5f6070]">
                <span className="font-semibold text-[#15151a]">
                  Sign in to get your referral link
                </span>{" "}
                and earn commission on tickets bought through it. You can still
                share the plain link below.
              </p>
              <a
                href={`/login?next=${encodeURIComponent(
                  typeof window === "undefined" ? "" : window.location.pathname
                )}`}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[#141418]"
                style={{ background: accent }}
              >
                Sign in
              </a>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[#5f6070]">
              {affiliateId ? "Your referral link" : "Event link"}
            </label>
            <div className="flex gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#e9e9ee] px-3 py-2.5">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-[#8c8d9c]" />
                <span className="min-w-0 flex-1 truncate text-[12px] text-[#15151a]">
                  {loadingId ? "Preparing your link…" : link}
                </span>
              </div>
              <button
                type="button"
                onClick={copy}
                disabled={loadingId}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-[12px] font-semibold text-[#141418] transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: accent }}
              >
                {loadingId ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            {copied && (
              <p className="mt-1.5 text-[11px] text-[#16a34a]">
                Copied to clipboard!
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 text-[12px] font-medium text-[#5f6070]">
              Or share straight to
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {shareTargets(link, message).map((t) => (
                <a
                  key={t.key}
                  href={t.href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => onOpenChange(false)}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-[#e9e9ee] px-2 py-3 text-[11px] font-medium text-[#5f6070] transition-colors hover:border-[#15151a] hover:text-[#15151a]"
                >
                  {t.key === "email" ? (
                    <Mail className="h-4 w-4" />
                  ) : (
                    <Share2 className="h-4 w-4" />
                  )}
                  {t.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
