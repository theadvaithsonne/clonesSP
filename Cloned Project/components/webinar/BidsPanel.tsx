"use client";

import { Gavel, Trophy } from "lucide-react";
import type { AuctionLot, LotBid } from "@/lib/api/auctionLot";
import { formatMoney } from "@/lib/webinar/currency";

/**
 * The bid ledger, in the sidebar. Same feed the price on the card comes from —
 * useLiveLot refetches both together, off the `nc:bid` data-channel ping and
 * the 3s poll behind it, so this tab moves the moment anyone bids.
 *
 * Read-only. Bidding happens on the auction card over the stream, where the
 * viewer is already looking; a second Bid button here would just be a second
 * place to lose a race from.
 *
 * Bidder names arrive masked for everyone but the seller — that's the
 * backend's call from the JWT, not something this panel decides.
 */
export default function BidsPanel({
  auction,
  bids,
  meId,
}: {
  auction: AuctionLot | null;
  bids: LotBid[];
  meId?: string | null;
}) {
  if (!auction) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <Gavel className="h-6 w-6 text-zinc-600" />
        <p className="text-sm text-zinc-500">No auction running.</p>
        <p className="text-xs text-zinc-600">
          When the host puts an item on the block, every bid lands here.
        </p>
      </div>
    );
  }

  const youLead = Boolean(meId && auction.leaderUserId && auction.leaderUserId === meId);
  const settled = auction.status === "sold";

  return (
    <div className="flex h-full flex-col">
      {/* Standing bid — the one number worth pinning above a scrolling feed. */}
      <div className="shrink-0 border-b border-white/10 px-4 py-3">
        <p className="truncate text-xs text-zinc-500">{auction.name}</p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums text-white">
          {formatMoney(auction.currentBid, auction.currency)}
        </p>
        <p className="mt-0.5 text-[11px] font-semibold text-zinc-500">
          {auction.bidCount > 0
            ? `${auction.bidCount} bid${auction.bidCount === 1 ? "" : "s"}`
            : "no bids yet"}
          {auction.leaderName && (
            <>
              {" · "}
              <span className="text-amber-300">
                {youLead
                  ? settled
                    ? "you won"
                    : "you're winning"
                  : `@${auction.leaderName} ${settled ? "won" : "leading"}`}
              </span>
            </>
          )}
        </p>
      </div>

      {bids.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <Gavel className="h-6 w-6 text-zinc-600" />
          <p className="text-sm text-zinc-500">No bids yet.</p>
          <p className="text-xs text-zinc-600">
            Opening at {formatMoney(auction.startPrice, auction.currency)} — first bid
            takes the lead.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <ul className="divide-y divide-white/5">
            {bids.map((b) => {
              const leading = b.status === "active" || b.status === "won";
              return (
                <li
                  key={b.id}
                  className={`flex items-center gap-3 px-4 py-2.5 ${
                    leading ? "bg-amber-500/5" : ""
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      b.status === "won"
                        ? "bg-amber-500/20 text-amber-300"
                        : leading
                          ? "bg-white/10 text-amber-300"
                          : "bg-white/5 text-zinc-500"
                    }`}
                  >
                    {b.status === "won" ? (
                      <Trophy className="h-3.5 w-3.5" />
                    ) : (
                      <Gavel className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-white">
                      {b.bidderName ? `@${b.bidderName}` : "Anonymous bidder"}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      {timeAgo(b.at)}
                      {b.status === "outbid" && " · outbid"}
                      {b.status === "released" && " · refunded"}
                      {b.status === "cancelled" && " · cancelled"}
                      {b.status === "won" && " · winner"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-bold tabular-nums ${
                      leading ? "text-amber-300" : "text-zinc-500 line-through"
                    }`}
                  >
                    {formatMoney(b.amount, b.currency)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Coarse on purpose — a live lot's feed is seconds old, not days. */
function timeAgo(at: number): string {
  if (!at) return "just now";
  const secs = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
