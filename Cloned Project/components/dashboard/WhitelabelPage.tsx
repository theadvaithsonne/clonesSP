"use client";

// Standalone Whitelabel add-on page. Opened from the sidebar's Earn
// dropdown (activePopover === "Whitelabel").
//
// Layout is a single centered pitch card — badge, price, feature list,
// one upgrade button. Card selection deliberately lives one step later,
// in WhitelabelPurchaseDialog, so this screen stays a pitch and not a
// form: the founder decides here, pays there.
//
// Two states, driven by GET /whitelabel-addon/status:
//   1. hasAccess === false → the pitch + "Upgrade for $600/year".
//   2. hasAccess === true → step 1 of the setup wizard (domain), since
//      the next thing a paid founder needs is their own URL, not a
//      receipt. See WhitelabelDomainWizard.
//
// Both the purchase and the domain endpoints are founder-only server-side
// (`requireFounder`), so non-founders get a read-only note instead.

import { useCallback, useEffect, useState } from "react";
import { Check, Globe, Loader2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import {
  fetchWhitelabelPrice,
  fetchWhitelabelStatus,
  type WhitelabelPriceResponse,
  type WhitelabelStatusResponse,
} from "@/lib/whitelabel-addon-api";
import { WhitelabelPurchaseDialog } from "./WhitelabelPurchaseDialog";
import WhitelabelSetupWizard from "./WhitelabelSetupWizard";

interface Props {
  // Supplied by the dashboard layout's getActiveComp(). Backs the close
  // button and the branding/domain shortcuts on the active state.
  // Omitted when rendered as a gate (WhitelabelGate) — there's nothing
  // to close back to there.
  setActivePopover?: (popover: string | null) => void;
  // Fired when a status refresh comes back with access. Lets WhitelabelGate
  // swap in the real page once the invoice is paid.
  onActivated?: () => void;
}

function formatUsd(cents: number, opts?: { cents?: boolean }): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts?.cents ? 2 : 0,
    maximumFractionDigits: opts?.cents ? 2 : 0,
  }).format(cents / 100);
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const FEATURES: Array<[string, string]> = [
  ["Your domain, fully mapped", "SSL issued automatically, no DNS babysitting"],
  ["Your logo, colours and favicon", "Applied across web, app and login"],
  ["Branded transactional email", "Sent from your domain, not ours"],
  ["Zero Garage branding", "No powered-by anywhere your customers look"],
  ["Everything in your current plan", "All modules, seats and limits carry over"],
];

export default function WhitelabelPage({
  setActivePopover,
  onActivated,
}: Props) {
  const { amIFounder, loading: founderLoading } = useAmIFounder();

  const [status, setStatus] = useState<WhitelabelStatusResponse | null>(null);
  const [price, setPrice] = useState<WhitelabelPriceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const s = await fetchWhitelabelStatus();
      setStatus(s);
      if (s.hasAccess) onActivated?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to load whitelabel status");
    }
  }, [onActivated]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [s, p] = await Promise.allSettled([
        fetchWhitelabelStatus(),
        fetchWhitelabelPrice(),
      ]);
      if (cancelled) return;
      if (s.status === "fulfilled") setStatus(s.value);
      else toast.error(s.reason?.message || "Failed to load whitelabel status");
      if (p.status === "fulfilled") setPrice(p.value);
      else toast.error(p.reason?.message || "Failed to load pricing");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasAccess = !!status?.hasAccess;
  const close = () => setActivePopover?.(null);

  const shell = (children: React.ReactNode) => (
    <div className="min-h-full w-full bg-[#0a0a0d] flex items-start justify-center px-4 py-10">
      <div className="relative w-full max-w-[420px] rounded-2xl border border-white/[0.06] bg-[#0e0e12] p-7 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.9)]">
        {setActivePopover && (
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-5 top-5 text-[#5a5a68] hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {children}
      </div>
    </div>
  );

  if (loading || founderLoading) {
    return shell(
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>,
    );
  }

  // ───────────────────────── Active state ─────────────────────────
  // The add-on is paid for, so the page stops selling and starts setting
  // up: step 1 of the wizard is pointing a domain at Garage. Domain writes
  // are founder-only server-side, so non-founders get the read-only note
  // instead of a form that would 403 on submit.
  if (hasAccess) {
    if (!amIFounder) {
      return shell(
        <>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Whitelabel active
          </span>
          <h1 className="mt-4 text-[26px] font-bold leading-tight tracking-tight text-white">
            Garage is already yours
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-[#8b8ba3]">
            {status?.willRenewAt
              ? `Renews automatically on ${formatDate(status.willRenewAt)}.`
              : status?.currentEnd
                ? `Access runs until ${formatDate(status.currentEnd)}.`
                : "Access is enabled for this office."}
          </p>
          <div className="mt-6 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center">
            <ShieldCheck className="mx-auto h-6 w-6 text-zinc-600" />
            <p className="mt-2 text-[13px] font-medium text-white">
              Founders only
            </p>
            <p className="mt-1 text-[11px] text-[#6a6a7a]">
              Ask your office founder to connect the custom domain and set the
              branding.
            </p>
          </div>
        </>,
      );
    }

    return (
      <div className="relative min-h-full">
        {setActivePopover && (
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-5 top-5 z-10 text-[#5a5a68] transition-colors hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <WhitelabelSetupWizard setActivePopover={setActivePopover} />
      </div>
    );
  }

  // ──────────────────────── Purchase state ────────────────────────
  const baseCents = price?.baseUsdCents ?? 0;
  const monthly = baseCents ? formatUsd(baseCents / 12, { cents: false }) : "—";

  return (
    <>
      {shell(
        <>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            Whitelabel
          </span>

          <h1 className="mt-4 text-[26px] font-bold leading-tight tracking-tight text-white">
            Make Garage your own
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-[#8b8ba3]">
            Your brand, your domain, your customers. Garage runs quietly
            underneath.
          </p>

          {/* Price */}
          <div className="mt-6 rounded-xl border border-white/[0.06] bg-black/40 p-5">
            {price ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-[38px] font-bold leading-none tracking-tight text-white tabular-nums">
                    {formatUsd(baseCents)}
                  </span>
                  <span className="text-sm text-[#6a6a7a]">/ year</span>
                </div>
                <p className="mt-2.5 text-[11px] text-[#6a6a7a]">
                  Billed annually · works out to {monthly}/month
                </p>
                <div className="mt-4 border-t border-white/[0.06] pt-4">
                  <div className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 shrink-0 text-brand" />
                    <span className="text-[12px] text-white/90">
                      Custom domain included
                    </span>
                    <span className="rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-[#9fa0b8]">
                      app.yourbrand.com
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-[12px] text-[#8b8ba3]">
                Pricing unavailable right now. Reload the page to try again.
              </p>
            )}
          </div>

          {/* Features */}
          <ul className="mt-5 space-y-3">
            {FEATURES.map(([title, sub]) => (
              <li key={title} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand/15">
                  <Check className="h-2.5 w-2.5 text-brand" strokeWidth={3} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-medium leading-tight text-white">
                    {title}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-tight text-[#6a6a7a]">
                    {sub}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {/* CTA */}
          {amIFounder ? (
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              disabled={!price}
              className="mt-6 h-12 w-full rounded-lg bg-gradient-to-b from-brand to-[color:color-mix(in_srgb,var(--brand)_90%,black)] text-[13.5px] font-semibold text-brand-foreground transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {price
                ? `Upgrade for ${formatUsd(baseCents)}/year`
                : "Pricing unavailable"}
            </button>
          ) : (
            <div className="mt-6 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center">
              <ShieldCheck className="mx-auto h-6 w-6 text-zinc-600" />
              <p className="mt-2 text-[13px] font-medium text-white">
                Founders only
              </p>
              <p className="mt-1 text-[11px] text-[#6a6a7a]">
                Ask your office founder to purchase the whitelabel add-on.
              </p>
            </div>
          )}

          <p className="mt-4 text-center text-[11px] leading-relaxed text-[#5a5a68]">
            {/*
              GST is quoted at checkout, not here: /price decides it from
              the buyer's billing region, and the dialog shows the exact
              line item and total before the card is charged.
            */}
            18% GST added at checkout for Indian buyers. Renews annually —
            cancel anytime before renewal.
          </p>
        </>,
      )}

      {/* Card selection, 3DS and the charge itself. */}
      {dialogOpen && price && (
        <WhitelabelPurchaseDialog
          price={price}
          onClose={() => setDialogOpen(false)}
          onSuccess={() => {
            setDialogOpen(false);
            loadStatus();
          }}
        />
      )}
    </>
  );
}
