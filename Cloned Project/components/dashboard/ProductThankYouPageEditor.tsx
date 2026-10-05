"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  X,
  Plus,
  Trash2,
  Info,
  Sparkles,
  Loader2,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  FileText,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import {
  updateProduct,
  updateCourse,
  updateChannel,
  type Product,
  type Course,
  type Channel,
  type ThankYouPage,
  type ThankYouPageSection,
} from "@/lib/feed-api";

// Union of item shapes this editor accepts. Product exposes `name`,
// Course + Channel expose `title` — the editor normalises via
// `displayName`. Channel updates need an orgId (unlike product/course),
// which is why the item shape carries `storeId?` (channel's owning org).
export type ThankYouEditorItem = Product | Course | Channel;
export type ThankYouEditorItemType = "product" | "course" | "channel";

function getDisplayName(item: ThankYouEditorItem): string {
  return (item as any).name ?? (item as any).title ?? "this item";
}

// Channel updates need the owning org id (URL-scoped). The `Channel`
// interface stores it as `storeId`; callers that construct an editor
// item from a channel card sometimes pass `organizationId` instead —
// accept either without forcing the caller to normalise the shape.
function getChannelOrgId(item: ThankYouEditorItem): string | undefined {
  const anyItem = item as any;
  return anyItem.storeId ?? anyItem.organizationId ?? undefined;
}

interface PreviewOrg {
  name: string;
  slug?: string;
  icon?: string;
}

const MAX_SECTIONS = 5;

/**
 * Full-height right-side editor for the buyer's post-payment Thank You Page.
 *
 * Two-pane layout: **form on the left, live preview on the right** — the
 * preview mirrors exactly what buyers see on the invoice-success step
 * (`ProductThankYouCard`). Wide drawer (up to `max-w-6xl`) so preview stays
 * legible next to the form.
 *
 * Header (Title + Message) is editable in BOTH modes because even with
 * auto-redirect ON the buyer briefly sees the founder's header before the
 * new tab opens — so this text is never wasted work.
 *
 * - `autoRedirect: OFF` → header + up to 5 alternating-styled sections.
 * - `autoRedirect: ON`  → header + a single redirect URL; buyer's tab
 *   opens the URL in a new tab on the invoice success moment.
 *
 * Save round-trips to `PUT /product/:productId` with `{ thankYouPage }`.
 */
export default function ProductThankYouPageEditor({
  item,
  itemType = "product",
  open,
  onClose,
  onSaved,
}: {
  // Accepts either a Product or a Course. `itemType` gates which
  // update endpoint the save button calls. Component name kept for git
  // history — new call sites can import as `ThankYouPageEditor` via the
  // re-export at the bottom of this file.
  item: ThankYouEditorItem | null;
  itemType?: ThankYouEditorItemType;
  open: boolean;
  onClose: () => void;
  onSaved?: (updated: ThankYouEditorItem) => void;
}) {
  const [autoRedirect, setAutoRedirect] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sections, setSections] = useState<ThankYouPageSection[]>([]);
  const [saving, setSaving] = useState(false);
  // Preview mirrors what buyers see — needs the founder's actual HQ
  // details, not a placeholder. Falls back to the localStorage-cached
  // name/slug/icon while /org/:id resolves.
  const [previewOrg, setPreviewOrg] = useState<PreviewOrg>({
    name: "Your organization",
    slug: undefined,
    icon: undefined,
  });

  useEffect(() => {
    if (!open || !item) return;
    const tp: ThankYouPage | undefined = item.thankYouPage;
    setAutoRedirect(!!tp?.autoRedirect);
    setRedirectUrl(tp?.redirectUrl || "");
    setTitle(tp?.title || "");
    setMessage(tp?.message || "");
    setSections(tp?.sections?.map((s) => ({ ...s })) || []);
  }, [open, item?._id]);

  // Load the founder's real org so the preview isn't a placeholder.
  // Seed from localStorage immediately (avoids a "Your organization"
  // flash) then live-fetch the canonical values via `/org/:id`.
  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;
    const cachedSlug = localStorage.getItem("garage_org_slug") || undefined;
    const cachedName = localStorage.getItem("garage_org_name") || undefined;
    const cachedIcon = localStorage.getItem("garage_org_icon") || undefined;
    if (cachedName || cachedSlug || cachedIcon) {
      setPreviewOrg((prev) => ({
        name: cachedName || prev.name,
        slug: cachedSlug || prev.slug,
        icon: cachedIcon || prev.icon,
      }));
    }
    const orgId = localStorage.getItem("garage_org_id");
    const token = getToken();
    if (!orgId || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api<{
          org?: { name?: string; slug?: string; icon?: string };
        }>(`/org/${orgId}`, { method: "GET" }, token);
        if (cancelled || !res?.org) return;
        setPreviewOrg({
          name: res.org.name || "Your organization",
          slug: res.org.slug,
          icon: res.org.icon,
        });
        if (res.org.name)
          localStorage.setItem("garage_org_name", res.org.name);
        if (res.org.slug)
          localStorage.setItem("garage_org_slug", res.org.slug);
        if (res.org.icon)
          localStorage.setItem("garage_org_icon", res.org.icon);
      } catch {
        // Non-fatal — preview shows cached or placeholder org.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const preview: ThankYouPage = useMemo(
    () => ({
      autoRedirect,
      redirectUrl: redirectUrl.trim() || undefined,
      title: title.trim() || undefined,
      message: message.trim() || undefined,
      sections: sections
        .filter((s) => s.heading.trim() || s.buttonLabel.trim() || s.buttonUrl.trim())
        .map((s) => ({
          heading: s.heading,
          buttonLabel: s.buttonLabel,
          buttonUrl: s.buttonUrl,
        })),
    }),
    [autoRedirect, redirectUrl, title, message, sections],
  );

  if (!open || !item) return null;
  const itemDisplayName = getDisplayName(item);

  const addSection = () => {
    if (sections.length >= MAX_SECTIONS) return;
    setSections((prev) => [
      ...prev,
      { heading: "", buttonLabel: "", buttonUrl: "" },
    ]);
  };

  const updateSection = (
    i: number,
    patch: Partial<ThankYouPageSection>,
  ) => {
    setSections((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  };

  const removeSection = (i: number) => {
    setSections((prev) => prev.filter((_, j) => j !== i));
  };

  const handleSave = async () => {
    try {
      const payload: ThankYouPage = autoRedirect
        ? {
            autoRedirect: true,
            redirectUrl: redirectUrl.trim(),
            // Header is legitimately shown in auto-redirect mode too (buyer
            // sees it before the new tab loads), so persist any founder
            // customisation from the header fields even in this branch.
            title: title.trim() || undefined,
            message: message.trim() || undefined,
          }
        : {
            autoRedirect: false,
            title: title.trim() || undefined,
            message: message.trim() || undefined,
            sections: sections
              .filter((s) => s.heading.trim() || s.buttonLabel.trim() || s.buttonUrl.trim())
              .map((s) => ({
                heading: s.heading.trim(),
                buttonLabel: s.buttonLabel.trim(),
                buttonUrl: s.buttonUrl.trim(),
              })),
          };

      if (autoRedirect && !payload.redirectUrl) {
        toast.error("Enter a redirect URL");
        return;
      }
      if (!autoRedirect && (payload.sections?.length || 0) > 0) {
        for (const s of payload.sections || []) {
          if (!s.heading || !s.buttonLabel || !s.buttonUrl) {
            toast.error("Every section needs a heading, button label, and URL");
            return;
          }
        }
      }

      setSaving(true);
      // Save switches on itemType — updateProduct returns
      // `{ product: Product }`, updateCourse returns a Course directly,
      // updateChannel returns `{ channel: Channel }` and needs the
      // owning org id (channels are org-scoped in the URL).
      let updated: ThankYouEditorItem;
      if (itemType === "course") {
        updated = await updateCourse(item._id, {
          thankYouPage: payload,
        });
      } else if (itemType === "channel") {
        const orgId = getChannelOrgId(item);
        if (!orgId) throw new Error("Channel missing owning organization id");
        const res = await updateChannel(item._id, orgId, {
          thankYouPage: payload,
        });
        updated = res.channel as unknown as Channel;
      } else {
        const res = await updateProduct(item._id, {
          thankYouPage: payload,
        } as any);
        updated = res.product as unknown as Product;
      }
      toast.success("Thank You Page saved");
      onSaved?.(updated);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save Thank You Page");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!item.thankYouPage) {
      onClose();
      return;
    }
    if (
      !confirm(
        "Clear this Thank You Page? Buyers will see the default success screen after this.",
      )
    ) {
      return;
    }
    try {
      setSaving(true);
      let updated: ThankYouEditorItem;
      if (itemType === "course") {
        updated = await updateCourse(item._id, {
          thankYouPage: null,
        });
      } else if (itemType === "channel") {
        const orgId = getChannelOrgId(item);
        if (!orgId) throw new Error("Channel missing owning organization id");
        const res = await updateChannel(item._id, orgId, {
          thankYouPage: null,
        });
        updated = res.channel as unknown as Channel;
      } else {
        const res = await updateProduct(item._id, {
          thankYouPage: null,
        } as any);
        updated = res.product as unknown as Product;
      }
      toast.success("Thank You Page cleared");
      onSaved?.(updated);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to clear");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex"
      role="dialog"
      aria-modal="true"
      aria-label={`Design Thank You Page for ${itemDisplayName}`}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={saving ? undefined : onClose}
      />

      {/* Wide two-pane drawer. Editor on the left, live preview on the right. */}
      <div className="relative ml-auto h-full w-full sm:max-w-6xl bg-[#0b0b0d] border-l border-[#2a2a35] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-start justify-between px-6 py-4 border-b border-[#2a2a35] shrink-0 bg-[#111114]">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-brand">
              <Sparkles className="w-3 h-3" />
              Post-purchase page
            </div>
            <h1 className="text-[17px] font-semibold text-white mt-0.5">
              Design Thank You Page
            </h1>
            <div className="text-xs text-[#9fa0b8] mt-0.5 truncate max-w-[520px]">
              for <span className="text-white">{itemDisplayName}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="w-8 h-8 rounded-lg bg-[#1a1a22] border border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:bg-[#22222c] transition-colors flex items-center justify-center disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Two-pane body */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT: form */}
          <div
            className="w-full lg:w-1/2 border-r border-[#2a2a35] overflow-y-auto px-6 py-5 space-y-5"
            style={{ scrollbarWidth: "none" }}
          >
            {/* Auto-redirect */}
            <div className="rounded-2xl border border-[#2a2a35] bg-[#0e0e12] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">
                    Auto redirect after payment
                  </div>
                  <p className="text-xs text-[#9fa0b8] mt-0.5 leading-relaxed">
                    ON: buyers open your URL in a new tab as soon as payment
                    goes through. Your header (title + message) is still
                    shown on the invoice tab briefly, so keep it useful.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoRedirect}
                  onClick={() => setAutoRedirect((v) => !v)}
                  className={cn(
                    "relative w-11 h-6 rounded-full transition-colors shrink-0 mt-1",
                    autoRedirect
                      ? "bg-brand"
                      : "bg-[#2a2a35] hover:bg-[#3a3a4a]",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all",
                      autoRedirect ? "left-[22px]" : "left-0.5",
                    )}
                  />
                </button>
              </div>
              {autoRedirect && (
                <div className="mt-4 pt-4 border-t border-[#2a2a35]">
                  <label className="block">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#c7c7da] mb-1.5">
                      Redirect URL
                    </div>
                    <input
                      type="url"
                      inputMode="url"
                      value={redirectUrl}
                      onChange={(e) => setRedirectUrl(e.target.value)}
                      placeholder="https://your-course-onboarding.com/welcome"
                      className="w-full bg-[#111114] border border-[#2a2a35] focus:border-brand rounded-lg px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[#4a4a55]"
                    />
                  </label>
                  <div className="flex items-start gap-2 text-[11px] text-[#9fa0b8] leading-snug mt-2">
                    <Info className="w-3.5 h-3.5 text-brand/80 shrink-0 mt-0.5" />
                    <span>
                      Opens in a new tab so the buyer keeps a copy of their
                      receipt on the invoice tab.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Header (title + message) — always visible in both modes */}
            <div className="rounded-2xl border border-[#2a2a35] bg-[#0e0e12] p-5 space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-[#6b6b80]">
                Header — always shown to the buyer
              </div>
              <label className="block">
                <div className="text-[11px] font-medium text-[#9fa0b8] mb-1.5">
                  Title
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 120))}
                  placeholder="Thank you for your purchase!"
                  className="w-full bg-[#111114] border border-[#2a2a35] focus:border-brand rounded-lg px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[#4a4a55]"
                />
              </label>
              <label className="block">
                <div className="text-[11px] font-medium text-[#9fa0b8] mb-1.5">
                  Message
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 400))}
                  placeholder="Please check your mail for next steps"
                  rows={2}
                  className="w-full bg-[#111114] border border-[#2a2a35] focus:border-brand rounded-lg px-3 py-2.5 text-sm text-white outline-none transition-colors resize-none placeholder:text-[#4a4a55]"
                />
              </label>
            </div>

            {/* Sections — only meaningful when auto-redirect is OFF */}
            {!autoRedirect && (
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6b6b80]">
                    Next-step buttons
                  </h3>
                  <span className="text-[10px] text-[#6b6b80]">
                    {sections.length}/{MAX_SECTIONS}
                  </span>
                </div>

                <div className="space-y-2">
                  {sections.map((s, i) => {
                    const isEven = i % 2 === 0;
                    return (
                      <div
                        key={i}
                        className={cn(
                          "rounded-2xl border p-4 space-y-3 transition-colors",
                          isEven
                            ? "border-[#2a2a35] bg-[#0e0e12]"
                            : "border-brand/25 bg-brand/[0.05]",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6b6b80]">
                            Section {i + 1}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeSection(i)}
                            className="w-7 h-7 rounded-lg text-[#6b6b80] hover:text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center"
                            aria-label={`Remove section ${i + 1}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={s.heading}
                          onChange={(e) =>
                            updateSection(i, {
                              heading: e.target.value.slice(0, 60),
                            })
                          }
                          placeholder="Heading (e.g. Start your onboarding)"
                          className="w-full bg-[#111114] border border-[#2a2a35] focus:border-brand rounded-lg px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[#4a4a55]"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={s.buttonLabel}
                            onChange={(e) =>
                              updateSection(i, {
                                buttonLabel: e.target.value.slice(0, 40),
                              })
                            }
                            placeholder="Button label"
                            className="bg-[#111114] border border-[#2a2a35] focus:border-brand rounded-lg px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[#4a4a55]"
                          />
                          <input
                            type="url"
                            inputMode="url"
                            value={s.buttonUrl}
                            onChange={(e) =>
                              updateSection(i, { buttonUrl: e.target.value })
                            }
                            placeholder="https://…"
                            className="bg-[#111114] border border-[#2a2a35] focus:border-brand rounded-lg px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[#4a4a55]"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={addSection}
                  disabled={sections.length >= MAX_SECTIONS}
                  className={cn(
                    "mt-3 w-full rounded-xl border border-dashed py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
                    sections.length >= MAX_SECTIONS
                      ? "border-[#2a2a35] text-[#4a4a55] cursor-not-allowed"
                      : "border-[#3a3a4a] text-[#c7c7da] hover:border-brand/60 hover:text-white hover:bg-brand/5",
                  )}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {sections.length >= MAX_SECTIONS
                    ? "Section limit reached"
                    : "Add section"}
                </button>

                <div className="flex items-start gap-2 text-[11px] text-[#6b6b80] leading-snug px-1 mt-2">
                  <Info className="w-3 h-3 shrink-0 mt-0.5" />
                  <span>
                    Buttons render in alternating styles on the buyer's
                    screen for a cleaner landing. Keep the highest-value
                    next step (e.g. "Start course") at the top.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: live preview */}
          <div
            className="hidden lg:flex lg:w-1/2 flex-col overflow-y-auto bg-[#08080a]"
            style={{ scrollbarWidth: "none" }}
          >
            <div className="px-6 py-3 border-b border-[#2a2a35] flex items-center gap-2 sticky top-0 bg-[#08080a]/95 backdrop-blur">
              <Eye className="w-3.5 h-3.5 text-[#6b6b80]" />
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6b6b80]">
                Live preview — how buyers see it
              </div>
            </div>
            <div className="px-6 py-6">
              <ThankYouPreview
                page={preview}
                productName={itemDisplayName}
                org={previewOrg}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between gap-3 border-t border-[#2a2a35] px-6 py-4 bg-[#0e0e12]">
          <button
            type="button"
            onClick={handleClear}
            disabled={saving}
            className="text-xs text-[#6b6b80] hover:text-red-400 transition-colors disabled:opacity-40"
          >
            Clear page
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="text-sm text-[#c7c7da] hover:text-white transition-colors px-3 h-9 disabled:opacity-50"
            >
              Cancel
            </button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-brand text-brand-foreground font-semibold hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] transition-colors px-5 h-9 rounded-lg text-sm disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  Save
                  <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Live preview — visually mirrors `components/checkout/ProductThankYouCard.tsx`
 * (kept in-file so this editor is self-contained and stays in sync when the
 * founder tweaks fields on the left).
 */
function ThankYouPreview({
  page,
  productName,
  org,
}: {
  page: ThankYouPage;
  productName: string;
  org: PreviewOrg;
}) {
  const title =
    page.title?.trim() ||
    (page.autoRedirect
      ? "Payment complete — opening your next step…"
      : "Thank you for your purchase!");
  const message =
    page.message?.trim() ||
    (page.autoRedirect
      ? "A new tab should have opened. If it didn't, click the button below."
      : "Please check your mail for next steps.");
  const sections = (page.sections || []).filter(
    (s) => s.heading && s.buttonLabel && s.buttonUrl,
  );

  return (
    <div className="rounded-2xl border border-[#2a2a35] bg-[#0e0e12] p-6 sm:p-7">
      {/* HQ header — mirrors the real one on ProductThankYouCard */}
      <div className="flex items-center gap-3 pb-5 border-b border-[#2a2a35] mb-6">
        {org.icon ? (
          <img
            src={org.icon}
            alt=""
            className="w-9 h-9 rounded-lg object-cover border border-[#2a2a35]"
          />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-brand/10 border border-brand/30 flex items-center justify-center">
            <FileText className="w-4 h-4 text-brand" />
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">
            {org.name}
          </div>
          {org.slug && (
            <div className="text-[10px] uppercase tracking-wider text-[#6b6b80]">
              @{org.slug}
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2 text-emerald-400">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            Payment complete
          </span>
        </div>
      </div>

      {page.autoRedirect ? (
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2 leading-tight">
            {title}
          </h2>
          <p className="text-sm text-[#c7c7da] mb-5 max-w-md mx-auto leading-relaxed">
            {message}
          </p>
          <span className="inline-flex items-center gap-2 bg-brand text-brand-foreground font-semibold px-5 h-10 rounded-lg text-sm">
            Continue
            <ArrowUpRight className="w-4 h-4" />
          </span>
          <div className="mt-6 pt-4 border-t border-[#2a2a35] text-[11px] text-[#6b6b80]">
            Invoice INV-XXXX has been paid — keep this tab open as your receipt.
          </div>
        </div>
      ) : (
        <>
          <div className="text-center mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">
              {title}
            </h2>
            <p className="text-sm text-[#c7c7da] mt-2 max-w-md mx-auto leading-relaxed">
              {message}
            </p>
          </div>

          {sections.length > 0 ? (
            <div className="space-y-2.5">
              {sections.map((s, i) => {
                const isEven = i % 2 === 0;
                return (
                  <div
                    key={i}
                    className={cn(
                      "rounded-xl border px-4 py-4 sm:px-5 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3",
                      isEven
                        ? "border-[#2a2a35] bg-[#111114]"
                        : "border-brand/25 bg-brand/[0.06]",
                    )}
                  >
                    <div className="text-sm sm:text-base font-semibold text-white">
                      {s.heading}
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 font-semibold h-10 px-4 rounded-lg text-sm whitespace-nowrap self-stretch sm:self-auto justify-center",
                        isEven
                          ? "bg-brand text-brand-foreground"
                          : "bg-white text-brand-foreground",
                      )}
                    >
                      {s.buttonLabel}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#2a2a35] p-6 text-center text-[11px] text-[#6b6b80]">
              Add sections on the left to preview them here.
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-[#2a2a35] text-center text-xs text-[#6b6b80] leading-relaxed px-4">
            You can now log in to your workspace to view this order and manage
            all your purchases →
          </div>
        </>
      )}
      <div className="mt-4 text-center text-[10px] text-[#6b6b80]">
        Preview • {productName}
      </div>
    </div>
  );
}
