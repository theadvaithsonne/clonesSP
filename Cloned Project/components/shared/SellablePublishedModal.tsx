"use client";

// The popup a founder sees right after creating (or first publishing)
// something sellable — a course, community, live stream, digital product,
// service, 1:1 call, event or job. Left: what was just published and the share
// buttons. Right: a buyer's-eye preview card on a gradient of the office's own
// brand colour (Manage Org → colour).
//
// Every share link carries the founder's affiliate id (`?ref=<id>`), the same
// rule as `lib/affiliate-share.ts`, so traffic their shares bring in is
// attributed to them. Relative links resolve against the office's share
// origin (its own domain when that is healthy — see useOrgShareOrigin).
//
// Creation flows call `showSellablePublished(item)`; the single
// <SellablePublishedHost /> mounted in the dashboard layout renders it. The
// host lives outside the creation forms on purpose — most of them unmount the
// moment the create call succeeds.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { create } from "zustand";
import {
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  GraduationCap,
  Handshake,
  Loader2,
  Package,
  PhoneCall,
  Radio,
  Share2,
  ShoppingBag,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import { getOrgId } from "@/lib/auth";
import { useBrandColors } from "@/lib/brand-color-context";
import {
  copyToClipboard,
  fetchMyAffiliateId,
  withAffiliateRef,
} from "@/lib/affiliate-share";
import { fetchOrgShareOrigin } from "@/lib/hooks/useOrgShareOrigin";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";

export type SellableKind =
  | "course"
  | "community"
  | "live-stream"
  | "digital-product"
  | "service"
  | "call"
  | "event"
  | "job";

export interface SellablePublishedItem {
  /**
   * A known kind picks its own wording and card. Anything else still gets the
   * popup — say what it is with `noun` / `label` and add it to KINDS later.
   */
  kind: SellableKind | (string & {});
  /** For a kind not in KINDS: "bundle" → "Share your bundle". */
  noun?: string;
  /** For a kind not in KINDS: the card badge, "Bundle". */
  label?: string;
  title: string;
  /** Public page a buyer opens. A relative path resolves against the share origin. */
  url: string;
  image?: string | null;
  /** Already formatted for display — see formatSellablePrice. */
  price?: string | null;
  /** Short facts for the preview card, all from the saved item: "12 lessons". */
  facts?: Array<string | null | undefined | false>;
  /** Who it is from. Defaults to the current office's name. */
  byline?: string | null;
  /** Replaces the "<Kind> published!" heading, e.g. "You're live!". */
  heading?: string;
  /** Replaces the kind label on the preview card's badge, e.g. "Live now". */
  badge?: string;
  /** Replaces the preview card's call-to-action, e.g. "Join live". */
  cta?: string;
  /** One extra line under the share status, e.g. money held for rewards. */
  note?: string | null;
  /** Saved but not public yet — the popup asks for a publish instead of a share. */
  draft?: boolean;
  /** Runs after Done, ✕ or Esc. */
  onClose?: () => void;
  /** A second button beside Done, in place of "View <noun>". Closes the popup first. */
  action?: { label: string; onClick: () => void };
}

interface KindMeta {
  noun: string;
  label: string;
  icon: LucideIcon;
  heading: string;
  cta: string;
  /** What one conversion is called: "enrolment", "sale". */
  conversion: string;
  shareText: (title: string) => string;
}

const KINDS: Record<SellableKind, KindMeta> = {
  course: {
    noun: "course",
    label: "Course",
    icon: GraduationCap,
    heading: "Course published!",
    cta: "Enroll now",
    conversion: "enrolment",
    shareText: (t) => `My new course "${t}" is live — take a look`,
  },
  community: {
    noun: "community",
    label: "Community",
    icon: Users,
    heading: "Community created!",
    cta: "Join now",
    conversion: "member who joins",
    shareText: (t) => `Come join "${t}", my new community`,
  },
  "live-stream": {
    noun: "live stream",
    label: "Live stream",
    icon: Radio,
    heading: "Live stream published!",
    cta: "Register",
    conversion: "registration",
    shareText: (t) => `Join me live: ${t}`,
  },
  "digital-product": {
    noun: "product",
    label: "Digital product",
    icon: Package,
    heading: "Product published!",
    cta: "Buy now",
    conversion: "sale",
    shareText: (t) => `"${t}" is out now — check it out`,
  },
  service: {
    noun: "service",
    label: "Service",
    icon: Handshake,
    heading: "Service published!",
    cta: "Book now",
    conversion: "booking",
    shareText: (t) => `Now taking bookings: ${t}`,
  },
  call: {
    noun: "1:1 call",
    label: "1:1 Call",
    icon: PhoneCall,
    heading: "1:1 call published!",
    cta: "Book a call",
    conversion: "booking",
    shareText: (t) => `Book a 1:1 call with me: ${t}`,
  },
  event: {
    noun: "event",
    label: "Event",
    icon: CalendarDays,
    heading: "Event published!",
    cta: "Get tickets",
    conversion: "ticket sale",
    shareText: (t) => `${t} — get your ticket`,
  },
  job: {
    noun: "job opening",
    label: "Job",
    icon: BriefcaseBusiness,
    heading: "Job published!",
    cta: "Apply now",
    conversion: "applicant",
    shareText: (t) => `We're hiring: ${t}`,
  },
};

function metaFor(item: SellablePublishedItem): KindMeta {
  const known = KINDS[item.kind as SellableKind];
  if (known) return known;
  const noun = item.noun?.trim() || "item";
  const label = item.label?.trim() || noun.charAt(0).toUpperCase() + noun.slice(1);
  return {
    noun,
    label,
    icon: ShoppingBag,
    heading: `${label} published!`,
    cta: "Get it",
    conversion: "sale",
    shareText: (t) => `"${t}" is live — take a look`,
  };
}

/* ─── Helpers for the call sites ────────────────────────────────────────── */

/**
 * "$49", "₹1,299.50 / month", "Free". Prices here are in major units — the
 * way every sellable form saves them.
 */
export function formatSellablePrice(
  amount?: number | null,
  currency?: string | null,
  per?: string | null,
): string {
  if (!amount || amount <= 0) return "Free";
  const code = (currency || "USD").toUpperCase();
  let text: string;
  try {
    text = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    text = `${code} ${amount}`;
  }
  return per ? `${text} / ${per}` : text;
}

/** weekly → "week", the unit a subscription price is quoted per. */
export function subscriptionUnit(period?: string | null): string | null {
  switch (period) {
    case "weekly":
      return "week";
    case "monthly":
      return "month";
    case "quarterly":
      return "quarter";
    case "yearly":
      return "year";
    default:
      return null;
  }
}

/**
 * The garage.app storefront page for a digital item — the same link the
 * right panel's Affiliate view hands out for courses, communities, services
 * and digital products.
 */
export function garageStorefrontUrl(
  type: "course" | "channel" | "service" | "product",
  id: string,
): string {
  return `https://www.garage.app/digital/${type}/${id}`;
}

/* ─── Store: one popup for the whole dashboard ─────────────────────────── */

const usePublishedStore = create<{
  item: SellablePublishedItem | null;
  show: (item: SellablePublishedItem) => void;
  close: () => void;
}>((set) => ({
  item: null,
  show: (item) => set({ item }),
  close: () => set({ item: null }),
}));

/** Open the "published — now share it" popup for a freshly created item. */
export function showSellablePublished(item: SellablePublishedItem) {
  usePublishedStore.getState().show(item);
}

/** Mounted once, in the dashboard layout. */
export function SellablePublishedHost() {
  const item = usePublishedStore((s) => s.item);
  const close = usePublishedStore((s) => s.close);
  return <SellablePublishedModal item={item} onClose={close} />;
}

/* ─── Office name, for the card byline ─────────────────────────────────── */

const orgNames = new Map<string, string>();

async function fetchOrgName(): Promise<string> {
  const orgId = getOrgId();
  if (!orgId) return "";
  const cached = orgNames.get(orgId);
  if (cached) return cached;
  try {
    const res = await api<{ org?: { name?: string } }>(`/org/${orgId}`);
    const name = res?.org?.name?.trim() || "";
    if (name) orgNames.set(orgId, name);
    return name;
  } catch {
    return "";
  }
}

/* ─── Brand glyphs (Simple Icons paths, white on the black share discs) ── */

function FacebookGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function XGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
}

function LinkedInGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z" />
    </svg>
  );
}

function shareTargets(url: string, text: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  return [
    {
      key: "facebook",
      label: "Share on Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      Glyph: FacebookGlyph,
    },
    {
      key: "x",
      label: "Share on X",
      href: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
      Glyph: XGlyph,
    },
    {
      key: "linkedin",
      label: "Share on LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
      Glyph: LinkedInGlyph,
    },
    {
      key: "whatsapp",
      label: "Share on WhatsApp",
      href: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${text} ${url}`)}`,
      Glyph: WhatsAppIcon,
    },
  ];
}

function toAbsoluteUrl(url: string, origin: string): string {
  try {
    return new URL(url, origin || undefined).toString();
  } catch {
    return url;
  }
}

/** "garage.app/digital/course/x?ref=y" — the link as the eye reads it. */
function displayUrl(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "");
}

const DISC =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#111113] text-white transition hover:bg-[#2a2a2e] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111113]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40";

/* ─── The popup ─────────────────────────────────────────────────────────── */

export default function SellablePublishedModal({
  item,
  onClose,
}: {
  item: SellablePublishedItem | null;
  onClose: () => void;
}) {
  const { brand, brandForeground } = useBrandColors();
  const open = !!item;

  // Keep painting the last item while the close animation runs.
  const [last, setLast] = useState<SellablePublishedItem | null>(item);
  useEffect(() => {
    if (item) setLast(item);
  }, [item]);
  const view = item ?? last;

  const [affiliateId, setAffiliateId] = useState("");
  const [origin, setOrigin] = useState("");
  const [orgName, setOrgName] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  // Resolved per opening: the founder may have switched office since the
  // last one, and the affiliate id is minted on first request.
  useEffect(() => {
    if (!item) return;
    let alive = true;
    setCopied(false);
    setPreparing(true);
    setOrgName("");
    setOrigin(window.location.origin);
    setCanNativeShare(typeof navigator.share === "function");
    void Promise.all([
      fetchMyAffiliateId(),
      fetchOrgShareOrigin(),
      item.byline === undefined ? fetchOrgName() : Promise.resolve(""),
    ])
      .then(([id, shareOrigin, name]) => {
        if (!alive) return;
        setAffiliateId(id);
        setOrigin(shareOrigin);
        setOrgName(name);
      })
      .finally(() => {
        if (alive) setPreparing(false);
      });
    return () => {
      alive = false;
    };
  }, [item]);

  const plainUrl = useMemo(
    () => (view && origin ? toAbsoluteUrl(view.url, origin) : ""),
    [view, origin],
  );
  const shareUrl = affiliateId ? withAffiliateRef(plainUrl, affiliateId) : plainUrl;

  const copy = useCallback(async () => {
    const ok = await copyToClipboard(shareUrl);
    setCopied(ok);
    if (ok) window.setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  if (!view) return null;

  const meta = metaFor(view);
  const Icon = meta.icon;
  const facts = factsOf(view);
  const draft = !!view.draft;
  const heading = view.heading || (draft ? `${meta.label} saved as draft` : meta.heading);
  const shareText = meta.shareText(view.title);
  const card: SellablePublishedItem = {
    ...view,
    byline: view.byline === undefined ? orgName : view.byline,
  };

  const finish = (then?: () => void) => {
    const current = item;
    onClose();
    (then ?? current?.onClose)?.();
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: view.title, text: shareText, url: shareUrl });
    } catch {
      // Dismissing the system sheet rejects — nothing to report.
    }
  };

  const status = preparing
    ? "Preparing your affiliate link…"
    : affiliateId
      ? "Share links are ready, with your affiliate code attached."
      : "Share links are ready.";

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) finish();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-[1200] bg-black/60 backdrop-blur-[2px]" />
        <div className="pointer-events-none fixed inset-0 z-[1200] flex items-center justify-center p-3 sm:p-6">
          <DialogPrimitive.Content
            // The share step is the point of this popup; a stray click on the
            // backdrop should not throw it away. Esc, ✕ and Done still close.
            onInteractOutside={(e) => e.preventDefault()}
            // Focus the dialog itself, not its first button — otherwise Done
            // opens wearing a focus ring before anyone has touched it.
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLElement | null)?.focus();
            }}
            className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 pointer-events-auto relative flex max-h-[94dvh] w-full max-w-[880px] flex-col overflow-y-auto rounded-[20px] bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] duration-200 focus:outline-none md:max-h-[88dvh] md:flex-row md:overflow-hidden"
          >
            {/* Top-right of the popup: over the preview on desktop, over the
                share pane on a phone, where the share pane comes first. */}
            <DialogPrimitive.Close
              aria-label="Close"
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 md:right-5 md:top-5"
            >
              <X className="h-[18px] w-[18px]" />
            </DialogPrimitive.Close>

            {/* ── Left: what was published + share ── */}
            <div className="flex flex-col px-6 py-7 sm:px-8 md:w-[46%] md:min-w-[340px] md:overflow-y-auto md:px-10 md:py-9">
              {/* Centre the content as one block so the tall pane reads as
                  intentional whitespace, not a void (Done stays pinned below). */}
              <div className="flex flex-1 flex-col justify-center">
              <DialogPrimitive.Title className="pr-12 text-[20px] font-bold tracking-[-0.01em] text-[#121214] md:pr-0 md:text-[21px]">
                {heading}
              </DialogPrimitive.Title>

              <div className="mt-4">
                <p className="pl-[68px] text-[12px] text-[#7c7c88]">
                  Your new {meta.noun}
                </p>
                <div className="mt-1 flex items-start gap-3">
                  <div className="h-[34px] w-[56px] shrink-0 overflow-hidden rounded-md bg-[#f1f1f4]">
                    {view.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={view.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span
                        className="flex h-full w-full items-center justify-center"
                        style={{ background: brand, color: brandForeground }}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-2 break-words text-[14px] font-medium leading-[1.4] text-[#121214]">
                      {view.title}
                    </p>
                    {(view.price || facts.length > 0) && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[#7c7c88]">
                        {view.price && (
                          <span className="font-semibold text-[#121214]">{view.price}</span>
                        )}
                        {facts.map((f, i) => (
                          <span key={f} className="flex items-center gap-2">
                            {(view.price || i > 0) && (
                              <span className="text-[#c9c9d2]">·</span>
                            )}
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-7">
                <p className="text-[13px] font-medium text-[#6b6b76]">Next</p>
                {draft ? (
                  <>
                    <h3 className="mt-0.5 text-[24px] font-bold leading-[1.15] tracking-[-0.02em] text-[#121214] md:text-[26px]">
                      Publish your {meta.noun}
                    </h3>
                    <DialogPrimitive.Description className="mt-3 text-[14px] leading-[1.55] text-[#5d5d68]">
                      It&apos;s saved as a draft, so nobody else can see it yet.
                      Publish it when you&apos;re ready and your share links —
                      with your <span className="font-semibold text-[#121214]">affiliate code</span>{" "}
                      attached — will be waiting here.
                    </DialogPrimitive.Description>
                    {view.note && (
                      <p className="mt-4 text-[12.5px] leading-5 text-[#7c7c88]">{view.note}</p>
                    )}
                  </>
                ) : (
                  <>
                    <h3 className="mt-0.5 text-[24px] font-bold leading-[1.15] tracking-[-0.02em] text-[#121214] md:text-[26px]">
                      Share your {meta.noun}
                    </h3>
                    <DialogPrimitive.Description className="mt-3 text-[14px] leading-[1.55] text-[#5d5d68]">
                      Post it where your audience already is. Your link carries your{" "}
                      <span className="font-semibold text-[#121214]">affiliate code</span>,
                      so every {meta.conversion} it brings in is attributed to you.
                    </DialogPrimitive.Description>

                    <p className="mt-4 text-[12.5px] leading-5 text-[#7c7c88]">{status}</p>
                    {view.note && (
                      <p className="mt-0.5 text-[12.5px] leading-5 text-[#7c7c88]">{view.note}</p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={copy}
                        disabled={preparing || !shareUrl}
                        aria-label={copied ? "Link copied" : "Copy link"}
                        title={copied ? "Copied" : "Copy link"}
                        className={DISC}
                      >
                        {preparing ? (
                          <Loader2 className="h-[18px] w-[18px] animate-spin" />
                        ) : copied ? (
                          <Check className="h-[18px] w-[18px]" />
                        ) : (
                          <Copy className="h-[18px] w-[18px]" />
                        )}
                      </button>
                      {shareTargets(shareUrl, shareText).map(({ key, label, href, Glyph }) =>
                        preparing || !shareUrl ? (
                          <button key={key} type="button" disabled aria-label={label} className={DISC}>
                            <Glyph className="h-[18px] w-[18px]" />
                          </button>
                        ) : (
                          <a
                            key={key}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={label}
                            title={label}
                            className={DISC}
                          >
                            <Glyph className="h-[18px] w-[18px]" />
                          </a>
                        ),
                      )}
                      {canNativeShare && (
                        <button
                          type="button"
                          onClick={nativeShare}
                          disabled={preparing || !shareUrl}
                          aria-label="More ways to share"
                          title="More"
                          className={DISC}
                        >
                          <Share2 className="h-[18px] w-[18px]" />
                        </button>
                      )}
                    </div>

                    {!preparing && shareUrl && (
                      <button
                        type="button"
                        onClick={copy}
                        title="Copy link"
                        className="mt-3 block max-w-full truncate text-left text-[12px] text-[#7c7c88] underline-offset-2 hover:text-[#121214] hover:underline"
                      >
                        {copied ? "Copied to clipboard" : displayUrl(shareUrl)}
                      </button>
                    )}
                  </>
                )}
              </div>

              </div>

              {/* Done sits just under the centred content — no mid-pane void. */}
              <div className="mt-8 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => finish()}
                  className="h-11 rounded-full px-8 text-[14px] font-semibold transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{ background: brand, color: brandForeground }}
                >
                  Done
                </button>
                {view.action ? (
                  <button
                    type="button"
                    onClick={() => finish(view.action!.onClick)}
                    className="inline-flex h-11 items-center rounded-full px-4 text-[13.5px] font-semibold text-[#121214] transition hover:bg-[#f3f3f6]"
                  >
                    {view.action.label}
                  </button>
                ) : (
                  !draft &&
                  plainUrl && (
                    <a
                      href={plainUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold text-[#121214] transition hover:bg-[#f3f3f6]"
                    >
                      View {meta.noun}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )
                )}
              </div>
            </div>

            {/* ── Right: buyer's-eye preview on the office colour ── */}
            <div
              className="relative flex shrink-0 items-center justify-center overflow-hidden px-6 py-8 md:flex-1 md:shrink md:px-10 md:py-10"
              style={{
                background: `linear-gradient(180deg, ${brand} 0%, color-mix(in srgb, ${brand} 52%, #000) 46%, #050506 100%)`,
              }}
            >
              <div className="w-full max-w-[300px]">
                <PreviewCard
                  item={card}
                  meta={meta}
                  brand={brand}
                  brandForeground={brandForeground}
                />
                <p className="mt-4 text-center text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/55">
                  {draft ? "Draft preview" : "Preview · how people see it"}
                </p>
              </div>
            </div>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ─── Preview cards ─────────────────────────────────────────────────────── */

interface CardProps {
  item: SellablePublishedItem;
  meta: KindMeta;
  brand: string;
  brandForeground: string;
}

function PreviewCard(props: CardProps) {
  return props.item.kind === "job" ? <JobCard {...props} /> : <MediaCard {...props} />;
}

function factsOf(item: SellablePublishedItem): string[] {
  const seen = new Set<string>();
  return (item.facts || []).filter((f): f is string => {
    if (typeof f !== "string" || !f.trim() || seen.has(f)) return false;
    seen.add(f);
    return true;
  });
}

function FactChips({ facts }: { facts: string[] }) {
  if (facts.length === 0) return null;
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {facts.map((f) => (
        <span
          key={f}
          className="max-w-full truncate rounded-full bg-[#f3f3f6] px-2 py-0.5 text-[11px] font-medium text-[#55555f]"
        >
          {f}
        </span>
      ))}
    </div>
  );
}

/** Course, community, live stream, product, service, call, event: cover art first. */
function MediaCard({ item, meta, brand, brandForeground }: CardProps) {
  const Icon = meta.icon;
  const facts = factsOf(item);
  const dot = item.kind === "live-stream";
  return (
    <div className="overflow-hidden rounded-2xl bg-white text-left shadow-[0_24px_60px_-12px_rgba(0,0,0,0.55)]">
      <div
        className={`relative w-full ${item.kind === "digital-product" ? "aspect-[16/10]" : "aspect-[16/9]"}`}
        style={item.image ? undefined : { background: brand }}
      >
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center" style={{ color: brandForeground }}>
            <Icon className="h-10 w-10 opacity-80" strokeWidth={1.5} />
          </span>
        )}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
          {dot ? (
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff4d4f]" />
          ) : (
            <Icon className="h-3 w-3" />
          )}
          {item.badge || meta.label}
        </span>
        {item.draft && (
          <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-[#121214]">
            Draft
          </span>
        )}
      </div>
      <div className="p-4">
        {item.byline && (
          <p className="truncate text-[11.5px] font-medium text-[#7c7c88]">{item.byline}</p>
        )}
        <p className="mt-0.5 line-clamp-2 break-words text-[15px] font-semibold leading-snug text-[#121214]">
          {item.title}
        </p>
        <FactChips facts={facts} />
        <div className={`mt-3.5 flex items-center gap-3 ${item.price ? "justify-between" : "justify-end"}`}>
          {item.price && (
            <span className="min-w-0 truncate text-[16px] font-bold text-[#121214]">{item.price}</span>
          )}
          <span
            className="shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold"
            style={{ background: brand, color: brandForeground }}
          >
            {item.cta || meta.cta}
          </span>
        </div>
      </div>
    </div>
  );
}

/** A job reads like a job board card: who is hiring, the role, the terms. */
function JobCard({ item, meta, brand, brandForeground }: CardProps) {
  const facts = factsOf(item);
  const initial = (item.byline || item.title).trim().charAt(0).toUpperCase();
  return (
    <div className="rounded-2xl bg-white p-4 text-left shadow-[0_24px_60px_-12px_rgba(0,0,0,0.55)]">
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl text-[17px] font-bold"
          style={item.image ? undefined : { background: brand, color: brandForeground }}
        >
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image} alt="" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </div>
        <div className="min-w-0">
          {item.byline && (
            <p className="truncate text-[11.5px] font-medium text-[#7c7c88]">{item.byline}</p>
          )}
          <p className="line-clamp-2 break-words text-[15.5px] font-semibold leading-snug text-[#121214]">
            {item.title}
          </p>
        </div>
      </div>
      <FactChips facts={facts} />
      {item.price && (
        <p className="mt-3 text-[14px] font-bold text-[#121214]">{item.price}</p>
      )}
      <span
        className="mt-4 flex h-10 items-center justify-center rounded-xl text-[13.5px] font-semibold"
        style={{ background: brand, color: brandForeground }}
      >
        {item.cta || meta.cta}
      </span>
    </div>
  );
}
