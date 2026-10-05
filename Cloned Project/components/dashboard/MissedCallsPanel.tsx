"use client";

import { useCallback, useEffect, useState } from "react";
import { PhoneOff, X, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { connectSocket } from "@/lib/socket";
import { toast } from "sonner";

// Web companion to garage-chat's missed-calls screen. Reads
// /missed-calls on mount, marks-viewed on mount so the badge clears
// (rows stay so the user can still see who called), and listens for
// the 'missed-call:new' socket event so a new miss surfaces live
// without a poll.
//
// Mounted inside NotificationPage as a top-of-list section. Renders
// nothing when there are no missed calls — invisible by default,
// so it doesn't crowd the page for users who never miss anything.

interface MissedCall {
  _id: string;
  fromUserId: string;
  fromName?: string;
  fromAvatar?: string;
  occurredAt: string;
  viewedAt: string | null;
  dismissedAt: string | null;
}

function timeAgo(iso: string): string {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000),
  );
  if (seconds < 60) return "just now";
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function MissedCallsPanel() {
  const [items, setItems] = useState<MissedCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{
        success: boolean;
        missedCalls: MissedCall[];
      }>("/missed-calls?limit=50", {}, getToken()!);
      setItems(res.missedCalls || []);
      // Clear the badge on mount, fire-and-forget. Rows stay
      // visible — only the unread count drops to 0.
      api("/missed-calls/mark-viewed", { method: "POST" }, getToken()!).catch(
        () => {},
      );
    } catch (err) {
      console.warn("[MissedCallsPanel] load failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live nudge from the backend's expireKnock → no need to poll.
  useEffect(() => {
    const socket = connectSocket();
    const onNew = (payload: {
      from: string;
      fromName?: string;
      fromAvatar?: string;
      occurredAt: string;
    }) => {
      setItems((prev) => [
        {
          _id: `live:${payload.from}:${payload.occurredAt}`,
          fromUserId: payload.from,
          fromName: payload.fromName,
          fromAvatar: payload.fromAvatar,
          occurredAt: payload.occurredAt,
          viewedAt: null,
          dismissedAt: null,
        },
        ...prev,
      ]);
      // Refresh once shortly after so the placeholder _id gets
      // replaced with the real Mongo _id; cleaner dismiss UX.
      setTimeout(() => load(), 800);
    };
    socket.on("missed-call:new", onNew);
    return () => {
      socket.off("missed-call:new", onNew);
    };
  }, [load]);

  const dismiss = useCallback(
    async (id: string) => {
      // Optimistic remove.
      const previous = items;
      setItems((cur) => cur.filter((c) => c._id !== id));
      // Skip server call for live-placeholder rows (they'll be
      // reconciled by the soon-after load() above).
      if (id.startsWith("live:")) return;
      try {
        await api(
          `/missed-calls/${id}`,
          { method: "DELETE" },
          getToken()!,
        );
      } catch (err) {
        console.warn("[MissedCallsPanel] dismiss failed:", err);
        setItems(previous);
      }
    },
    [items],
  );

  const clearAll = useCallback(async () => {
    if (items.length === 0) return;
    const previous = items;
    setItems([]);
    setClearing(true);
    try {
      await api(
        "/missed-calls/clear",
        { method: "POST" },
        getToken()!,
      );
      toast.success("Missed calls cleared");
    } catch (err) {
      console.warn("[MissedCallsPanel] clearAll failed:", err);
      setItems(previous);
      toast.error("Failed to clear missed calls");
    } finally {
      setClearing(false);
    }
  }, [items]);

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <div className="border border-white/[0.06] rounded-2xl bg-[#0f0f12]/80 backdrop-blur p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-red-500/10 border border-red-500/20">
            <PhoneOff className="h-4 w-4 text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Missed calls</h3>
            <p className="text-[11px] text-[#9fa0b8]">
              {items.length} {items.length === 1 ? "knock" : "knocks"} you didn’t answer
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          disabled={clearing}
          className="text-[11px] text-[#9fa0b8] hover:text-white"
        >
          {clearing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            "Clear all"
          )}
        </Button>
      </div>

      <div className="space-y-1.5">
        {items.slice(0, 8).map((item) => (
          <div
            key={item._id}
            className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.04] transition-colors group"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={item.fromAvatar || undefined} />
              <AvatarFallback className="bg-[#1f1f25] text-[10px] text-[#9fa0b8]">
                {(item.fromName || "?")
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white truncate">
                {item.fromName || "Someone"}
              </p>
              <p className="text-[10px] text-[#9fa0b8]">
                Knocked · {timeAgo(item.occurredAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(item._id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12]"
              title="Dismiss"
              aria-label={`Dismiss missed call from ${item.fromName || "caller"}`}
            >
              <X className="h-3 w-3 text-[#9fa0b8]" />
            </button>
          </div>
        ))}
        {items.length > 8 && (
          <p className="text-[10px] text-[#5a5a72] text-center pt-1">
            + {items.length - 8} more
          </p>
        )}
      </div>
    </div>
  );
}
