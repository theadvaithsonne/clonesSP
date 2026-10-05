"use client";

import { Gavel, ChevronLeft, ChevronRight } from "lucide-react";
import { cancelAuction, type IAuction } from "@/lib/auction-api";
import { useState } from "react";

const PAGE_SIZE = 8;

interface Props {
  auctions: IAuction[];
  currentUserId: string | null;
  onEdit: (auction: IAuction) => void;
  onAuctionUpdate: (auction: IAuction) => void;
  onAuctionRemove: (auctionId: string) => void;
}

function timeLeft(endTime: string): string {
  const diff = new Date(endTime).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

function AuctionCard({
  auction,
  isOwner,
  onEdit,
  onCancel,
}: {
  auction: IAuction;
  isOwner: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const ended = new Date(auction.endTime).getTime() < Date.now();

  async function handleCancel() {
    setCancelling(true);
    try {
      await onCancel();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="group flex flex-col rounded-xl border border-white/[0.08] bg-gradient-to-b from-[#1e1e2d] to-[#14141a] hover:border-white/[0.16] hover:shadow-lg hover:shadow-black/30 transition-all duration-200 overflow-hidden">
      {/* top accent line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-amber-500/50 to-transparent flex-shrink-0" />

      {/* product image */}
      <div className="relative w-full aspect-[4/3] bg-[#0e0e12] flex-shrink-0 overflow-hidden">
        {auction.productImages[0] ? (
          <img
            src={auction.productImages[0]}
            alt={auction.productName}
            className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Gavel className="h-10 w-10 text-[#2a2a3a]" />
          </div>
        )}
        {/* timer badge overlaid on image */}
        <div className="absolute top-2 right-2">
          {ended ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/70 text-[#7a7a8a] border border-white/10 backdrop-blur-sm">
              Ended
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/70 text-amber-400 border border-amber-500/30 backdrop-blur-sm">
              {timeLeft(auction.endTime)}
            </span>
          )}
        </div>
      </div>

      {/* card body */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        <p className="font-semibold text-[#eaeaea] text-sm leading-tight line-clamp-1">
          {auction.productName}
        </p>
        <p className="text-[11px] text-[#7a7a8a] leading-tight line-clamp-1">
          {auction.creatorOrgName} · {auction.creatorName}
        </p>

        {/* min bid */}
        <div className="flex items-center gap-1.5 mt-auto pt-1">
          <span className="text-[10px] text-[#9fa0b8] uppercase tracking-wide">Min Bid</span>
          <span className="text-sm font-bold text-brand">
            {auction.currency} {auction.minPrice.toLocaleString()}
          </span>
        </div>

        {/* owner controls */}
        {isOwner && (
          <div className="flex gap-1.5 pt-1 border-t border-white/[0.06] mt-1">
            <button
              onClick={onEdit}
              disabled={ended}
              className="flex-1 text-[11px] py-1.5 rounded-md border border-white/10 text-[#c7c7da] hover:bg-white/[0.06] hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Edit
            </button>
            <button
              onClick={handleCancel}
              disabled={cancelling || ended}
              className="flex-1 text-[11px] py-1.5 rounded-md border border-red-500/20 text-red-400 bg-red-500/5 hover:bg-red-500/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {cancelling ? "…" : "Cancel"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OngoingAuctions({ auctions, currentUserId, onEdit, onAuctionUpdate, onAuctionRemove }: Props) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(auctions.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = auctions.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  async function handleCancel(auction: IAuction) {
    try {
      const updated = await cancelAuction(auction._id);
      onAuctionRemove(updated._id);
      // if removing last item on last page, go back one page
      const newTotal = auctions.length - 1;
      const newTotalPages = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
      if (safePage > newTotalPages) setPage(newTotalPages);
    } catch (e: any) {
      console.error("[Auction] cancel failed:", e?.message);
    }
  }

  if (auctions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <div className="w-14 h-14 rounded-full bg-[#1e1e2d] border border-white/[0.08] flex items-center justify-center">
          <Gavel className="h-6 w-6 text-[#3a3a4a]" />
        </div>
        <p className="text-[#7a7a8a] text-sm">No ongoing auctions right now.</p>
        <p className="text-[#4a4a5a] text-xs">Switch to the Auction tab to start one.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-4">
      {/* count + page info */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#7a7a8a]">
          {auctions.length} auction{auctions.length !== 1 ? "s" : ""}
        </p>
        {totalPages > 1 && (
          <p className="text-xs text-[#7a7a8a]">
            Page {safePage} of {totalPages}
          </p>
        )}
      </div>

      {/* grid — max 4 per row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {pageItems.map((auction) => (
          <AuctionCard
            key={auction._id}
            auction={auction}
            isOwner={!!currentUserId && auction.createdBy === currentUserId}
            onEdit={() => onEdit(auction)}
            onCancel={() => handleCancel(auction)}
          />
        ))}
      </div>

      {/* pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2 pb-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-white/10 text-[#9fa0b8] text-xs hover:bg-white/[0.06] hover:border-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${
                  p === safePage
                    ? "bg-brand text-brand-foreground"
                    : "text-[#9fa0b8] border border-white/10 hover:bg-white/[0.06] hover:border-white/20"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-white/10 text-[#9fa0b8] text-xs hover:bg-white/[0.06] hover:border-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
