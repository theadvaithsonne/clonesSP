"use client";

// In-house crypto payment panel. Rendered inline by CheckoutPaymentStep
// when the customer picks Pay-with-crypto and the BE returns a
// CryptoPaymentRequest.
//
// Shows: chain+coin badge, big QR code, receiving address (copy),
// exact amount to send (copy), live 15-min countdown, wrong-network
// warning, "you can close this" reassurance, and — once the address
// TTL expires — an "Address expired" state with a Get New Address
// button that re-mints via the parent's `onRegenerate` callback.
// Idempotency on the BE re-uses a still-fresh row and mints a fresh
// address only after the previous one has actually expired.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  Clock,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface CryptoPaymentPanelProps {
  address: string;
  amount: string; // Display form, e.g. "1.000423"
  coin: string; // "USDT" | "USDC" | "ETH" | "BTC" | "POL"
  chain: string; // "tron" | "polygon" | "bsc" | "ethereum" | "bitcoin"
  chainName: string; // "TRON" | "Polygon" | ...
  expiresAt: string | Date;
  /**
   * Called when the user clicks "Get New Address" after the current
   * QR expires. Parent hits `POST /invoices/:id/select-payment` with
   * the SAME chain/coin — BE mints a fresh row and returns a new
   * address + amount + expiresAt. If omitted, the expired state
   * shows without a Get-New button (parent handles the reset).
   */
  onRegenerate?: () => Promise<void> | void;
}

// Free QR-code image API. Returns a PNG image at the given URL.
// Zero install. If we ever want to remove the third-party dep,
// swap in `qrcode.react` (~3KB).
function qrImageUrl(payload: string, size = 220): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    payload,
  )}&margin=8`;
}

function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return "0:00";
  const totalSec = Math.floor(msRemaining / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function CryptoPaymentPanel({
  address,
  amount,
  coin,
  chain,
  chainName,
  expiresAt,
  onRegenerate,
}: CryptoPaymentPanelProps) {
  void chain; // reserved for future per-chain UI decisions (icons etc.)

  const expiresAtMs = useMemo(() => {
    const d = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
    return d instanceof Date && !Number.isNaN(d.getTime())
      ? d.getTime()
      : Date.now() + 15 * 60 * 1000;
  }, [expiresAt]);

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  const msRemaining = Math.max(0, expiresAtMs - nowMs);
  const isExpired = msRemaining <= 0;
  const isNearExpiry = !isExpired && msRemaining <= 60_000;

  const [copiedField, setCopiedField] = useState<"address" | "amount" | null>(
    null,
  );
  const copy = async (text: string, field: "address" | "amount") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success(`${field === "address" ? "Address" : "Amount"} copied`);
      setTimeout(() => setCopiedField(null), 1600);
    } catch {
      toast.error("Couldn't copy — please select and copy manually");
    }
  };

  const [regenerating, setRegenerating] = useState(false);
  const handleRegenerate = useCallback(async () => {
    if (!onRegenerate) return;
    setRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setRegenerating(false);
    }
  }, [onRegenerate]);

  // The QR encodes just the raw address. Some wallets (TronLink, some
  // MetaMask forks) parse `tron:<addr>?amount=` and `<addr>@<chainId>`
  // URIs but support is uneven — a bare address always scans correctly,
  // and the customer copies the amount separately from the big amount
  // field below. Safer than guessing at wallet compatibility.
  const qrUrl = qrImageUrl(address);

  // ── Expired state ────────────────────────────────────────────────
  if (isExpired) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider">
            {coin} · {chainName}
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/30 text-red-400">
            <Clock className="w-3 h-3" />
            Address expired
          </div>
        </div>

        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.03] p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm text-white leading-snug">
              This deposit address expired without receiving payment.
              <div className="text-[11px] text-[#9fa0b8] mt-1 leading-relaxed">
                If you already sent funds, they will still be credited
                automatically once they land — nothing else to do. If
                you haven&apos;t sent yet, get a fresh address below
                (for {coin} on {chainName} — same network).
              </div>
            </div>
          </div>

          {onRegenerate && (
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={regenerating}
              className={cn(
                "w-full inline-flex items-center justify-center gap-2 h-11 rounded-lg text-sm font-semibold transition-all",
                regenerating
                  ? "bg-[#1a1a22] text-[#9fa0b8] cursor-wait"
                  : "bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground",
              )}
            >
              {regenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Getting new address…
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Get new address
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Active state ─────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header row: chain + coin + live countdown */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider">
            {coin} · {chainName}
          </div>
        </div>
        <div
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border tabular-nums",
            isNearExpiry
              ? "bg-red-500/10 border-red-500/30 text-red-300"
              : "bg-white/[0.04] border-white/[0.08] text-[#c7c7da]",
          )}
        >
          <Clock className="w-3 h-3" />
          Expires in {formatCountdown(msRemaining)}
        </div>
      </div>

      {/* Wrong-network warning — the single most common way customers
          lose funds on crypto checkouts */}
      <div className="rounded-xl border border-red-500/30 bg-red-500/[0.05] p-3 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        <div className="text-[11px] text-[#c7c7da] leading-relaxed">
          <span className="text-red-400 font-semibold">
            {chainName} network only.
          </span>{" "}
          Sending {coin} on any other network (Ethereum, BSC, etc.) will
          result in permanent loss. Double-check the network in your wallet
          before hitting send.
        </div>
      </div>

      {/* QR code — huge for mobile-phone scans */}
      <div className="flex justify-center">
        <div className="p-3 bg-white rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrUrl}
            alt={`${coin} deposit address QR code`}
            width={220}
            height={220}
            className="block"
          />
        </div>
      </div>

      {/* Address — copy-friendly */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold text-[#9fa0b8] uppercase tracking-wider">
          Send to this address
        </div>
        <button
          type="button"
          onClick={() => copy(address, "address")}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#15151b] border border-white/[0.08] hover:border-white/[0.16] transition-colors text-left group"
        >
          <div className="flex-1 min-w-0">
            <div className="text-xs text-white font-mono break-all">
              {address}
            </div>
          </div>
          <div className="shrink-0 text-[#9fa0b8] group-hover:text-white transition-colors">
            {copiedField === "address" ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </div>
        </button>
      </div>

      {/* Amount — huge and emphasized. Exact amount is load-bearing:
          the poller matches by exact atomic units, no fuzzy tolerance. */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold text-[#9fa0b8] uppercase tracking-wider">
          Send EXACTLY this amount
        </div>
        <button
          type="button"
          onClick={() => copy(amount, "amount")}
          className="w-full flex items-center gap-2 px-4 py-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/[0.05] border border-amber-500/30 hover:border-amber-500/60 transition-colors text-left group"
        >
          <div className="flex-1 min-w-0">
            <div className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums break-all">
              {amount}{" "}
              <span className="text-lg text-amber-400 font-semibold">
                {coin}
              </span>
            </div>
            <div className="text-[10px] text-[#9fa0b8] mt-1 uppercase tracking-wider">
              Not $ — send the full precision including decimals
            </div>
          </div>
          <div className="shrink-0 text-[#9fa0b8] group-hover:text-white transition-colors">
            {copiedField === "amount" ? (
              <Check className="w-5 h-5 text-emerald-400" />
            ) : (
              <Copy className="w-5 h-5" />
            )}
          </div>
        </button>
      </div>

      {/* Status: checking for payment + "you can leave" reassurance.
          The BE watchers detect the incoming tx and flip the invoice
          to paid regardless of whether this tab stays open. */}
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-2 py-2 text-xs text-[#9fa0b8]">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
          Waiting for your payment… (auto-detects within 30 seconds of
          arrival)
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] px-3 py-2 text-[11px] text-[#c7c7da] leading-snug text-center">
          <span className="text-emerald-300 font-medium">
            You can close this page if you&apos;ve already paid.
          </span>{" "}
          The invoice updates automatically the moment your transaction
          confirms — no need to keep this tab open.
        </div>
      </div>
    </div>
  );
}
