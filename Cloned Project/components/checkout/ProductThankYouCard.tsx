"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, ArrowUpRight, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ThankYouPage } from "@/lib/feed-api";
import type { FromOrganization } from "./InvoiceDocument";

/**
 * Rendered on the invoice-success moment for ANY invoice whose line item
 * (currently product or course) has a founder-configured `thankYouPage`.
 * Two modes:
 *
 *  - `autoRedirect: true`  → fires `window.open` once (guarded via `useRef`)
 *    and shows a small "opening your next step…" card with a manual
 *    fallback link in case the popup blocker ate the new tab.
 *
 *  - `autoRedirect: false` → renders the HQ header from `fromOrganization`
 *    (mirrors `InvoiceDocument`'s org-icon + name block), the founder's
 *    title + message, and up to 5 hyperlink-button sections rendered with
 *    alternating dark / yellow-tinted styles for a cleaner landing.
 *
 * Guarded to fire ONLY on the invoice-success step in InvoicePayPage —
 * refreshing an already-paid invoice does NOT re-fire this card.
 *
 * Component name kept as-is for git-history preservation; a
 * `PostPurchaseThankYouCard` re-export at the bottom lets new code use the
 * item-agnostic name.
 */
export default function ProductThankYouCard({
  page,
  fromOrganization,
  invoiceNumber,
  onGoToWorkspace,
}: {
  page: ThankYouPage;
  fromOrganization: FromOrganization | null;
  invoiceNumber: string;
  onGoToWorkspace?: () => void;
}) {
  const openedRef = useRef(false);

  // Auto-redirect: open in a new tab exactly once. `useRef` guard ensures
  // we don't fire again on re-render (React StrictMode double-invokes
  // effects in dev; also protects against the parent re-mounting the card
  // for any reason).
  useEffect(() => {
    if (!page.autoRedirect || !page.redirectUrl || openedRef.current) return;
    openedRef.current = true;
    try {
      const win = window.open(page.redirectUrl, "_blank", "noopener,noreferrer");
      if (!win) {
        // Popup blocker: leave the manual fallback link visible below.
        console.warn(
          "[ProductThankYouCard] Popup blocked; buyer must click the fallback link.",
        );
      }
    } catch (err) {
      console.warn("[ProductThankYouCard] window.open failed:", err);
    }
  }, [page.autoRedirect, page.redirectUrl]);

  // Same palette + primitives used across InvoiceDocument / InvoicePayPage.
  const cardBase =
    "mt-5 bg-[#0e0e12] border border-[#2a2a35] rounded-2xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-500";

  if (page.autoRedirect) {
    // Even with auto-redirect ON, the founder's title + message are shown
    // briefly (the new tab may take a moment; the founder-authored copy is
    // still what the buyer reads on THIS tab). Fall back to the same
    // defaults as the manual-sections mode when the founder didn't set
    // them, so this never renders "empty".
    const title = page.title?.trim() || "Payment complete — opening your next step…";
    const message =
      page.message?.trim() ||
      "A new tab should have opened. If it didn't, click the button below.";
    return (
      <div className={cn(cardBase, "text-center")}>
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2 leading-tight">
          {title}
        </h2>
        <p className="text-sm text-[#c7c7da] mb-5 max-w-md mx-auto leading-relaxed">
          {message}
        </p>
        {page.redirectUrl && (
          <a
            href={page.redirectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground font-semibold px-5 h-10 rounded-lg text-sm transition-colors"
          >
            Continue
            <ArrowUpRight className="w-4 h-4" />
          </a>
        )}
        <div className="mt-6 pt-4 border-t border-[#2a2a35] text-[11px] text-[#6b6b80]">
          Invoice {invoiceNumber} has been paid — keep this tab open as your
          receipt.
        </div>
      </div>
    );
  }

  const orgIcon = fromOrganization?.icon || null;
  const orgName = fromOrganization?.name || "Seller";
  const orgSlug = (fromOrganization as any)?.slug || null;

  const title = page.title?.trim() || "Thank you for your purchase!";
  const message =
    page.message?.trim() || "Please check your mail for next steps.";
  const sections = (page.sections || []).filter(
    (s) => s.heading && s.buttonLabel && s.buttonUrl,
  );

  return (
    <div className={cardBase}>
      {/* HQ header — mirrors InvoiceDocument.tsx org-icon + name block */}
      <div className="flex items-center gap-3 pb-5 border-b border-[#2a2a35] mb-6">
        {orgIcon ? (
          <img
            src={orgIcon}
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
            {orgName}
          </div>
          {orgSlug && (
            <div className="text-[10px] uppercase tracking-wider text-[#6b6b80]">
              @{orgSlug}
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

      {/* Title + message */}
      <div className="text-center mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">
          {title}
        </h2>
        <p className="text-sm text-[#c7c7da] mt-2 max-w-md mx-auto leading-relaxed">
          {message}
        </p>
      </div>

      {/* Next-step sections — alternating dark / yellow-tinted cards */}
      {sections.length > 0 && (
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
                <a
                  href={s.buttonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex items-center gap-1.5 font-semibold h-10 px-4 rounded-lg text-sm transition-colors whitespace-nowrap self-stretch sm:self-auto justify-center",
                    isEven
                      ? "bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground"
                      : "bg-white text-brand-foreground hover:bg-gray-100",
                  )}
                >
                  {s.buttonLabel}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            );
          })}
        </div>
      )}

      {/* Small tertiary link so buyers still have a path back to workspace */}
      {onGoToWorkspace && (
        <div className="mt-6 pt-5 border-t border-[#2a2a35] text-center">
          <button
            type="button"
            onClick={onGoToWorkspace}
            className="text-xs text-[#6b6b80] hover:text-[#c7c7da] transition-colors"
          >
            You can now log in to your workspace to view this order and manage
            all your purchases →
          </button>
        </div>
      )}

      <div className="mt-4 text-center text-[10px] text-[#6b6b80]">
        Invoice {invoiceNumber} • Keep this page as your receipt
      </div>
    </div>
  );
}

// Item-agnostic alias for new call sites (course + future sellables).
export { default as PostPurchaseThankYouCard } from "./ProductThankYouCard";
/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
// (Above re-export lets new code do
//   `import { PostPurchaseThankYouCard } from "@/components/checkout/ProductThankYouCard"`
// without renaming the file, so git history on this large component is
// preserved.)
