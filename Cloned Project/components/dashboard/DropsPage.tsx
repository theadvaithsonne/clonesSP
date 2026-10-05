"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { api, API_URL } from "@/lib/api";
import { getToken, getUserIdFromToken } from "@/lib/auth";
import { Plus, Heart, Share2, Eye, Copy, Check, Loader2, ChevronUp, ChevronDown, ArrowLeft, Play, Clock, Video } from "lucide-react";
import DropVideoPlayer from "./drops/DropVideoPlayer";
import DropUploadModal from "./drops/DropUploadModal";
import MyUploadsTab from "./drops/MyUploadsTab";
import AllDropsTab from "./drops/AllDropsTab";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { getRevenueNetworkCache } from "@/lib/revenue-network-cache";

interface Drop {
  _id: string;
  caption: string;
  authorId: { _id: string; name?: string; email: string; profilePicture?: string; avatar?: string };
  videoUrl?: string;
  videoS3Key?: string;
  sourceType: "upload" | "link";
  duration: number;
  thumbnailUrl?: string;
  viewsCount: number;
  likesCount: number;
  sharesCount: number;
  likedByMe?: boolean;
  streamUrl: string | null;
  streamUrlExpiresAt: number | null;
  createdAt: string;
}


interface DropsPageProps {
  initialTab?: "feed" | "uploads" | "all";
  viewRole?: "founder" | "customer";
}

export function DropsPage({ initialTab = "feed", viewRole = "customer" }: DropsPageProps = {}) {
  const [tab, setTab] = useState<"feed" | "uploads" | "all">(initialTab);
  const [viewMode, setViewMode] = useState<"grid" | "feed">(viewRole === "customer" ? "grid" : "feed");

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
    }
  }, [initialTab]);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [contentRefreshKey, setContentRefreshKey] = useState(0);

  const [likedDrops, setLikedDrops] = useState<Set<string>>(new Set());
  const [shareDropId, setShareDropId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [affiliateId, setAffiliateId] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);
  const meId = getUserIdFromToken() || "";
  const orgId = typeof window !== "undefined" ? localStorage.getItem("garage_org_id") || "" : "";
  const { amIFounder, userData } = useAmIFounder();
  // Mirrors the backend's `isUserGuest` (roam-backend `src/routes/drops.ts`):
  // a founder / fullAccess membership always outranks the membership's `guest`
  // flag. That flag sticks around on accounts that ever went through the guest
  // check-in flow, so gating on it alone hides the upload entry points from
  // founders whose uploads the API would happily accept.
  const isGuest = userData?.guest === true && !amIFounder;

  // Build the infinite list: original drops + repeat after "caught up"
  // Infinite list: original drops + seamless repeat
  const feedItems = useMemo(() => {
    if (drops.length === 0) return [];
    const items: Drop[] = [...drops];
    if (!hasMore && drops.length > 0) {
      items.push(...drops, ...drops);
    }
    return items;
  }, [drops, hasMore]);

  // Show "caught up" toast when crossing into repeated territory
  const [caughtUpShown, setCaughtUpShown] = useState(false);
  useEffect(() => {
    if (!hasMore && drops.length > 0 && activeIndex === drops.length && !caughtUpShown) {
      setCaughtUpShown(true);
      setTimeout(() => setCaughtUpShown(false), 2500);
    }
  }, [activeIndex, drops.length, hasMore, caughtUpShown]);

  // Affiliate ID + org slug
  useEffect(() => {
    const f = async () => {
      const token = getToken();
      if (!token) return;
      // Fetch affiliate ID
      try {
        const res = await fetch(`${API_URL}/affiliate/my-affiliate-id`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) { const d = await res.json(); if (d.affiliateId) setAffiliateId(d.affiliateId); }
      } catch {}
      // Get org slug — try cache first, then fetch from API
      try {
        const cached = getRevenueNetworkCache();
        if (cached?.storeSlug) {
          setOrgSlug(cached.storeSlug);
        } else if (orgId) {
          const orgRes = await fetch(`${API_URL}/org/${orgId}`, { headers: { Authorization: `Bearer ${token}` } });
          if (orgRes.ok) {
            const orgData = await orgRes.json();
            const slug = orgData.org?.slug || orgData.org?.store?.slug || "";
            if (slug) setOrgSlug(slug);
          }
        }
      } catch {}
    };
    f();
  }, [orgId]);

  // Fetch drops
  const fetchDrops = useCallback(async (cursor?: string | null) => {
    if (isFetching || !orgId) return;
    setIsFetching(true);
    try {
      const targetDropId = localStorage.getItem("target_drop_id");
      let singleDrop: Drop | null = null;
      if (!cursor && targetDropId) {
        localStorage.removeItem("target_drop_id");
        try {
          const singleRes = await api<{ success: boolean; drop: Drop }>(`/drops/${targetDropId}`, {}, getToken()!);
          if (singleRes.success && singleRes.drop) {
            singleDrop = singleRes.drop;
          }
        } catch (e) {
          console.error("Failed to fetch target drop:", e);
        }
      }

      let url = `/drops?orgId=${orgId}&limit=30`;
      if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
      const data = await api<{ success: boolean; drops: Drop[]; nextCursor: string | null; hasMore: boolean }>(url, {}, getToken()!);
      if (data.success) {
        setDrops((prev) => {
          let list = cursor ? [...prev, ...data.drops] : data.drops;
          if (singleDrop) {
            list = [singleDrop, ...list.filter(d => d._id !== singleDrop!._id)];
          }
          return list;
        });
        // Rehydrate liked state from the server. Without this the heart
        // resets on every refresh and re-liking double-counts.
        setLikedDrops((prev) => {
          const s = cursor ? new Set(prev) : new Set<string>();
          for (const d of [...data.drops, ...(singleDrop ? [singleDrop] : [])]) {
            if (d.likedByMe) s.add(d._id);
            else s.delete(d._id);
          }
          return s;
        });
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      }
    } catch (e) { console.error("Failed to fetch drops:", e); }
    finally { setIsFetching(false); setIsInitialLoad(false); }
  }, [orgId, isFetching]);

  useEffect(() => { if (orgId) fetchDrops(); }, [orgId]);

  // Load more when nearing end of original drops
  useEffect(() => {
    if (viewMode === "feed") {
      const realIndex = activeIndex < drops.length ? activeIndex : activeIndex % (drops.length || 1);
      if (realIndex >= drops.length - 2 && hasMore && !isFetching) fetchDrops(nextCursor);
    }
  }, [activeIndex, drops.length, hasMore, isFetching, viewMode]);

  // IntersectionObserver for active slide detection
  useEffect(() => {
    if (tab !== "feed") return;
    const container = feedRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let best: { idx: number; ratio: number } | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idx = Number(entry.target.getAttribute("data-index"));
            if (!isNaN(idx) && (!best || entry.intersectionRatio > best.ratio)) {
              best = { idx, ratio: entry.intersectionRatio };
            }
          }
        }
        if (best !== null) {
          setActiveIndex(best.idx);
        }
      },
      { root: container, threshold: [0.6, 0.8, 1.0] }
    );
    const slots = container.querySelectorAll("[data-index]");
    slots.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [feedItems.length, tab]);

  // Keyboard nav
  useEffect(() => {
    if (tab !== "feed" || showUpload || shareDropId) return;
    const handle = (e: KeyboardEvent) => {
      const container = feedRef.current;
      if (!container) return;
      let target = -1;
      if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); target = Math.min(activeIndex + 1, feedItems.length - 1); }
      else if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); target = Math.max(activeIndex - 1, 0); }
      if (target >= 0) {
        const el = container.querySelector(`[data-index="${target}"]`);
        el?.scrollIntoView({ behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [activeIndex, feedItems.length, tab, showUpload, shareDropId]);

  // Arrow navigation
  const navigateTo = useCallback((index: number) => {
    const container = feedRef.current;
    if (!container) return;
    const clamped = Math.max(0, Math.min(index, feedItems.length - 1));
    const el = container.querySelector(`[data-index="${clamped}"]`);
    el?.scrollIntoView({ behavior: "smooth" });
  }, [feedItems.length]);

  // Actions
  const handleView = useCallback((id: string) => { api(`/drops/${id}/view`, { method: "POST" }, getToken()!).catch(() => {}); }, []);
  const handleLike = useCallback((id: string) => {
    const liked = likedDrops.has(id);
    setLikedDrops((prev) => { const s = new Set(prev); liked ? s.delete(id) : s.add(id); return s; });
    setDrops((prev) => prev.map((d) => d._id === id ? { ...d, likesCount: d.likesCount + (liked ? -1 : 1) } : d));
    // Reconcile with the server's count — the optimistic bump above is a
    // guess, and the server is idempotent so it may not have moved at all.
    api<{ success: boolean; liked: boolean; likesCount: number }>(
      `/drops/${id}/like`,
      { method: "POST", body: JSON.stringify({ liked: !liked }) },
      getToken()!
    )
      .then((res) => {
        if (!res?.success) return;
        setDrops((prev) => prev.map((d) => d._id === id ? { ...d, likesCount: res.likesCount, likedByMe: res.liked } : d));
        setLikedDrops((prev) => { const s = new Set(prev); res.liked ? s.add(id) : s.delete(id); return s; });
      })
      .catch(() => {
        // Roll back the optimistic update.
        setLikedDrops((prev) => { const s = new Set(prev); liked ? s.add(id) : s.delete(id); return s; });
        setDrops((prev) => prev.map((d) => d._id === id ? { ...d, likesCount: d.likesCount + (liked ? 1 : -1) } : d));
      });
  }, [likedDrops]);
  const handleShare = useCallback((id: string) => { setShareDropId(id); setCopied(false); api(`/drops/${id}/share`, { method: "POST" }, getToken()!).catch(() => {}); }, []);
  const copyShareLink = useCallback(() => {
    if (!shareDropId) return;
    const refId = affiliateId || meId;
    const url = orgSlug
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/guest/${orgSlug}/drop/${shareDropId}?referCode=${refId}`
      : `${typeof window !== "undefined" ? window.location.origin : ""}/drops/${shareDropId}?ref=${refId}`;
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }, [shareDropId, affiliateId, meId, orgSlug]);
  // The founder tabs keep their own fetched lists, so bump a key to remount
  // (and refetch) them after an upload — otherwise a new drop only shows up in
  // the feed state that this component owns.
  const handleDropCreated = useCallback((drop: Drop) => {
    setDrops((prev) => [drop, ...prev]);
    setContentRefreshKey((n) => n + 1);
  }, []);
  const handleDropDeleted = useCallback((id: string) => { setDrops((prev) => prev.filter((d) => d._id !== id)); }, []);

  const handleGridScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    if (isAtBottom && hasMore && !isFetching) {
      fetchDrops(nextCursor);
    }
  };

  const shouldRenderVideo = (i: number) => Math.abs(i - activeIndex) <= 1;
  const fmt = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : String(n);
  const fmtDur = (s: number) => {
    if (isNaN(s) || s <= 0) return "0:00";
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  const tabs: { key: typeof tab; label: string }[] = viewRole === "founder" ? [
    { key: "uploads" as const, label: "My Drops" },
    { key: "all" as const, label: "All Drops" },
  ] : [
    { key: "feed" as const, label: "Feed" },
  ];

  return (
    <div style={{ height: "100%", background: "#0a0a10", position: "relative", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @keyframes dropPlayFade { 0%{opacity:1;transform:translate(-50%,-50%) scale(1)} 100%{opacity:0;transform:translate(-50%,-50%) scale(1.4)} }
        @keyframes dropToastIn { 0%{opacity:0;transform:translateX(-50%) translateY(-8px)} 100%{opacity:1;transform:translateX(-50%) translateY(0)} }
        .drop-action-btn{background:none;border:none;color:white;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px;transition:transform .15s}
        .drop-action-btn:hover{transform:scale(1.1)}.drop-action-btn:active{transform:scale(.95)}
        .drops-feed{scrollbar-width:none;-ms-overflow-style:none}
        .drops-feed::-webkit-scrollbar{display:none}
      `}</style>

      {/* Tab Switcher for Founder */}
      {viewRole === "founder" && (
        <div className="px-5 pt-4 pb-2 flex items-center gap-3 bg-[#0a0a10]" style={{ flexShrink: 0 }}>
          <div className="flex bg-[#1a1a22] p-0.5 rounded-lg border border-[#2a2a35] gap-0.5">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "px-3 py-1 rounded-md text-[11px] font-medium transition-all duration-150",
                  tab === t.key
                    ? "bg-brand text-brand-foreground shadow-sm"
                    : "text-[#9fa0b8] hover:text-white hover:bg-white/5"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          {!isGuest && (
            <button
              onClick={() => setShowUpload(true)}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-brand-foreground text-[11px] font-semibold hover:bg-brand/90 transition-colors"
            >
              <Plus size={13} strokeWidth={2.5} /> New Drop
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {tab === "uploads" ? (
        <div style={{ flex: 1, overflowY: "auto" }}><MyUploadsTab key={contentRefreshKey} orgId={orgId} onDeleted={handleDropDeleted} onUpload={isGuest ? undefined : () => setShowUpload(true)} /></div>
      ) : tab === "all" ? (
        <div style={{ flex: 1, overflowY: "auto" }}><AllDropsTab key={contentRefreshKey} orgId={orgId} onDeleted={handleDropDeleted} /></div>
      ) : (
        <div
          style={{ flex: 1, display: "flex", justifyContent: "center", position: "relative", overflow: "hidden" }}
          className={viewMode === "grid" ? "flex-col justify-start items-stretch" : ""}
        >
          {isInitialLoad ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
              <Loader2 size={28} className="animate-spin text-brand" />
            </div>
          ) : drops.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, width: "100%", height: "100%" }}>
              <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand"><path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14"/><rect x="3" y="6" width="12" height="12" rx="2"/></svg>
              </div>
              <div className="text-sm font-medium text-[#9fa0b8]">No Drops yet</div>
              {!isGuest && (
                <>
                  <div className="text-xs text-[#9fa0b8]/60 text-center max-w-[240px]">Be the first to share a short video!</div>
                  <button onClick={() => setShowUpload(true)} className="mt-2 px-6 py-2 rounded-lg bg-brand text-brand-foreground text-sm font-semibold hover:bg-brand/90 transition-colors">Create Your First Drop</button>
                </>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div
              onScroll={handleGridScroll}
              className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 no-scrollbar"
            >
              <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 sm:gap-6 w-full pb-8">
                  {drops.map((drop, index) => {
                    const liked = likedDrops.has(drop._id);
                    return (
                      <div
                        key={drop._id}
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent("right-panel:open-drops-feed", {
                            detail: { drops, startIndex: index }
                          }));
                        }}
                        className="w-full overflow-hidden group transition-all duration-300 cursor-pointer flex flex-col h-full animate-in fade-in zoom-in-95 duration-200"
                      >
                        <div className="aspect-[9/16] bg-[#1a1a22] relative overflow-hidden rounded-2xl border border-[#2a2a35] group-hover:border-brand/30 transition-colors">
                          {drop.thumbnailUrl ? (
                            <img
                              src={drop.thumbnailUrl}
                              alt={drop.caption}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-[#14141e]">
                              <Video className="h-10 w-10 text-[#5a5a6a]" />
                            </div>
                          )}
                          {/* Duration badge */}
                          {drop.duration && drop.duration > 0 && (
                            <div className="absolute bottom-2.5 right-2.5 bg-black/60 backdrop-blur-md rounded px-1.5 py-0.5 text-[10px] text-white font-medium flex items-center gap-0.5 z-10">
                              <Clock size={9} /> {fmtDur(drop.duration)}
                            </div>
                          )}
                          {/* Hover Play Overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition-all duration-300 flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300 shadow-[0_0_15px] shadow-brand/40">
                              <Play className="w-5 h-5 text-brand-foreground fill-brand-foreground ml-0.5" />
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col flex-1 mt-3">
                          {/* Author */}
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <div
                              className="w-4 h-4 rounded-full bg-[#2a2a35] bg-cover bg-center flex-shrink-0"
                              style={{ backgroundImage: `url(${drop.authorId?.profilePicture || drop.authorId?.avatar || ""})` }}
                            />
                            <span className="text-[10px] text-[#9fa0b8] truncate">
                              {drop.authorId?.name || drop.authorId?.email || "Unknown"}
                            </span>
                          </div>
                          <p className="text-white text-xs font-semibold line-clamp-2 mb-1.5 leading-snug group-hover:text-brand transition-colors">
                            {drop.caption || "Untitled Drop"}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-[#5a5a6a] font-medium">
                            <span className="flex items-center gap-0.5"><Eye size={10} /> {fmt(drop.viewsCount || 0)}</span>
                            <span className="flex items-center gap-0.5"><Heart size={10} fill={liked ? "#f43f5e" : "none"} color={liked ? "#f43f5e" : "#5a5a6a"} /> {fmt(drop.likesCount || 0)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {isFetching && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-brand animate-spin" />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Back button overlay */}
              {viewMode === "feed" && viewRole === "customer" && (
                <button
                  onClick={() => setViewMode("grid")}
                  className="absolute top-4 left-4 z-[50] flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/60 hover:bg-brand hover:text-brand-foreground text-white border border-white/10 text-xs font-semibold backdrop-blur-md transition-all duration-200"
                >
                  <ArrowLeft size={14} />
                  <span>Back to Grid</span>
                </button>
              )}

              {/* Scroll-snap feed — native smooth scroll */}
              <div
                ref={feedRef}
                className="drops-feed"
                style={{
                  width: "100%",
                  maxWidth: 400,
                  height: "100%",
                  overflowY: "scroll",
                  scrollSnapType: "y mandatory",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {feedItems.map((drop, index) => {
                  return (
                    <div
                      key={`${drop._id}-${index}`}
                      data-index={index}
                      style={{
                        height: "100%",
                        scrollSnapAlign: "start",
                        scrollSnapStop: "always",
                        position: "relative",
                        flexShrink: 0,
                      }}
                    >
                      {shouldRenderVideo(index) ? (
                        <DropVideoPlayer
                          streamUrl={drop.streamUrl || ""}
                          videoUrl={drop.videoUrl}
                          sourceType={drop.sourceType}
                          thumbnailUrl={drop.thumbnailUrl}
                          isActive={index === activeIndex}
                          isNext={index === activeIndex + 1}
                          onViewCounted={() => handleView(drop._id)}
                        />
                      ) : (
                        <div style={{ width: "100%", height: "100%", background: "#000", backgroundImage: drop.thumbnailUrl ? `url(${drop.thumbnailUrl})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }} />
                      )}

                      {/* Author + caption */}
                      <div style={{ position: "absolute", bottom: 24, left: 14, right: 64, zIndex: 4, pointerEvents: "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#333", backgroundImage: `url(${drop.authorId?.profilePicture || drop.authorId?.avatar || ""})`, backgroundSize: "cover", border: "2px solid rgba(255,255,255,0.3)", flexShrink: 0 }} />
                          <span style={{ color: "white", fontSize: 13, fontWeight: 600, textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>{drop.authorId?.name || drop.authorId?.email || "Unknown"}</span>
                        </div>
                        {drop.caption && (
                          <p style={{ margin: 0, color: "rgba(255,255,255,0.9)", fontSize: 13, lineHeight: 1.4, textShadow: "0 1px 4px rgba(0,0,0,0.6)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{drop.caption}</p>
                        )}
                      </div>

                      {/* Action bar */}
                      <div style={{ position: "absolute", bottom: 24, right: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, zIndex: 4 }}>
                        <button className="drop-action-btn" onClick={(e) => { e.stopPropagation(); handleLike(drop._id); }}>
                          <Heart size={26} fill={likedDrops.has(drop._id) ? "#f43f5e" : "none"} color={likedDrops.has(drop._id) ? "#f43f5e" : "white"} style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }} />
                          <span style={{ fontSize: 11, fontWeight: 500, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>{fmt(drop.likesCount)}</span>
                        </button>
                        <button className="drop-action-btn" onClick={(e) => { e.stopPropagation(); handleShare(drop._id); }}>
                          <Share2 size={24} style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }} />
                          <span style={{ fontSize: 11, fontWeight: 500, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>Share</span>
                        </button>
                        <div className="drop-action-btn" style={{ cursor: "default" }}>
                          <Eye size={22} style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }} />
                          <span style={{ fontSize: 11, fontWeight: 500, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>{fmt(drop.viewsCount)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {isFetching && drops.length > 0 && (
                  <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Loader2 size={20} className="animate-spin text-brand" />
                  </div>
                )}
              </div>

              {/* Caught-up toast */}
              {caughtUpShown && (
                <div style={{
                  position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)",
                  zIndex: 20, background: "color-mix(in srgb, var(--brand) 15%, transparent)", border: "1px solid color-mix(in srgb, var(--brand) 30%, transparent)",
                  borderRadius: 10, padding: "8px 20px",
                  color: "var(--brand)", fontSize: 13, fontWeight: 500,
                  backdropFilter: "blur(12px)",
                  animation: "dropToastIn 0.3s ease-out",
                  whiteSpace: "nowrap",
                }}>
                  ✓ You're all caught up!
                </div>
              )}

              {/* Navigation arrows — no counter */}
              <div style={{ position: "absolute", right: 24, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 8, zIndex: 10 }}>
                <button
                  onClick={() => navigateTo(activeIndex - 1)}
                  disabled={activeIndex === 0}
                  style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: activeIndex === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: activeIndex === 0 ? "#444" : "white",
                    cursor: activeIndex === 0 ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s", backdropFilter: "blur(8px)",
                  }}
                  onMouseOver={(e) => { if (activeIndex > 0) e.currentTarget.style.background = "color-mix(in srgb, var(--brand) 20%, transparent)"; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = activeIndex === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.1)"; }}
                >
                  <ChevronUp size={20} />
                </button>
                <button
                  onClick={() => navigateTo(activeIndex + 1)}
                  disabled={activeIndex >= feedItems.length - 1}
                  style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: activeIndex >= feedItems.length - 1 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: activeIndex >= feedItems.length - 1 ? "#444" : "white",
                    cursor: activeIndex >= feedItems.length - 1 ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s", backdropFilter: "blur(8px)",
                  }}
                  onMouseOver={(e) => { if (activeIndex < feedItems.length - 1) e.currentTarget.style.background = "color-mix(in srgb, var(--brand) 20%, transparent)"; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = activeIndex >= feedItems.length - 1 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.1)"; }}
                >
                  <ChevronDown size={20} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {showUpload && !isGuest && <DropUploadModal orgId={orgId} onClose={() => setShowUpload(false)} onCreated={handleDropCreated} />}

      {shareDropId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={() => setShareDropId(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-[#0f0f17] rounded-xl border border-[#2a2a35]" style={{ width: "min(380px,90vw)", padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
            <h3 className="text-white text-sm font-semibold mb-4">Share Drop</h3>
            <p className="text-[#9fa0b8] text-xs mb-4">Share this drop with your affiliate link to earn rewards.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input readOnly value={orgSlug ? `${typeof window !== "undefined" ? window.location.origin : ""}/guest/${orgSlug}/drop/${shareDropId}?referCode=${affiliateId || meId}` : `${typeof window !== "undefined" ? window.location.origin : ""}/drops/${shareDropId}?ref=${affiliateId || meId}`} className="flex-1 px-3 py-2 rounded-lg bg-[#1a1a22] border border-[#2a2a35] text-[#9fa0b8] text-xs outline-none" />
              <button onClick={copyShareLink} className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${copied ? "bg-green-500/20 text-green-400" : "bg-brand text-brand-foreground hover:bg-brand/90"}`}>
                {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <button onClick={() => setShareDropId(null)} className="w-full mt-3 py-2 rounded-lg border border-[#2a2a35] text-[#9fa0b8] text-xs hover:bg-white/5 transition-colors">Close</button>
          </div>
        </div>
      )}
      {/* Floating Action Button (FAB) for new drop (only visible in grid view and not for guests) */}
      {viewMode === "grid" && !isGuest && (
        <button
          onClick={() => setShowUpload(true)}
          className="fixed bottom-6 right-6 z-[60] flex items-center justify-center w-14 h-14 rounded-full bg-brand text-brand-foreground shadow-[0_4px_20px] shadow-brand/30 hover:bg-brand/90 hover:scale-105 active:scale-95 transition-all duration-200"
          title="New Drop"
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
