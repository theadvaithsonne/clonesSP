"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { getToken, getUserIdFromToken } from "@/lib/auth";
import { Trash2, Eye, Pencil, Loader2, Save, X, Heart, Share2, Clock, Play, Plus } from "lucide-react";
import DropVideoPlayer from "./DropVideoPlayer";
import DeleteConfirmModal from "./DeleteConfirmModal";

interface Drop {
  _id: string;
  caption: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  sourceType: "upload" | "link";
  viewsCount: number;
  likesCount: number;
  sharesCount: number;
  duration: number;
  createdAt: string;
  streamUrl?: string | null;
}

interface MyUploadsTabProps {
  orgId: string;
  onDeleted: (id: string) => void;
  /** Omitted when the viewer isn't allowed to upload (guests). */
  onUpload?: () => void;
}

export default function MyUploadsTab({ orgId, onDeleted, onUpload }: MyUploadsTabProps) {
  const [drops, setDrops] = useState<Drop[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [playingDrop, setPlayingDrop] = useState<Drop | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const meId = getUserIdFromToken() || "";

  const fetchMyDrops = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await api<any>(`/drops?orgId=${orgId}&limit=50`, {}, getToken()!);
      if (data.success) {
        const mine = data.drops.filter((d: any) => d.authorId?._id === meId || d.authorId === meId);
        setDrops(mine);
      }
    } catch (e) {
      console.error("Failed to fetch my drops:", e);
    } finally {
      setLoading(false);
    }
  }, [orgId, meId]);

  useEffect(() => { fetchMyDrops(); }, [fetchMyDrops]);

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await api(`/drops/${deleteTargetId}?orgId=${orgId}`, { method: "DELETE" }, getToken()!);
      setDrops((prev) => prev.filter((d) => d._id !== deleteTargetId));
      if (playingDrop?._id === deleteTargetId) setPlayingDrop(null);
      onDeleted(deleteTargetId);
    } catch (e) {
      console.error("Failed to delete drop:", e);
    } finally {
      setIsDeleting(false);
      setDeleteTargetId(null);
    }
  };

  const startEdit = (drop: Drop) => { setEditingId(drop._id); setEditCaption(drop.caption || ""); };
  const saveEdit = (id: string) => {
    setDrops((prev) => prev.map((d) => (d._id === id ? { ...d, caption: editCaption } : d)));
    setEditingId(null);
  };

  const fmt = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : String(n);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-brand animate-spin" />
      </div>
    );
  }

  if (drops.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-14 h-14 rounded-full bg-brand/10 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand">
            <path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14" />
            <rect x="3" y="6" width="12" height="12" rx="2" />
          </svg>
        </div>
        <p className="text-sm text-[#9fa0b8]">No uploads yet</p>
        <p className="text-xs text-[#9fa0b8]/60">Your uploaded drops will appear here</p>
        {onUpload && (
          <button
            onClick={onUpload}
            className="mt-2 flex items-center gap-1.5 px-5 py-2 rounded-lg bg-brand text-brand-foreground text-sm font-semibold hover:bg-brand/90 transition-colors"
          >
            <Plus size={15} strokeWidth={2.5} /> Upload a Drop
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="p-4">
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
          {drops.map((drop) => (
            <div key={drop._id} className="rounded-xl overflow-hidden border border-[#2a2a35] bg-[#0f0f17] hover:border-brand/30 transition-colors group">
              {/* Thumbnail — click to play */}
              <button
                className="relative w-full bg-[#111] overflow-hidden group"
                style={{ paddingTop: "133%", display: "block" }}
                onClick={() => setPlayingDrop(drop)}
              >
                {drop.thumbnailUrl ? (
                  <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${drop.thumbnailUrl})` }} />
                ) : drop.sourceType === "upload" && drop.streamUrl ? (
                  <video src={drop.streamUrl} muted playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3a3a45" strokeWidth="1.5">
                      <path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14" />
                      <rect x="3" y="6" width="12" height="12" rx="2" />
                    </svg>
                  </div>
                )}
                {/* Hover play overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <div className="w-11 h-11 rounded-full bg-brand flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                    <Play size={16} className="text-brand-foreground ml-0.5" />
                  </div>
                </div>
                <div className="absolute bottom-1.5 right-1.5 bg-black/70 rounded px-1.5 py-0.5 text-[10px] text-white font-medium flex items-center gap-0.5">
                  <Clock size={9} /> {fmtDur(drop.duration)}
                </div>
              </button>

              {/* Info */}
              <div className="p-2.5">
                {editingId === drop._id ? (
                  <div className="flex gap-1.5 mb-2">
                    <input
                      value={editCaption}
                      onChange={(e) => setEditCaption(e.target.value)}
                      className="flex-1 px-2 py-1 rounded-md bg-[#1a1a22] border border-[#2a2a35] text-white text-xs outline-none focus:border-brand/50"
                      autoFocus
                    />
                    <button onClick={() => saveEdit(drop._id)} className="p-1 text-[#22c55e] hover:bg-[#22c55e]/10 rounded"><Save size={12} /></button>
                    <button onClick={() => setEditingId(null)} className="p-1 text-[#9fa0b8] hover:bg-white/5 rounded"><X size={12} /></button>
                  </div>
                ) : (
                  <p className="text-xs text-white font-medium truncate mb-1.5">{drop.caption || "Untitled"}</p>
                )}

                <div className="flex items-center gap-2.5 text-[#9fa0b8] text-[10px] mb-2">
                  <span className="flex items-center gap-0.5"><Eye size={10} />{fmt(drop.viewsCount)}</span>
                  <span className="flex items-center gap-0.5"><Heart size={10} />{fmt(drop.likesCount)}</span>
                  <span className="flex items-center gap-0.5"><Share2 size={10} />{fmt(drop.sharesCount)}</span>
                  <span className="ml-auto">{fmtDate(drop.createdAt)}</span>
                </div>

                <div className="flex gap-1.5">
                  <button
                    onClick={() => startEdit(drop)}
                    className="flex-1 py-1.5 rounded-lg border border-[#2a2a35] text-[#9fa0b8] text-[11px] flex items-center justify-center gap-1 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <Pencil size={11} /> Edit
                  </button>
                  <button
                    onClick={() => setDeleteTargetId(drop._id)}
                    className="flex-1 py-1.5 rounded-lg border border-red-500/15 text-red-400/80 text-[11px] flex items-center justify-center gap-1 hover:bg-red-500/8 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full-screen video player modal */}
      {playingDrop && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setPlayingDrop(null)}
        >
          <button
            onClick={() => setPlayingDrop(null)}
            style={{ position: "absolute", top: 16, right: 16, zIndex: 10000, width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}
          >
            <X size={20} />
          </button>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(480px, 100vw)", height: "min(854px, 100vh)", position: "relative", borderRadius: "clamp(0px, 2vw, 16px)", overflow: "hidden" }}
          >
            <style>{`@keyframes dropPlayFade { 0%{opacity:1;transform:translate(-50%,-50%) scale(1)} 100%{opacity:0;transform:translate(-50%,-50%) scale(1.4)} }`}</style>
            <DropVideoPlayer
              streamUrl={playingDrop.streamUrl || ""}
              videoUrl={playingDrop.videoUrl}
              sourceType={playingDrop.sourceType}
              thumbnailUrl={playingDrop.thumbnailUrl}
              isActive={true}
              isNext={false}
            />
          </div>
          {playingDrop.caption && (
            <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 10000, textAlign: "center", pointerEvents: "none", width: "min(480px, 90vw)" }}>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.8)", fontSize: 13 }}>{playingDrop.caption}</p>
            </div>
          )}
        </div>
      )}

      <DeleteConfirmModal
        isOpen={!!deleteTargetId}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTargetId(null)}
        isDeleting={isDeleting}
      />
    </>
  );
}
