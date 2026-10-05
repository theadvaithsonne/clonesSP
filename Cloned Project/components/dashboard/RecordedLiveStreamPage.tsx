"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Clock, Play, Search, X, CheckCircle2, Loader2, Plus, Trash2,
  Video, Grid, List, ListPlus, Send, Check, Pencil, StickyNote,
  MoreVertical, ImageIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  getLearnInitLivestream, getLearnInit,
  getPlaylists, createPlaylist, addVideosToPlaylist, quickAddToPlaylist,
  deleteWorkshopRecording, getVideoShareLink,
  updateWorkshopRecording, uploadFile,
  type Workshop, type Playlist, type PlaylistVideoEntry,
} from "@/lib/feed-api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { voiceMemosApi, type VoiceMemo } from "@/lib/api/voice-memos";
import { API_URL } from "@/lib/api";

// AI-generated meeting notes — populated when the note-taker bot joined
// the webinar's LiveKit room, transcribed via Deepgram, and ran the
// summarizer. Surfaced inside the same notes modal as the voice-memo
// list so the host gets both in one click.
interface NoteTakerSummary {
  sessionId: string;
  status: "recording" | "transcribing" | "summarizing" | "ready" | "failed" | "not_found";
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  title?: string;
  summary?: {
    summary?: string;
    keyPoints?: string[];
    actionItems?: Array<string | { text?: string; assignee?: string }>;
    decisions?: string[];
  } | null;
}

// Helper: format seconds to HH:MM:SS
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function RecordedLiveStreamPage({ viewRole }: { viewRole?: "founder" | "customer" }) {
  const [isFounder, setIsFounder] = useState(false);
  const hasEditPermissions = isFounder && viewRole === "founder";
  const [loading, setLoading] = useState(true);
  const [completedWorkshops, setCompletedWorkshops] = useState<Workshop[]>([]);
  const [livestreamLoading, setLivestreamLoading] = useState(false);
  const [openingRecording, setOpeningRecording] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  // In-app player overlay (replaces window.open(awsUrl)). null = no preview.
  const [previewMedia, setPreviewMedia] = useState<
    { url: string; type: string; name: string } | null
  >(null);

  // Playlist state
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [addToPlaylistWorkshopId, setAddToPlaylistWorkshopId] = useState<string | null>(null);

  // Workshop delete state
  const [showDeleteWorkshopConfirm, setShowDeleteWorkshopConfirm] = useState<string | null>(null);
  const [deletingWorkshop, setDeletingWorkshop] = useState(false);

  // Notes panel state. `notesForWorkshopId` holds the workshop whose notes
  // are open in the modal; notes themselves are fetched lazily once a
  // workshop is clicked. Each memo's `meeting_context.roomId` is the
  // webinar id the host took the note inside, so this lets the host
  // review their jottings + AI summary alongside the recording.
  const [notesForWorkshopId, setNotesForWorkshopId] = useState<string | null>(null);
  const [notesForWorkshopTitle, setNotesForWorkshopTitle] = useState<string>("");
  const [notes, setNotes] = useState<VoiceMemo[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  // AI-generated summary from the note-taker bot (separate from voice memos).
  // Fetched in parallel with `notes` whenever the modal opens. The status is
  // its own little state machine; `null` means "haven't asked yet" or the
  // workshop never had a bot session.
  const [noteSummary, setNoteSummary] = useState<NoteTakerSummary | null>(null);
  const [noteSummaryLoading, setNoteSummaryLoading] = useState(false);

  // Founder-only edit dialog state. cardId is `${workshopId}__${recordingId}`.
  const [editingRecording, setEditingRecording] = useState<{
    cardId: string;
    title: string;
    description: string;
    thumbnail: string;
  } | null>(null);
  const [savingRecordingEdit, setSavingRecordingEdit] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  // Share state
  const [shareStates, setShareStates] = useState<Record<string, "idle" | "loading" | "copied">>({});

  // ── Data fetching ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const initData = await getLearnInit();
        if (cancelled) return;
        setIsFounder(initData.isFounder);
      } catch (error) {
        console.error("Error fetching init:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load livestream data once founder status is known
  useEffect(() => {
    if (loading) return;
    setLivestreamLoading(true);
    getLearnInitLivestream()
      .then((data) => {
        if (data.completedWorkshops) {
          setCompletedWorkshops(data.completedWorkshops as unknown as Workshop[]);
        }
      })
      .catch((error) => {
        console.error("Error fetching livestream data:", error);
        toast.error("Failed to load livestream recordings.");
      })
      .finally(() => setLivestreamLoading(false));
  }, [loading]);

  // Load playlists for the add-to-playlist dropdown
  const playlistsLoadedRef = useRef(false);
  useEffect(() => {
    if (loading || playlistsLoadedRef.current) return;
    playlistsLoadedRef.current = true;
    getPlaylists()
      .then((data) => setPlaylists(data.playlists || []))
      .catch((err) => console.error("Error fetching playlists:", err));
  }, [loading]);

  // Load this workshop's voice memos whenever the notes modal opens.
  // Memos are filtered server-side by meeting_context.roomId === workshop._id;
  // the upstream voice-agent endpoint added the room_id query param so we
  // don't have to enumerate the user's whole memo library.
  useEffect(() => {
    if (!notesForWorkshopId) {
      setNotes([]);
      setNotesError(null);
      return;
    }
    let cancelled = false;
    setNotesLoading(true);
    setNotesError(null);
    voiceMemosApi
      .list({ room_id: notesForWorkshopId, page_size: 100 })
      .then((resp) => {
        if (cancelled) return;
        setNotes(resp.items);
      })
      .catch((err) => {
        if (cancelled) return;
        setNotesError(err instanceof Error ? err.message : "Failed to load notes");
      })
      .finally(() => {
        if (!cancelled) setNotesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [notesForWorkshopId]);

  // Fetch the AI summary in parallel with the voice memos. The endpoint
  // returns 404 with status="not_found" when the bot never joined this
  // workshop's room — we surface that as "summary not available" without
  // treating it as a hard error. While the bot is still processing
  // (recording/transcribing/summarizing) we poll every 8s so the modal
  // updates in place when the summary lands.
  useEffect(() => {
    if (!notesForWorkshopId) {
      setNoteSummary(null);
      setNoteSummaryLoading(false);
      return;
    }
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    async function fetchSummary() {
      setNoteSummaryLoading(true);
      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("garage_tok") || ""
            : "";
        const res = await fetch(
          `${API_URL}/note-taker/by-workshop/${encodeURIComponent(notesForWorkshopId!)}/summary`,
          {
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            cache: "no-store",
          },
        );
        if (cancelled) return;
        if (res.status === 404) {
          // No bot session — render the "no AI notes for this run" state.
          setNoteSummary({ sessionId: "", status: "not_found" });
          return;
        }
        if (!res.ok) {
          setNoteSummary({ sessionId: "", status: "failed" });
          return;
        }
        const data = (await res.json()) as NoteTakerSummary;
        setNoteSummary(data);
        // Keep polling while the bot pipeline hasn't reached terminal state.
        if (data.status === "recording" || data.status === "transcribing" || data.status === "summarizing") {
          pollTimer = setTimeout(fetchSummary, 8000);
        }
      } catch {
        if (!cancelled) setNoteSummary({ sessionId: "", status: "failed" });
      } finally {
        if (!cancelled) setNoteSummaryLoading(false);
      }
    }
    fetchSummary();
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [notesForWorkshopId]);

  // ── Handlers ───────────────────────────────────────────────────

  const playWorkshopRecording = async (workshopIdOrCardId: string) => {
    setOpeningRecording(workshopIdOrCardId);
    try {
      const card = completedWorkshops.find((w) => w._id === workshopIdOrCardId) as
        | (Workshop & {
            _recordingUrl?: string;
            _workshopId?: string;
            _recordingFileId?: string;
          })
        | undefined;
      const realWorkshopId = card?._workshopId || workshopIdOrCardId;
      // Cards are compound (`workshopId__recordingId`). The right panel's share
      // button needs the recording id so the link resolves to
      // /guest/:slug/recording/:recordingId — the generic /video/:workshopId
      // page has no recording file to stream.
      const cardRecordingId =
        card?._recordingFileId ||
        (workshopIdOrCardId.includes("__")
          ? workshopIdOrCardId.split("__")[1]
          : undefined);
      if (card?._recordingUrl) {
        window.dispatchEvent(new CustomEvent("right-panel:open-video-player", {
          detail: {
            url: card._recordingUrl,
            title: card.title || "Recording",
            description: card.description || "",
            thumbnail: card.thumbnail || "",
            id: realWorkshopId,
            type: "workshop",
            recordingId: cardRecordingId || "",
          }
        }));
        return;
      }
      const token = typeof window !== "undefined" ? localStorage.getItem("garage_tok") || "" : "";
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${apiUrl}/webinar/${realWorkshopId}/recordings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { toast.error("No recordings found"); return; }
      const data = await res.json();
      const rec = data.recordings?.[0];
      const openUrl = rec?.streamUrl || rec?.downloadUrl;
      if (!openUrl) { toast.error("No recordings available for this webinar"); return; }
      window.dispatchEvent(new CustomEvent("right-panel:open-video-player", {
        detail: {
          url: openUrl,
          title: card?.title || "Webinar recording",
          description: card?.description || "",
          thumbnail: card?.thumbnail || "",
          id: realWorkshopId,
          type: "workshop",
          recordingId: rec?.id || rec?._id || cardRecordingId || "",
          // Anchor for chat replay — when the egress started, not when the
          // upload finished (those can be hours apart on a long stream).
          startedAt: rec?.startedAt || rec?.createdAt || null,
        }
      }));
    } catch {
      toast.error("Failed to load recording");
    } finally {
      setOpeningRecording(null);
    }
  };

  const handleShare = async (id: string) => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId || shareStates[id] === "loading" || shareStates[id] === "copied") return;
    setShareStates((prev) => ({ ...prev, [id]: "loading" }));
    try {
      // Card IDs are compound: workshopId__recordingId. Extract the real workshopId.
      const realWorkshopId = id.includes("__") ? id.split("__")[0] : id;
      const recordingFileId = id.includes("__") ? id.split("__")[1] : undefined;
      const { shareLink } = await getVideoShareLink(realWorkshopId, orgId, "workshop", recordingFileId);
      await navigator.clipboard.writeText(shareLink);
      setShareStates((prev) => ({ ...prev, [id]: "copied" }));
      toast.success("Share link copied! Anyone who joins through this link will be added to your network.");
      setTimeout(() => setShareStates((prev) => ({ ...prev, [id]: "idle" })), 2000);
    } catch {
      toast.error("Failed to copy share link");
      setShareStates((prev) => ({ ...prev, [id]: "idle" }));
    }
  };

  const handleDeleteWorkshopRecording = async (compoundId: string) => {
    const parts = compoundId.split("__");
    if (parts.length !== 2) { toast.error("Cannot delete: invalid recording id"); return; }
    const [workshopId, recordingId] = parts;
    setDeletingWorkshop(true);
    try {
      await deleteWorkshopRecording(workshopId, recordingId);
      setCompletedWorkshops((prev) => prev.filter((w) => w._id !== compoundId));
      setShowDeleteWorkshopConfirm(null);
      toast.success("Recording deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete recording");
    } finally {
      setDeletingWorkshop(false);
    }
  };

  // Save founder edits (title, description, thumbnail) for a single recording.
  // Cards expose a compound `${workshopId}__${recordingId}` id; we split it
  // and PATCH the recording, then mirror the change in local state.
  const handleSaveRecordingEdit = async () => {
    if (!editingRecording) return;
    const parts = editingRecording.cardId.split("__");
    if (parts.length !== 2) {
      toast.error("Cannot save: invalid recording id");
      return;
    }
    const [workshopId, recordingId] = parts;
    setSavingRecordingEdit(true);
    try {
      const res = await updateWorkshopRecording(workshopId, recordingId, {
        displayTitle: editingRecording.title,
        displayDescription: editingRecording.description,
        displayThumbnail: editingRecording.thumbnail,
      });
      if (!res.success) {
        toast.error(res.error || "Failed to save");
        return;
      }
      setCompletedWorkshops((prev) =>
        prev.map((w) =>
          w._id === editingRecording.cardId
            ? {
                ...w,
                title: editingRecording.title.trim() || w.title,
                description:
                  editingRecording.description.trim() || w.description,
                thumbnail:
                  editingRecording.thumbnail.trim() || w.thumbnail,
              }
            : w
        )
      );
      setEditingRecording(null);
      toast.success("Recording updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update recording");
    } finally {
      setSavingRecordingEdit(false);
    }
  };

  // Upload a new thumbnail and stash its URL in the in-progress edit state.
  // The save button then PATCHes that URL onto the recording.
  const handleThumbnailUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image file");
      return;
    }
    setUploadingThumbnail(true);
    try {
      const res = await uploadFile(file);
      if (!res?.url) { toast.error("Upload failed"); return; }
      setEditingRecording((prev) =>
        prev ? { ...prev, thumbnail: res.url } : prev
      );
      toast.success("Thumbnail uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const handleAddVideoToPlaylist = async (playlistId: string, videoEntry: PlaylistVideoEntry) => {
    try {
      const result = await addVideosToPlaylist(playlistId, [videoEntry]);
      setPlaylists((prev) => prev.map((p) => (p._id === playlistId ? result.playlist : p)));
      setAddToPlaylistWorkshopId(null);
      toast.success("Video added to playlist!");
    } catch (error: any) {
      toast.error(error.message || "Failed to add video");
    }
  };

  const handleLearnerQuickAdd = async (videoEntry: PlaylistVideoEntry) => {
    try {
      const result = await quickAddToPlaylist(videoEntry);
      if (result.playlist) {
        setPlaylists((prev) => {
          const idx = prev.findIndex((p) => p._id === result.playlist._id);
          if (idx >= 0) return prev.map((p) => (p._id === result.playlist._id ? result.playlist : p));
          return [result.playlist, ...prev];
        });
      }
      toast.success("Added to My Playlist!");
    } catch (error: any) {
      toast.error(error.message || "Failed to add to playlist");
    }
  };

  // ── ShareButton helper ─────────────────────────────────────────
  const ShareButton = ({ id, onClick }: { id: string; onClick: (e: React.MouseEvent) => void }) => {
    const state = shareStates[id];
    return (
      <button
        onClick={onClick}
        className={`p-1.5 rounded-lg border border-[#2a2a35] transition-colors ${state === "copied" ? "text-green-400 border-green-400/30" : "text-[#9fa0b8] hover:text-[#1D9BF0] hover:border-[#1D9BF0]/30"}`}
        title="Copy share link"
      >
        {state === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : state === "copied" ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
      </button>
    );
  };

  // ── Loading / Empty ────────────────────────────────────────────
  if (loading || livestreamLoading) {
    return (
      <div className="w-full flex-1 min-h-screen flex flex-col bg-[#0e0e12]">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-brand animate-spin mb-4" />
          <p className="text-[#9fa0b8]">Loading livestream recordings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 min-h-screen flex flex-col bg-[#0e0e12]">
      {/* Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 pt-6 flex-1">
          {completedWorkshops.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center h-full">
              <Video className="h-12 w-12 text-[#9fa0b8] mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Recordings</h3>
              <p className="text-[#9fa0b8]">No completed live streams available yet.</p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 min-[1800px]:grid-cols-5 gap-6 w-full">
              {completedWorkshops.map((workshop) => (
                <div
                  key={workshop._id}
                  onClick={() => playWorkshopRecording(workshop._id)}
                  className="flex flex-col h-full group @container cursor-pointer bg-transparent border-none p-0"
                >
                  <div className="w-full aspect-video bg-[#1a1a22] relative flex-shrink-0 overflow-hidden rounded-2xl text-left">
                    {workshop.thumbnail ? (
                      <img src={workshop.thumbnail} alt={workshop.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="h-12 w-12 text-[#9fa0b8]" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                      {openingRecording === workshop._id ? (
                        <Loader2 className="w-12 h-12 text-brand animate-spin" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300 shadow-[0_0_15px] shadow-brand/40">
                          <Play className="w-5 h-5 text-brand-foreground fill-current ml-0.5" />
                        </div>
                      )}
                    </div>
                    <div className="absolute top-2.5 left-2.5 bg-green-500/80 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 z-20">
                      <CheckCircle2 className="h-3 w-3" />
                      Completed
                    </div>
                    {workshop.duration && (
                      <div className="absolute bottom-2.5 right-2.5 bg-black/75 text-white text-[11px] px-2 py-0.5 rounded-md font-medium z-20">
                        {(() => {
                          const val = workshop.duration;
                          if (typeof val === "string" && val.includes(":")) return val;
                          const num = Number(val);
                          if (!isNaN(num) && num > 0) {
                            return formatDuration(num < 360 ? num * 60 : num);
                          }
                          return String(val);
                        })()}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex flex-col flex-1">
                    <h3 className="text-white text-base font-semibold line-clamp-2 mb-1 group-hover:text-brand transition-colors">{workshop.title}</h3>
                    {workshop.description && (
                      <p className="text-xs text-[#9fa0b8] line-clamp-2 mb-2 leading-relaxed [&_a]:pointer-events-none" dangerouslySetInnerHTML={{ __html: workshop.description }} />
                    )}
                    <div className="mt-auto pt-2 flex items-center justify-between text-[11px] text-[#5a5a6a] font-medium">
                      <span>
                        {new Date(workshop.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} at {new Date(workshop.date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </span>
                      {hasEditPermissions && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="w-7 h-7 flex items-center justify-center rounded-full border border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:border-[#3a3a45] hover:bg-white/5 transition-all duration-200 cursor-pointer">
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[#1a1a22] border-[#2a2a35] text-white">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingRecording({
                                    cardId: workshop._id,
                                    title: workshop.title || "",
                                    description: (workshop.description || "").replace(/<[^>]*>/g, ""),
                                    thumbnail: workshop.thumbnail || "",
                                  });
                                }}
                              >
                                <Pencil className="w-4 h-4 mr-2" /> Edit Info
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); setShowDeleteWorkshopConfirm(workshop._id); }}
                                className="text-red-400 focus:text-red-400"
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {completedWorkshops.map((workshop) => (
                <div
                  key={workshop._id}
                  onClick={() => playWorkshopRecording(workshop._id)}
                  className="flex flex-col @sm:flex-row gap-4 group @container cursor-pointer bg-transparent border-none p-0 py-3 border-b border-[#1a1a24]/40"
                >
                  <div className="w-full @sm:w-48 aspect-video @sm:h-28 bg-[#1a1a22] rounded-2xl relative overflow-hidden flex-shrink-0 group">
                    {workshop.thumbnail ? (
                      <img src={workshop.thumbnail} alt={workshop.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="h-8 w-8 text-[#9fa0b8]" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                      {openingRecording === workshop._id ? (
                        <Loader2 className="w-8 h-8 text-brand animate-spin" />
                      ) : (
                        <Play className="w-12 h-12 @sm:w-8 @sm:h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                    <div className="absolute top-2 left-2 bg-green-500/80 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 z-20">
                      <CheckCircle2 className="h-3 w-3" />
                      Completed
                    </div>
                    {workshop.duration && (
                      <div className="absolute bottom-2 right-2 bg-black/75 text-white text-[10px] px-1.5 py-0.5 rounded font-medium z-20">
                        {(() => {
                          const val = workshop.duration;
                          if (typeof val === "string" && val.includes(":")) return val;
                          const num = Number(val);
                          if (!isNaN(num) && num > 0) {
                            return formatDuration(num < 360 ? num * 60 : num);
                          }
                          return String(val);
                        })()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    <h3 className="text-white text-base font-semibold mb-1 line-clamp-1 group-hover:text-brand transition-colors">{workshop.title}</h3>
                    {workshop.description && (
                      <p className="text-xs text-[#9fa0b8] line-clamp-2 mb-2 leading-relaxed [&_a]:pointer-events-none" dangerouslySetInnerHTML={{ __html: workshop.description }} />
                    )}
                    <div className="mt-auto pt-2 flex items-center justify-between text-[11px] text-[#5a5a6a] font-medium">
                      <span>
                        {new Date(workshop.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} at {new Date(workshop.date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </span>
                      {hasEditPermissions && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="w-7 h-7 flex items-center justify-center rounded-full border border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:border-[#3a3a45] hover:bg-white/5 transition-all duration-200 cursor-pointer">
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[#1a1a22] border-[#2a2a35] text-white">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingRecording({
                                    cardId: workshop._id,
                                    title: workshop.title || "",
                                    description: (workshop.description || "").replace(/<[^>]*>/g, ""),
                                    thumbnail: workshop.thumbnail || "",
                                  });
                                }}
                              >
                                <Pencil className="w-4 h-4 mr-2" /> Edit Info
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); setShowDeleteWorkshopConfirm(workshop._id); }}
                                className="text-red-400 focus:text-red-400"
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {/* Edit Live Stream Recording Details (founder-only) */}
      {editingRecording && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !savingRecordingEdit && setEditingRecording(null)}
          />
          <div className="relative bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-1">Edit recording</h3>
            <p className="text-xs text-[#9fa0b8] mb-5">
              These overrides apply only to this recording — they don&apos;t change the workshop itself.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#9fa0b8] mb-1.5">Title</label>
                <input
                  type="text"
                  maxLength={200}
                  value={editingRecording.title}
                  onChange={(e) => setEditingRecording((r) => r ? { ...r, title: e.target.value } : r)}
                  placeholder="e.g. Q1 Town Hall recording"
                  className="w-full bg-[#1a1a22] border border-[#2a2a35] rounded-lg px-3 py-2 text-sm text-white placeholder-[#5a5a6a] outline-none focus:border-brand/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9fa0b8] mb-1.5">Description</label>
                <textarea
                  rows={4}
                  maxLength={2000}
                  value={editingRecording.description}
                  onChange={(e) => setEditingRecording((r) => r ? { ...r, description: e.target.value } : r)}
                  placeholder="What's this recording about?"
                  className="w-full bg-[#1a1a22] border border-[#2a2a35] rounded-lg px-3 py-2 text-sm text-white placeholder-[#5a5a6a] outline-none focus:border-brand/50 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9fa0b8] mb-1.5">Thumbnail</label>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-20 rounded-lg bg-[#1a1a22] border border-[#2a2a35] overflow-hidden flex-shrink-0 relative">
                    {editingRecording.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={editingRecording.thumbnail}
                        alt="thumbnail preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#5a5a6a] text-[10px]">
                        No thumbnail
                      </div>
                    )}
                    {uploadingThumbnail && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <label className="cursor-pointer inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#9fa0b8] hover:text-white border border-[#2a2a35] hover:border-[#3a3a45] transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingThumbnail || savingRecordingEdit}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleThumbnailUpload(file);
                          e.target.value = "";
                        }}
                      />
                      {uploadingThumbnail ? "Uploading…" : "Upload image"}
                    </label>
                    {editingRecording.thumbnail && (
                      <button
                        type="button"
                        disabled={uploadingThumbnail || savingRecordingEdit}
                        onClick={() =>
                          setEditingRecording((r) =>
                            r ? { ...r, thumbnail: "" } : r
                          )
                        }
                        className="px-3 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-400/40 transition-colors disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-[#5a5a6a] mt-1.5">
                  16:9 looks best. PNG or JPG.
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                disabled={savingRecordingEdit}
                onClick={() => setEditingRecording(null)}
                className="px-4 py-2 rounded-lg text-sm text-[#9fa0b8] hover:text-white border border-[#2a2a35] hover:border-[#3a3a45] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={savingRecordingEdit}
                onClick={handleSaveRecordingEdit}
                className="px-4 py-2 rounded-lg text-sm bg-brand text-brand-foreground font-medium hover:bg-brand/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {savingRecordingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Workshop Recording Confirmation */}
      {showDeleteWorkshopConfirm && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !deletingWorkshop && setShowDeleteWorkshopConfirm(null)} />
          <div className="relative bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Recording?</h3>
            <p className="text-sm text-[#9fa0b8] mb-6">
              This permanently removes the live stream recording and its video file. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                disabled={deletingWorkshop}
                onClick={() => setShowDeleteWorkshopConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm text-[#9fa0b8] hover:text-white border border-[#2a2a35] hover:border-[#3a3a45] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={deletingWorkshop}
                onClick={() => handleDeleteWorkshopRecording(showDeleteWorkshopConfirm)}
                className="px-4 py-2 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deletingWorkshop && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add to Playlist Dropdown */}
      {addToPlaylistWorkshopId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAddToPlaylistWorkshopId(null)} />
          <div className="relative bg-[#0e0e12] border border-[#2a2a35] rounded-xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a35]">
              <h3 className="text-sm font-semibold text-white">Add to Playlist</h3>
              <button onClick={() => setAddToPlaylistWorkshopId(null)} className="p-1 rounded text-[#9fa0b8] hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 max-h-64 overflow-y-auto">
              {playlists.length > 0 ? (
                <div className="space-y-1">
                  {playlists
                    .filter((p) => (hasEditPermissions ? p.type === "founder" : p.type === "learner"))
                    .map((playlist) => {
                      const alreadyAdded = playlist.videoEntries?.some((e) => e.videoId === addToPlaylistWorkshopId) || playlist.videoIds?.includes(addToPlaylistWorkshopId);
                      return (
                        <button
                          key={playlist._id}
                          onClick={() => !alreadyAdded && handleAddVideoToPlaylist(playlist._id, { videoSource: "workshop", videoId: addToPlaylistWorkshopId })}
                          disabled={alreadyAdded}
                          className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between gap-2 transition-colors ${
                            alreadyAdded ? "bg-green-500/10 text-green-400 cursor-default" : "hover:bg-[#1a1a22] text-white"
                          }`}
                        >
                          <span className="text-sm truncate">{playlist.title}</span>
                          {alreadyAdded ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-green-400" /> : <Plus className="w-4 h-4 flex-shrink-0 text-[#9fa0b8]" />}
                        </button>
                      );
                    })}
                </div>
              ) : (
                <p className="text-sm text-[#9fa0b8] text-center py-4">No playlists yet.</p>
              )}
            </div>
          </div>
        </div>
      )}



      {/* Notes modal — opens when the host clicks the StickyNote button on a
          recording card. Lists every voice memo captured during the webinar
          (matched by meeting_context.roomId === workshop._id) with title,
          summary, key points, action items, and the raw transcript on a
          per-memo expand. Read-only by design — editing memos lives in the
          dedicated Voice Memos surface; this view is for reviewing alongside
          the recording. */}
      {notesForWorkshopId && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setNotesForWorkshopId(null)}
        >
          <div
            className="bg-[#111116] border border-[#2a2a35] rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a35] shrink-0">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <StickyNote className="w-4 h-4 text-brand" />
                  Notes from this webinar
                </h2>
                <p className="text-[11px] text-[#9fa0b8] truncate">{notesForWorkshopTitle}</p>
              </div>
              <button
                onClick={() => setNotesForWorkshopId(null)}
                className="p-1.5 rounded-lg text-[#9fa0b8] hover:text-white hover:bg-white/[0.06] transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* AI-generated webinar summary — appears first because it covers
                  the whole call, not a single moment like voice memos do. */}
              <AiNotesSection summary={noteSummary} loading={noteSummaryLoading} />

              {/* Per-moment voice memos the host tapped to record. */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-[#5a5a72]">
                  <StickyNote className="w-3 h-3" />
                  Voice memos
                </div>
                {notesLoading ? (
                  <div className="flex items-center gap-2 py-6 justify-center text-[#9fa0b8] text-xs">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading voice memos…
                  </div>
                ) : notesError ? (
                  <p className="text-xs text-red-300 py-4 text-center">{notesError}</p>
                ) : notes.length === 0 ? (
                  <div className="py-6 text-center border border-dashed border-[#2a2a35] rounded-lg">
                    <p className="text-xs text-[#9fa0b8] max-w-sm mx-auto">
                      No voice memos for this webinar. Tap the sticky-note button
                      on the meeting control bar during a webinar to capture one.
                    </p>
                  </div>
                ) : (
                  notes.map((memo) => <MemoCard key={memo.id} memo={memo} />)
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

/**
 * AI-generated webinar summary block. Renders the small state machine that
 * sits above the voice-memos list inside the notes modal:
 *
 *   - "recording"       : the bot is still in the room — show a live badge
 *   - "transcribing"    : Deepgram is still chewing the audio
 *   - "summarizing"     : LLM is composing the summary
 *   - "ready"           : full summary + key points + action items
 *   - "failed"          : pipeline tripped — render a small inline error
 *   - "not_found"       : no bot session for this run — silent (the modal
 *                         still shows voice memos below it)
 *
 * Returns null on `not_found` so the modal header doesn't look like there's
 * an empty box when the bot just never joined.
 */
function AiNotesSection({
  summary,
  loading,
}: {
  summary: NoteTakerSummary | null;
  loading: boolean;
}) {
  // Initial load — nothing to render yet.
  if (loading && !summary) {
    return (
      <div className="rounded-xl border border-[#2a2a35] bg-[#15151b] p-4 flex items-center gap-2 text-xs text-[#9fa0b8]">
        <Loader2 className="w-4 h-4 animate-spin" />
        Checking for AI notes…
      </div>
    );
  }
  if (!summary || summary.status === "not_found") return null;

  if (summary.status === "failed") {
    return (
      <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-4 text-xs text-red-300">
        AI notes failed to generate for this webinar. The host can still
        review voice memos below.
      </div>
    );
  }

  if (summary.status !== "ready" || !summary.summary) {
    const label =
      summary.status === "recording"
        ? "Recording in progress — notes will appear here when the webinar ends."
        : summary.status === "transcribing"
          ? "Transcribing the audio…"
          : "Composing the summary…";
    return (
      <div className="rounded-xl border border-[#2a2a35] bg-[#15151b] p-4 flex items-center gap-2 text-xs text-[#9fa0b8]">
        <Loader2 className="w-4 h-4 animate-spin text-brand" />
        {label}
      </div>
    );
  }

  const s = summary.summary;
  // Normalize action items — Garage's NoteSummary can store them as plain
  // strings or as `{ text, assignee }` objects depending on how the
  // summarizer prompt is set. Either shape lands in the same list with a
  // best-effort label.
  const actionItems = (s.actionItems || []).map((it) =>
    typeof it === "string" ? it : it.text || JSON.stringify(it),
  );

  return (
    <div className="rounded-xl border border-brand/25 bg-brand/[0.04] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <StickyNote className="w-3.5 h-3.5 text-brand" />
        <span className="text-[11px] uppercase tracking-wider font-semibold text-brand">
          AI meeting notes
        </span>
      </div>

      {s.summary && (
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-[#9fa0b8] mb-1">
            Summary
          </p>
          <p className="text-sm text-white whitespace-pre-line">{s.summary}</p>
        </div>
      )}

      {s.keyPoints && s.keyPoints.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-[#9fa0b8] mb-1">
            Key points
          </p>
          <ul className="space-y-1 text-sm text-zinc-200 list-disc list-inside marker:text-brand">
            {s.keyPoints.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {actionItems.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-[#9fa0b8] mb-1">
            Action items
          </p>
          <ul className="space-y-1 text-sm text-zinc-200 list-disc list-inside marker:text-brand">
            {actionItems.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul>
        </div>
      )}

      {s.decisions && s.decisions.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-[#9fa0b8] mb-1">
            Decisions
          </p>
          <ul className="space-y-1 text-sm text-zinc-200 list-disc list-inside marker:text-brand">
            {s.decisions.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Single-memo card inside the Notes modal. Shows title + recorded-at on top,
 * AI summary (if processed), key points and action items as lists, and a
 * collapsible raw transcript. Processing status badges surface when the memo
 * is still queued / transcribing / summarising so the host knows the
 * placeholder isn't broken — just not finished.
 */
function MemoCard({ memo }: { memo: VoiceMemo }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const recordedAt = memo.recorded_at || memo.created_at;
  const stillProcessing =
    memo.status === "queued" ||
    memo.status === "transcribing" ||
    memo.status === "summarizing";

  return (
    <div className="rounded-xl border border-[#2a2a35] bg-[#15151b] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">
            {memo.title || "Untitled note"}
          </h3>
          <p className="text-[11px] text-[#5a5a72]">
            {new Date(recordedAt).toLocaleString([], {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        {stillProcessing && (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
            <Loader2 className="w-3 h-3 animate-spin" />
            {memo.status}
          </span>
        )}
        {memo.status === "failed" && (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-300">
            Failed
          </span>
        )}
      </div>

      {memo.summary && (
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-[#9fa0b8] mb-1">
            Summary
          </p>
          <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap">
            {memo.summary}
          </p>
        </div>
      )}

      {memo.key_points && memo.key_points.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-[#9fa0b8] mb-1">
            Key points
          </p>
          <ul className="text-xs text-zinc-200 list-disc list-inside space-y-0.5">
            {memo.key_points.map((pt, i) => (
              <li key={i}>{pt}</li>
            ))}
          </ul>
        </div>
      )}

      {memo.action_items && memo.action_items.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-[#9fa0b8] mb-1">
            Action items
          </p>
          <ul className="text-xs text-zinc-200 list-disc list-inside space-y-0.5">
            {memo.action_items.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul>
        </div>
      )}

      {memo.transcript && (
        <div>
          <button
            type="button"
            onClick={() => setShowTranscript((v) => !v)}
            className="text-[11px] text-brand hover:text-brand/80 transition-colors font-medium"
          >
            {showTranscript ? "Hide transcript" : "Show full transcript"}
          </button>
          {showTranscript && (
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto pr-1">
              {memo.transcript}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
