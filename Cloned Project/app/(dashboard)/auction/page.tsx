"use client";

import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Gavel } from "lucide-react";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { getSocket, connectSocket } from "@/lib/socket";
import { getAuctions, type IAuction } from "@/lib/auction-api";
import StartAuctionDialog from "./components/StartAuctionDialog";
import OngoingAuctions from "./components/OngoingAuctions";

export default function AuctionPage() {
  const { userData, loading } = useAmIFounder();
  const [auctions, setAuctions] = useState<IAuction[]>([]);
  const [fetchingAuctions, setFetchingAuctions] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<IAuction | null>(null);
  const [activeTab, setActiveTab] = useState("start");

  const handleAuctionSuccess = useCallback((auction: IAuction) => {
    setAuctions((prev) => {
      const idx = prev.findIndex((a) => a._id === auction._id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = auction;
        return next;
      }
      return [auction, ...prev];
    });
    setActiveTab("ongoing");
  }, []);

  const handleAuctionRemove = useCallback((id: string) => {
    setAuctions((prev) => prev.filter((a) => a._id !== id));
  }, []);

  // Socket subscription + initial fetch
  useEffect(() => {
    const socket = connectSocket();

    // Subscribe first to avoid missing events during fetch
    socket.emit("auction:subscribe");

    socket.on("auction:new", (a: IAuction) => {
      setAuctions((prev) => {
        if (prev.find((x) => x._id === a._id)) return prev;
        return [a, ...prev];
      });
    });
    socket.on("auction:update", (a: IAuction) => {
      setAuctions((prev) => prev.map((x) => (x._id === a._id ? a : x)));
    });
    socket.on("auction:end", (a: IAuction) => {
      setAuctions((prev) => prev.filter((x) => x._id !== a._id));
    });

    // Fetch after subscribing
    getAuctions()
      .then(setAuctions)
      .catch(() => setAuctions([]))
      .finally(() => setFetchingAuctions(false));

    return () => {
      socket.emit("auction:unsubscribe");
      socket.off("auction:new");
      socket.off("auction:update");
      socket.off("auction:end");
    };
  }, []);

  const displayName = userData.name || userData.email || "User";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center gap-3">
        <Avatar className="h-9 w-9">
          {userData.profilePicture && <AvatarImage src={userData.profilePicture} alt={displayName} />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm leading-tight truncate">
            {loading ? "Loading…" : displayName}
          </p>
          {userData.orgName && (
            <p className="text-xs text-muted-foreground truncate">{userData.orgName}</p>
          )}
        </div>
        <Gavel className="h-5 w-5 text-muted-foreground" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 pt-4 pb-2">
          <TabsList className="bg-[#111116] border border-[#333] p-1">
            <TabsTrigger
              value="start"
              className="data-[state=active]:bg-brand data-[state=active]:text-brand-foreground data-[state=active]:shadow-sm text-gray-400 px-5 py-2 text-sm font-medium transition-all rounded-md"
            >
              Auction
            </TabsTrigger>
            <TabsTrigger
              value="ongoing"
              className="data-[state=active]:bg-brand data-[state=active]:text-brand-foreground data-[state=active]:shadow-sm text-gray-400 px-5 py-2 text-sm font-medium transition-all rounded-md"
            >
              Ongoing Auction
              {auctions.length > 0 && (
                <span className="ml-1.5 text-xs opacity-60">({auctions.length})</span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="start" className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
          <div className="flex flex-col items-center gap-4 text-center max-w-xs">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[#1e1e2d] border border-white/[0.08]">
              <Gavel className="h-7 w-7 text-[#9fa0b8]" />
            </div>
            <div className="space-y-1">
              <p className="text-[#eaeaea] text-sm font-medium">Start a Global Auction</p>
              <p className="text-[#7a7a8a] text-xs leading-relaxed">
                List any product from your Garage store or from outside — visible to everyone.
              </p>
            </div>
            <button
              onClick={() => { setEditTarget(null); setDialogOpen(true); }}
              disabled={loading || !userData.userId}
              className="mt-1 px-5 py-2 rounded-md bg-brand text-brand-foreground text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + Start Auction
            </button>
          </div>
        </TabsContent>

        <TabsContent value="ongoing" className="flex-1 overflow-y-auto px-6 pb-6">
          {fetchingAuctions ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">Loading auctions…</p>
            </div>
          ) : (
            <OngoingAuctions
              auctions={auctions}
              currentUserId={userData.userId}
              onEdit={(auction) => { setEditTarget(auction); setDialogOpen(true); }}
              onAuctionUpdate={handleAuctionSuccess}
              onAuctionRemove={handleAuctionRemove}
            />
          )}
        </TabsContent>
      </Tabs>

      <StartAuctionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={handleAuctionSuccess}
        editAuction={editTarget}
        creatorName={userData.name || userData.email || ""}
        creatorAvatar={userData.profilePicture || undefined}
      />
    </div>
  );
}
