"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, UserPlus, ChevronRight, Shield, Star, Check, X, DollarSign, Landmark } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const POSITION_LABELS: Record<string, string> = {
  thirdBase: "3rd Base", secondBaseA: "2nd Base A", secondBaseB: "2nd Base B",
  "1stA": "1st Base A", "1stB": "1st Base B", "1stC": "1st Base C", "1stD": "1st Base D",
  "atBat-0": "AT BAT 1", "atBat-1": "AT BAT 2", "atBat-2": "AT BAT 3", "atBat-3": "AT BAT 4",
  "atBat-4": "AT BAT 5", "atBat-5": "AT BAT 6", "atBat-6": "AT BAT 7", "atBat-7": "AT BAT 8",
};

export interface PlacementNotification {
  _id: string;
  notificationType?: string; // "placement" | "placement_unassigned" | "membership" | "affiliate" | "layaway_request" | "snapbackloan_request"
  boardId?: string;
  boardTrackingNo?: string;
  position?: string;
  qualifiedUserId: string;
  qualifiedUserEmail: string;
  qualifiedUserName: string;
  uplinePosition?: string;
  // Only set for notificationType: "layaway_request" — see
  // bat246PlacementNotifications.model.ts.
  layawayRequestId?: string;
  // Only set for notificationType: "snapbackloan_request" — same
  // relationship, for Snap Back Loan asks (a debt, not a plain gift).
  snapBackLoanRequestId?: string;
  summary?: string;
  isRead: boolean;
  createdAt: string;
}

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("garage_tok") ?? "" : "";
}

interface Props {
  onPlaceNow?: (notification: PlacementNotification) => Promise<void>;
}

function NotifIcon({ type }: { type?: string }) {
  if (type === "membership") return <Shield className="w-3.5 h-3.5 text-blue-400" />;
  if (type === "affiliate") return <Star className="w-3.5 h-3.5 text-purple-400" />;
  if (type === "placement_unassigned") return <UserPlus className="w-3.5 h-3.5 text-slate-400" />;
  if (type === "layaway_request") return <DollarSign className="w-3.5 h-3.5 text-yellow-400" />;
  if (type === "snapbackloan_request") return <Landmark className="w-3.5 h-3.5 text-orange-400" />;
  return <UserPlus className="w-3.5 h-3.5 text-amber-400" />;
}

function notifLabel(type?: string) {
  if (type === "membership") return "Purchased $20 Annual Membership";
  if (type === "affiliate") return "Purchased $25 Unilevel Plus";
  if (type === "placement_unassigned") return "Qualified — Awaiting Placement";
  if (type === "layaway_request") return "B2 Coins Request";
  if (type === "snapbackloan_request") return "Snap Back Loan Request";
  return "Ready to Place";
}

function notifBg(type?: string) {
  if (type === "membership") return "bg-blue-500/15 border-blue-500/25";
  if (type === "affiliate") return "bg-purple-500/15 border-purple-500/25";
  if (type === "placement_unassigned") return "bg-slate-500/15 border-slate-500/25";
  if (type === "layaway_request") return "bg-yellow-500/15 border-yellow-500/25";
  if (type === "snapbackloan_request") return "bg-orange-500/15 border-orange-500/25";
  return "bg-amber-500/15 border-amber-500/25";
}

function notifText(type?: string) {
  if (type === "membership") return "text-blue-400";
  if (type === "affiliate") return "text-purple-400";
  if (type === "placement_unassigned") return "text-slate-400";
  if (type === "layaway_request") return "text-yellow-400";
  if (type === "snapbackloan_request") return "text-orange-400";
  return "text-amber-400";
}

export function Bat246NotificationBell({ onPlaceNow }: Props) {
  const [notifications, setNotifications] = useState<PlacementNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [placing, setPlacing] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(() => {
    fetch(`${API}/bat246/notifications`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(d => setNotifications(d.notifications ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  async function markRead(id: string) {
    setNotifications(prev => prev.map(x => x._id === id ? { ...x, isRead: true } : x));
    fetch(`${API}/bat246/notifications/${id}/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
    }).catch(() => {});
  }

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      const unreadIds = prev.filter(x => !x.isRead).map(x => x._id);
      unreadIds.forEach(id => {
        fetch(`${API}/bat246/notifications/${id}/read`, {
          method: "POST",
          headers: { Authorization: `Bearer ${getToken()}` },
        }).catch(() => {});
      });
      return prev.map(x => x.isRead ? x : { ...x, isRead: true });
    });
  }, []);

  // Close on outside click — marks all as read
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        markAllRead();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, markAllRead]);

  const unread = notifications.filter(n => !n.isRead).length;

  async function clearNotif(id: string) {
    setNotifications(prev => prev.filter(x => x._id !== id));
    fetch(`${API}/bat246/notifications/${id}/clear`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
    }).catch(() => {});
  }

  async function handlePlaceNow(n: PlacementNotification) {
    if (!onPlaceNow || placing) return;
    setPlacing(n._id);
    try {
      await onPlaceNow(n);
      setNotifications(prev => prev.filter(x => x._id !== n._id));
    } finally {
      setPlacing(null);
    }
  }

  const [responding, setResponding] = useState<string | null>(null);
  const [respondError, setRespondError] = useState<string | null>(null);

  async function handleRespondLayawayRequest(n: PlacementNotification, approve: boolean) {
    if (!n.layawayRequestId || responding) return;
    setResponding(n._id);
    setRespondError(null);
    try {
      const res = await fetch(`${API}/bat246/layaway/requests/${n.layawayRequestId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ approve }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to respond");
      setNotifications(prev => prev.filter(x => x._id !== n._id));
      fetch(`${API}/bat246/notifications/${n._id}/clear`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      }).catch(() => {});
    } catch (e: any) {
      setRespondError(e.message);
    } finally {
      setResponding(null);
    }
  }

  async function handleRespondSnapBackLoanRequest(n: PlacementNotification, approve: boolean) {
    if (!n.snapBackLoanRequestId || responding) return;
    setResponding(n._id);
    setRespondError(null);
    try {
      const res = await fetch(`${API}/bat246/snapbackloans/requests/${n.snapBackLoanRequestId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ approve }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to respond");
      setNotifications(prev => prev.filter(x => x._id !== n._id));
      fetch(`${API}/bat246/notifications/${n._id}/clear`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      }).catch(() => {});
    } catch (e: any) {
      setRespondError(e.message);
    } finally {
      setResponding(null);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          if (open) markAllRead();
          setOpen(v => !v);
        }}
        className="relative p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
        title="Placement notifications"
      >
        <Bell className="w-4 h-4 text-white/60" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border border-[#09090f] flex items-center justify-center">
            <span className="text-[9px] font-black text-white leading-none">{Math.min(unread, 9)}</span>
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#0e0e1c] border border-white/12 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <div className="flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[12px] font-bold text-white/80">Recruit Activity</span>
            </div>
            {notifications.length > 0 && (
              <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-400/25 px-1.5 py-0.5 rounded-full font-semibold">
                {notifications.length}
              </span>
            )}
          </div>

          {/* List */}
          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <Bell className="w-6 h-6 text-white/10 mx-auto mb-2" />
              <p className="text-[11px] text-white/25">No activity yet</p>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-white/[0.06]">
              {notifications.map(n => {
                const type = n.notificationType ?? "placement";
                const isPlacement = type === "placement";
                const isLayawayRequest = type === "layaway_request";
                const isSnapBackLoanRequest = type === "snapbackloan_request";
                return (
                  <div key={n._id} className={`px-4 py-3 ${!n.isRead ? "bg-amber-500/5" : ""}`}>
                    <div className="flex items-start gap-2.5">
                      <div className={`w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 ${notifBg(type)}`}>
                        <NotifIcon type={type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        {(isLayawayRequest || isSnapBackLoanRequest) && n.summary ? (
                          <div className="text-[11px] font-semibold text-white/80">{n.summary}</div>
                        ) : (
                          <>
                            <div className="text-[11px] font-semibold text-white/80 truncate">{n.qualifiedUserName || n.qualifiedUserEmail}</div>
                            <div className="text-[10px] text-white/35 truncate">{n.qualifiedUserEmail}</div>
                          </>
                        )}
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${notifBg(type)} ${notifText(type)}`}>
                            {notifLabel(type)}
                          </span>
                          {isPlacement && n.boardTrackingNo && (
                            <span className="text-[9px] bg-white/8 text-white/40 px-1.5 py-0.5 rounded font-mono">
                              Board {n.boardTrackingNo}
                            </span>
                          )}
                          {isPlacement && n.position && (
                            <span className="text-[9px] bg-blue-500/15 text-blue-300 px-1.5 py-0.5 rounded">
                              {POSITION_LABELS[n.position] ?? n.position}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        {!n.isRead && (
                          <button
                            onClick={() => markRead(n._id)}
                            title="Mark as read"
                            className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-emerald-400 transition-colors"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => clearNotif(n._id)}
                          title="Clear"
                          className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-red-400 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {isPlacement && onPlaceNow && n.boardId && (
                      <button
                        onClick={() => handlePlaceNow(n)}
                        disabled={placing === n._id}
                        className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/25 hover:bg-amber-500/35 text-amber-300 text-[11px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {placing === n._id ? (
                          <span className="w-3 h-3 border border-amber-300 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>Place Now <ChevronRight className="w-3 h-3" /></>
                        )}
                      </button>
                    )}
                    {isLayawayRequest && n.layawayRequestId && (
                      <div className="mt-2 space-y-1.5">
                        {respondError && responding === null && (
                          <p className="text-[10px] text-red-400">{respondError}</p>
                        )}
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleRespondLayawayRequest(n, true)}
                            disabled={responding === n._id}
                            className="flex-1 py-1.5 rounded-lg bg-yellow-500/20 border border-yellow-400/25 hover:bg-yellow-500/35 text-yellow-300 text-[11px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {responding === n._id ? "…" : "Approve"}
                          </button>
                          <button
                            onClick={() => handleRespondLayawayRequest(n, false)}
                            disabled={responding === n._id}
                            className="flex-1 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/50 text-[11px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Deny
                          </button>
                        </div>
                      </div>
                    )}
                    {isSnapBackLoanRequest && n.snapBackLoanRequestId && (
                      <div className="mt-2 space-y-1.5">
                        {respondError && responding === null && (
                          <p className="text-[10px] text-red-400">{respondError}</p>
                        )}
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleRespondSnapBackLoanRequest(n, true)}
                            disabled={responding === n._id}
                            className="flex-1 py-1.5 rounded-lg bg-orange-500/20 border border-orange-400/25 hover:bg-orange-500/35 text-orange-300 text-[11px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {responding === n._id ? "…" : "Approve"}
                          </button>
                          <button
                            onClick={() => handleRespondSnapBackLoanRequest(n, false)}
                            disabled={responding === n._id}
                            className="flex-1 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/50 text-[11px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Deny
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
