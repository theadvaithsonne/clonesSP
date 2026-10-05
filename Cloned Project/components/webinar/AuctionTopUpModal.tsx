"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Loader2, Wallet, X } from "lucide-react";
import { topupAuctionWallet } from "@/lib/api/auctionWallet";

const MIN = 1;
const MAX = 10_000;

/**
 * Auction Wallet top-up sheet — opened by the live auction card when a bid
 * comes back 402 INSUFFICIENT_AUCTION_BALANCE. Pre-seeds `shortfallUsd` so the
 * bidder only has to confirm, then hands off to the Garage Invoice hosted
 * checkout in a new tab.
 *
 * Deliberately does NOT auto-retry the bid. The stream keeps running while the
 * buyer pays; by the time the invoice clears the lot may have moved on, and
 * silently placing a bid they last looked at a minute ago is the wrong call.
 * They come back to this tab and tap Bid again against whatever the lot is
 * standing at then.
 */
export default function AuctionTopUpModal({
  shortfallUsd,
  onClose,
}: {
  shortfallUsd: number;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(shortfallUsd.toFixed(2));
  const [submitting, setSubmitting] = useState(false);

  const value = parseFloat(amount);
  const valid = !Number.isNaN(value) && value >= MIN && value <= MAX;
  const coversShortfall = value >= shortfallUsd;

  const submit = async () => {
    if (!valid || !coversShortfall || submitting) return;
    setSubmitting(true);
    try {
      const { payUrl } = await topupAuctionWallet(Math.round(value * 100));
      const origin =
        process.env.NEXT_PUBLIC_APP_URL ||
        (typeof window !== "undefined" ? window.location.origin : "");
      const full = /^https?:\/\//i.test(payUrl) ? payUrl : `${origin}${payUrl}`;
      // New tab, not a redirect — leaving the page would drop the viewer out
      // of the live room mid-auction.
      const opened = window.open(full, "_blank", "noopener,noreferrer");
      if (!opened) window.location.href = full;
      toast.success("Opening secure checkout — the stream keeps playing.");
      onClose();
    } catch (err) {
      toast.error((err as Error)?.message || "Couldn't start the top-up");
      setSubmitting(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Top up your Auction Wallet"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#181818] shadow-[0_24px_80px_rgba(0,0,0,0.9)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-zinc-900">
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <Wallet className="w-4 h-4 text-amber-300" />
            Top up your Auction Wallet
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-white p-1 rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <p className="text-xs text-amber-300/90 mb-3">
            Short by ${shortfallUsd.toFixed(2)} for this bid.
          </p>

          <label
            htmlFor="auction-topup-amount"
            className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5"
          >
            Amount (USD)
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-semibold text-zinc-500">
              $
            </span>
            <input
              id="auction-topup-amount"
              type="number"
              inputMode="decimal"
              value={amount}
              autoFocus
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="0.00"
              className="w-full rounded-xl border border-white/15 bg-black/40 pl-8 pr-3 py-3 text-xl font-semibold tabular-nums text-white outline-none focus:border-amber-400"
            />
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
            You&apos;ll pay this as a Garage Invoice on our secure checkout. Once
            the invoice is paid the funds land in your Auction Wallet — come back
            to this tab and place your bid.
          </p>

          <button
            type="button"
            onClick={submit}
            disabled={!valid || !coversShortfall || submitting}
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-white text-black text-sm font-semibold transition-colors hover:bg-zinc-200 disabled:opacity-40 disabled:hover:bg-white"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting…
              </>
            ) : !valid ? (
              "Enter an amount"
            ) : !coversShortfall ? (
              `Minimum $${shortfallUsd.toFixed(2)}`
            ) : (
              `Top up $${value.toFixed(2)}`
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
