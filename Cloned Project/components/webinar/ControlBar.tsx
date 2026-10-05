"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  Hand,
  Circle,
  PhoneOff,
  Smile,
  Square,
  ShoppingBag,
  Sparkles,
  StickyNote,
  PictureInPicture2,
} from "lucide-react";
import type { Room } from "livekit-client";
import useWebinarStore from "@/store/webinarStore";
import { toast } from "sonner";
import type { Socket } from "socket.io-client";
import ProductPickerDialog from "./ProductPickerDialog";
import VirtualBackgroundPicker from "./VirtualBackgroundPicker";
import MediaSplitButton from "./MediaSplitButton";
import SpeakerButton from "./SpeakerButton";
import VoiceMemoPanel from "../voice-memos/VoiceMemoPanel";
import { useVirtualBackground } from "@/hooks/webinar/useVirtualBackground";
import type { Sellable } from "@/lib/feed-api";
import { startAuctionRound, type AuctionRoundConfig } from "@/lib/api/auctions";
import { announceLotChange } from "@/lib/webinar/bid-channel";
import {
  GLASS_BAR,
  GLASS_BTN_ACTIVE_BLUE,
  GLASS_BTN_ACTIVE_GREEN,
  GLASS_BTN_ACTIVE_RED,
  GLASS_BTN_ACTIVE_YELLOW,
  GLASS_BTN_BASE,
  GLASS_BTN_DANGER,
  GLASS_BTN_DISABLED,
  GLASS_BTN_IDLE,
  GLASS_BTN_MUTED,
  GLASS_BTN_SIZE,
  GLASS_CAPTION,
  GLASS_MENU,
} from "./glass";

/* ── Mic level VU meter ───────────────────────────────────────────────────── */

/**
 * Google-Meet-style multiband bars rendered inside the mic button. Three
 * thin bars (low / mid / high freq band) move independently so it reads as
 * audio even when the room is quiet — a single RMS produces three bars
 * that all move in lockstep and looks dead. NC ships the same component
 * shape, this is the non-LiveKit-React equivalent (Garage's webinar uses
 * a raw socket + LiveKit Room, so we can't drop in `useMultibandTrackVolume`
 * from `@livekit/components-react`).
 *
 * Update interval ~80ms (12.5fps) — slow enough that React doesn't
 * re-render every animation frame, fast enough to feel reactive.
 */
function MicLevelMeter() {
  const localStream = useWebinarStore((s) => s.localStream);
  const micEnabled = useWebinarStore((s) => s.micEnabled);
  // One number per band (low, mid, high), each in [0, 1].
  const [levels, setLevels] = useState<[number, number, number]>([0, 0, 0]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!localStream || !micEnabled) {
      setLevels([0, 0, 0]);
      return;
    }

    const audioCtx = new AudioContext();
    const src = audioCtx.createMediaStreamSource(localStream);
    // Three parallel analysers — each fed through a bandpass filter so the
    // bars react independently to low, mid, and high frequency content.
    // Cheaper than running one FFT and slicing buckets, and visually
    // cleaner because filter rolloff smooths frequency leakage between
    // bands.
    const sampleRate = audioCtx.sampleRate;
    const bandCenters = [120, 600, 2400]; // Hz: lo / mid / hi
    const analysers = bandCenters.map((freq) => {
      const filter = audioCtx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = freq;
      filter.Q.value = 1.0;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(filter).connect(analyser);
      return analyser;
    });
    void sampleRate; // touched for clarity; not used further

    const buffers = analysers.map(
      (a) => new Uint8Array(a.frequencyBinCount),
    );

    let running = true;
    let lastTick = 0;
    const tick = (now: number) => {
      if (!running) return;
      // Throttle setState to ~80ms; rAF still drives the loop so cleanup
      // is well-behaved when the user navigates away mid-frame.
      if (now - lastTick >= 80) {
        const computed = analysers.map((analyser, i) => {
          analyser.getByteFrequencyData(buffers[i]);
          const sum = buffers[i].reduce((a, b) => a + b, 0);
          return Math.min(1, sum / buffers[i].length / 128);
        }) as [number, number, number];
        setLevels(computed);
        lastTick = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try {
        audioCtx.close();
      } catch {
        /* ignore */
      }
    };
  }, [localStream, micEnabled]);

  if (!localStream || !micEnabled) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-1.5 flex items-end justify-center gap-[3px]">
      {levels.map((lvl, i) => {
        // 2px baseline so a quiet room still shows the bars exist; cap
        // around 9px so loud peaks never collide with the mic icon
        // (h-5 = 20px icon, centered in the 40/44px button).
        const h = Math.round(2 + Math.min(1, lvl * 2.5) * 7);
        return (
          <span
            key={i}
            className="w-[3px] rounded-full bg-current opacity-90 transition-[height] duration-75 ease-out"
            style={{ height: `${h}px` }}
          />
        );
      })}
    </div>
  );
}

/* ── Reaction Emojis ──────────────────────────────────────────────────────── */

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "👏", "🔥", "🎉", "💯"];

/** How long the pointer has to sit still before the bar fades out. */
const IDLE_MS = 2500;

/** Width of the portalled background picker (w-72), used to clamp it on screen. */
const POPOVER_WIDTH = 288;

/** The bar allows exactly one open popover; `null` means none. */
type MenuId = "mic" | "cam" | "speaker" | "reactions" | "memos" | "background" | null;

/* ── ControlBar ───────────────────────────────────────────────────────────── */

interface ControlBarProps {
  socket: Socket | null;
  webinarId: string;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onShareScreen: () => Promise<void>;
  onStartMedia: () => Promise<void>;
  mediaStarted: boolean;
  /**
   * Socket connection state. No longer rendered in the bar (the header
   * already shows LIVE / RECONNECTING), kept on the interface so the page
   * doesn't need to change what it passes.
   */
  connected?: boolean;
  /**
   * True once the LiveKit room.connect() has resolved. Until then the
   * Join button stays disabled — clicking too early triggers
   * room.localParticipant.setMicrophoneEnabled() against a null room
   * and surfaces "LiveKit room not connected" to the user.
   */
  roomReady?: boolean;
  recordingMode?: "manual" | "automatic";
  /**
   * Accessor for the underlying LiveKit Room. Provided by useWebinarLiveKit
   * so feature hooks (virtual background) can read the local camera track
   * without needing a `<LiveKitRoom>` provider context.
   */
  getRoom?: () => Room | null;
  /** Device-selection helpers from useWebinarLiveKit. Optional. */
  listMediaDevices?: () => Promise<{
    videoinput: MediaDeviceInfo[];
    audioinput: MediaDeviceInfo[];
    audiooutput?: MediaDeviceInfo[];
  }>;
  setVideoDevice?: (deviceId: string) => Promise<void>;
  setAudioDevice?: (deviceId: string) => Promise<void>;
  /** Set the speaker (audio-output) sink for every audio/video element
   *  attached by LiveKit. Optional — when omitted, the mic dropdown
   *  shows mic devices only (no Speaker section). */
  setOutputDevice?: (deviceId: string) => Promise<void>;
  /** Open the Picture-in-Picture window. Hook is owned by the page so the
   *  bar just gets the trigger + a flag for whether the browser supports it. */
  onOpenPip?: () => void | Promise<void>;
  isPipSupported?: boolean;
  /** Pin the bar open — no idle fade-out. Used by Bat246/gotobigwin, whose
   *  rooms are run with everyone able to speak, so the mic and camera buttons
   *  have to be reachable without first moving the pointer to summon them
   *  (which is impossible to discover on a touch device). */
  alwaysVisible?: boolean;
  /**
   * Bat246/gotobigwin only. Their presenters (host and every co-host —
   * everyone holding the no-login "05" link or a panelist/co-host link
   * comes in with mic/cam controls, not just the seat-owning host) skew
   * older and less technical. Two changes when this is set:
   *   1. Picking a device from the mic/cam split-button's dropdown also
   *      turns the mic/cam ON if it was off — previously picking a
   *      device only switched which one was active, leaving someone who
   *      opened the dropdown looking for "how do I turn my mic on"
   *      still muted with no feedback that nothing happened.
   *   2. The split button gets a visible divider between its toggle
   *      half and its device-list chevron, so an imprecise click is
   *      less likely to land on the chevron by accident.
   */
  isGotobigwin?: boolean;
}

export default function ControlBar({
  socket,
  webinarId,
  onToggleMic,
  onToggleCam,
  onShareScreen,
  onStartMedia,
  mediaStarted,
  roomReady = true,
  recordingMode = "manual",
  getRoom,
  listMediaDevices,
  setVideoDevice,
  setAudioDevice,
  setOutputDevice,
  onOpenPip,
  isPipSupported,
  alwaysVisible = false,
  isGotobigwin = false,
}: ControlBarProps) {
  const router = useRouter();
  const role = useWebinarStore((s) => s.role);
  const micEnabled = useWebinarStore((s) => s.micEnabled);
  const camEnabled = useWebinarStore((s) => s.camEnabled);
  const screenSharing = useWebinarStore((s) => s.screenSharing);
  const isRecording = useWebinarStore((s) => s.isRecording);
  const handRaised = useWebinarStore((s) => s.handRaised);

  const [elapsed, setElapsed] = useState(0);
  const [showProductPicker, setShowProductPicker] = useState(false);
  /* One popover at a time. Every dropdown in the bar (device pickers,
     reactions, memos, background) is controlled from this single slot, so
     opening one always closes whatever was open before instead of stacking
     two overlapping panels. It also drives the auto-hide timer, which stays
     pinned while any menu is on screen. */
  const [activeMenu, setActiveMenu] = useState<MenuId>(null);
  const closeMenus = useCallback(() => setActiveMenu(null), []);
  const toggleMenu = useCallback(
    (id: Exclude<MenuId, null>) =>
      setActiveMenu((cur) => (cur === id ? null : id)),
    [],
  );
  // Stable per-menu setters for the controlled split buttons.
  const setMicMenu = useCallback(
    (open: boolean) => setActiveMenu(open ? "mic" : null),
    [],
  );
  const setCamMenu = useCallback(
    (open: boolean) => setActiveMenu(open ? "cam" : null),
    [],
  );
  const setSpeakerMenu = useCallback(
    (open: boolean) => setActiveMenu(open ? "speaker" : null),
    [],
  );
  const showReactions = activeMenu === "reactions";
  const showVoiceMemos = activeMenu === "memos";
  const showBackgroundPicker = activeMenu === "background";
  // Trigger + measured viewport position for the portalled background picker.
  const bgButtonRef = useRef<HTMLButtonElement>(null);
  const [bgAnchor, setBgAnchor] = useState<{ left: number; bottom: number } | null>(
    null,
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Virtual background — only meaningful for presenters with a live camera.
  // The hook is safe to call regardless: when getRoom returns null, every
  // operation no-ops.
  const virtualBg = useVirtualBackground(getRoom ?? (() => null));

  // Client-side recorder — captures locally for a download copy only.
  // No upload. Server-side handles the authoritative upload to S3.
  const clientRecorderRef = useRef<MediaRecorder | null>(null);
  const clientChunksRef = useRef<Blob[]>([]);
  const clientAudioCtxRef = useRef<AudioContext | null>(null);
  const clientCapturedTracksRef = useRef<MediaStreamTrack[]>([]);

  /* ── Auto-hide ─────────────────────────────────────────────────────────
     The bar floats over the video stage, so it has to get out of the way
     when nobody is driving it. Pointer movement anywhere in the stage (the
     parent element we're absolutely positioned inside) wakes it; IDLE_MS of
     stillness — or the pointer leaving the stage entirely — puts it back to
     sleep. Any open menu overrides the timer via `visible` below. */
  const [awake, setAwake] = useState(true);
  const barRef = useRef<HTMLDivElement>(null);
  // Exposed so closing a menu restarts the idle countdown instead of the bar
  // snapping shut the instant the popover unmounts.
  const wakeRef = useRef<() => void>(() => {});

  useEffect(() => {
    // Pinned open: never arm the idle timer, and don't listen for wake events.
    if (alwaysVisible) {
      setAwake(true);
      return;
    }
    const host = barRef.current?.parentElement;
    if (!host) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const sleepSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setAwake(false), IDLE_MS);
    };
    const wake = () => {
      setAwake(true);
      sleepSoon();
    };
    const leave = () => {
      if (timer) clearTimeout(timer);
      setAwake(false);
    };
    wakeRef.current = wake;
    // Start visible on mount, then fade out on the first idle window so a
    // host landing in the room can see the controls without hunting for them.
    sleepSoon();
    host.addEventListener("mousemove", wake);
    host.addEventListener("mouseleave", leave);
    host.addEventListener("touchstart", wake, { passive: true });
    return () => {
      if (timer) clearTimeout(timer);
      wakeRef.current = () => {};
      host.removeEventListener("mousemove", wake);
      host.removeEventListener("mouseleave", leave);
      host.removeEventListener("touchstart", wake);
    };
  }, [alwaysVisible]);

  const menuOpen = activeMenu !== null || showProductPicker;

  // Restart the idle countdown when the last menu closes.
  useEffect(() => {
    if (!menuOpen) wakeRef.current();
  }, [menuOpen]);

  const visible = alwaysVisible || awake || menuOpen;

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((t) => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setElapsed(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [isRecording]);

  // Local recording is now driven server-side by LiveKit Composite Egress —
  // when the host stops, the backend emits `webinar:recordingReady` with a
  // presigned download URL of the grid MP4 and the page auto-downloads it.
  // The legacy client-side MediaRecorder below is left in place but
  // disabled (kept for potential fallback / debugging).
  const clientActiveRef = useRef(false);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const isPresenter = role === "host" || role === "panelist";

  const handleLeave = () => {
    if (!confirm("Leave the webinar?")) return;
    socket?.emit("webinar:leaveRoom", { webinarId });
    router.push("/");
  };

  const handleEndWebinar = () => {
    if (!confirm("End the webinar for everyone?")) return;
    socket?.emit(
      "webinar:endWebinar",
      { webinarId },
      (res: { success: boolean; error?: string }) => {
        if (!res?.success) toast.error("Could not end webinar: " + res?.error);
      }
    );
  };

  const handleRaiseHand = () => {
    socket?.emit("webinar:raiseHand", { webinarId });
    const current = useWebinarStore.getState().handRaised;
    useWebinarStore.getState().setHandRaised(!current);
  };

  const sendReaction = (emoji: string) => {
    socket?.emit("webinar:sendReaction", { webinarId, emoji });
    // Fly it immediately instead of waiting for the server to echo it
    // back — the sender should never tap an emoji and see nothing. The
    // echo carrying our own socketId is dropped in WebinarRoomClient, so
    // this stays a single emoji, not a double.
    useWebinarStore.getState().addReaction({
      id: `self-${Date.now()}-${Math.random()}`,
      name: "You",
      emoji,
    });
    closeMenus();
  };

  const handlePickProduct = (
    item: Sellable,
    durationMinutes: number | null,
    auction?: AuctionRoundConfig
  ) => {
    socket?.emit(
      "webinar:pinProduct",
      {
        webinarId,
        itemType: item.itemType,
        itemId: item.itemId,
        durationMinutes,
      },
      (res: { success: boolean; error?: string }) => {
        if (!res?.success) {
          toast.error("Could not pin item: " + (res?.error || "unknown"));
          return;
        }
        // Round opens only after the pin lands. The lot is read off whatever is
        // pinned, so a round started first would go live against an item the
        // room can't see yet.
        if (auction) openRound(item.itemId, auction);
      }
    );
  };

  /**
   * Put the pinned item on the block. The write is the store backend's — it
   * wipes whatever a previous round left on the product and opens a fresh
   * window — and the announce is what makes every viewer's card flip from Buy
   * Now to a live lot without waiting out their poll.
   */
  const openRound = async (productId: string, config: AuctionRoundConfig) => {
    try {
      await startAuctionRound(productId, config);
      announceLotChange({ productId, room: getRoom?.() ?? null, socket, webinarId });
      toast.success("Auction is live — bids are open");
    } catch (err) {
      // The item is pinned and sellable either way; only the round failed.
      toast.error((err as Error)?.message || "Couldn't start the auction");
    }
  };

  // ── Recording: dual path ────────────────────────────────────────────
  // 1) SERVER-SIDE: mediasoup → FFmpeg → S3 (authoritative upload).
  // 2) CLIENT-SIDE: local MediaRecorder on host's tracks, downloads WebM
  //    to host's machine when stopped. No upload — the server copy is the
  //    cloud record. This is just a local safety copy the host keeps.
  const startClientRecorder = async (): Promise<void> => {
    try {
      const { localStream, screenStream } = useWebinarStore.getState();

      // Prefer screen over camera for the local download copy
      const videoTrack =
        screenStream?.getVideoTracks().find((t) => t.readyState === "live") ||
        localStream?.getVideoTracks().find((t) => t.readyState === "live");

      if (!videoTrack) {
        console.warn("[ClientRec] No video track to record locally");
        return;
      }

      // Mix audio: host mic + screen audio (if present)
      const ctx = new AudioContext({ sampleRate: 48000 });
      clientAudioCtxRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();
      const dest = ctx.createMediaStreamDestination();
      const master = ctx.createGain();
      master.gain.value = 1.0;
      master.connect(dest);

      const connect = (t: MediaStreamTrack | undefined, gain = 1.0) => {
        if (!t || t.readyState !== "live") return;
        try {
          const src = ctx.createMediaStreamSource(new MediaStream([t]));
          const g = ctx.createGain();
          g.gain.value = gain;
          src.connect(g);
          g.connect(master);
        } catch (e) {
          console.warn("[ClientRec] audio connect failed", e);
        }
      };
      localStream?.getAudioTracks().forEach((t) => connect(t, 1.0));
      screenStream?.getAudioTracks().forEach((t) => connect(t, 0.9));

      // Clone video track so MediaRecorder owns its own reference
      const clonedVideo = videoTrack.clone();
      clientCapturedTracksRef.current = [clonedVideo, ...dest.stream.getAudioTracks()];
      const stream = new MediaStream(clientCapturedTracksRef.current);

      // Prefer MP4 (Safari + recent Chrome). Fall back to WebM when MP4
      // MediaRecorder support is missing.
      const mimeType =
        [
          "video/mp4;codecs=h264,aac",
          "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
          "video/mp4",
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
        ].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 })
        : new MediaRecorder(stream);

      clientChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) clientChunksRef.current.push(e.data);
      };
      recorder.start(1000);
      clientRecorderRef.current = recorder;
      console.log(`[ClientRec] started (${recorder.mimeType || "browser default"})`);
    } catch (err: any) {
      console.warn("[ClientRec] failed to start:", err?.message);
    }
  };

  const stopClientRecorder = async (): Promise<void> => {
    const recorder = clientRecorderRef.current;
    clientRecorderRef.current = null;
    try { clientAudioCtxRef.current?.close(); } catch { /* ignore */ }
    clientAudioCtxRef.current = null;
    clientCapturedTracksRef.current.forEach((t) => t.stop());
    clientCapturedTracksRef.current = [];

    if (!recorder || recorder.state === "inactive") return;

    const chunks = await new Promise<Blob[]>((resolve) => {
      recorder.onstop = () => {
        const all = [...clientChunksRef.current];
        clientChunksRef.current = [];
        resolve(all);
      };
      recorder.stop();
    });

    if (chunks.length === 0) return;
    // Use the mime type the recorder actually produced so the saved file
    // has matching bytes (WebM container won't rename-to-MP4 cleanly).
    const recordedMime = recorder.mimeType || "video/webm";
    const blob = new Blob(chunks, { type: recordedMime });
    if (blob.size < 1024) return;

    const ext = recordedMime.includes("mp4") ? "mp4" : "webm";

    // Trigger browser download — no upload
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `webinar-${webinarId}-local-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    toast.success("Local copy downloaded");
  };

  const handleStartRecording = () => {
    socket?.emit(
      "webinar:startRecording",
      { webinarId },
      (res: { success: boolean; error?: string }) => {
        if (res?.success) {
          toast.success("Recording started");
          // Flip store → the useEffect above will start the client recorder.
          useWebinarStore.getState().setIsRecording(true);
        } else {
          toast.error("Failed to start recording: " + (res?.error || ""));
        }
      }
    );
  };

  const handleStopRecording = () => {
    socket?.emit(
      "webinar:stopRecording",
      { webinarId },
      (res: { success: boolean; error?: string }) => {
        if (res?.success) {
          toast.success("Recording stopped — uploading to cloud");
          useWebinarStore.getState().setIsRecording(false);
        } else {
          toast.error("Failed to stop recording: " + (res?.error || ""));
        }
      }
    );
  };

  // Escape closes whichever popover is open. Bound to window rather than the
  // popover so it works regardless of where focus sits.
  useEffect(() => {
    if (!activeMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeMenu, closeMenus]);

  /* The portalled picker lives on document.body, so it can't be positioned
     by CSS relative to its trigger — we measure the button and place the
     popover just above it in viewport coordinates. Re-measured on resize so
     it doesn't drift away from the button. */
  useEffect(() => {
    if (!showBackgroundPicker) {
      setBgAnchor(null);
      return;
    }
    const measure = () => {
      const el = bgButtonRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Keep the 288px-wide panel fully on screen near the viewport edges.
      const half = POPOVER_WIDTH / 2;
      const left = Math.min(
        Math.max(r.left + r.width / 2, half + 8),
        window.innerWidth - half - 8,
      );
      setBgAnchor({ left, bottom: window.innerHeight - r.top + 12 });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [showBackgroundPicker]);

  // Close reactions on outside click
  useEffect(() => {
    if (!showReactions) return;
    const handle = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-reactions]")) closeMenus();
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showReactions, closeMenus]);

  return (
    // Floating overlay: sits on top of the video stage instead of stealing
    // layout height from it. The outer layer is inert so it never blocks
    // clicks on the video behind the gaps around the pill.
    <div
      ref={barRef}
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-4 transition-opacity duration-300 ease-out ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        // flex-nowrap keeps every control on one row — with flex-wrap the
        // pill grew a second line (and a tall empty box) as soon as the
        // controls outran the width.
        className={`${GLASS_BAR} flex flex-nowrap items-center justify-center gap-2 px-3 py-2 sm:gap-3 sm:px-4 ${
          visible ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        {/* Join with Camera (pre-media) */}
        {isPresenter && !mediaStarted && (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={onStartMedia}
              disabled={!roomReady}
              className={`${GLASS_BTN_BASE} ${GLASS_BTN_SIZE} ${GLASS_BTN_ACTIVE_BLUE} ${GLASS_BTN_DISABLED} rounded-full`}
              title={
                roomReady ? "Join with camera & mic" : "Connecting to room…"
              }
            >
              <Video className="h-5 w-5" />
            </button>
            <span className={GLASS_CAPTION}>
              {roomReady ? "Join" : "Connecting…"}
            </span>
          </div>
        )}

        {/* Mic — Zoom-style split: left half toggles, chevron pops a
            device list so the user can switch mics without leaving the
            bar. Device list only renders when `listMediaDevices` +
            `setAudioDevice` are wired; otherwise we fall back to a
            plain toggle. */}
        {isPresenter && mediaStarted && (
          listMediaDevices && setAudioDevice ? (
            <MediaSplitButton
              kind="audio"
              enabled={micEnabled}
              onToggle={onToggleMic}
              onIcon={
                <>
                  <Mic className="h-5 w-5 -translate-y-1" />
                  <MicLevelMeter />
                </>
              }
              offIcon={<MicOff className="h-5 w-5" />}
              onLabel="Mic"
              offLabel="Unmute"
              listDevices={listMediaDevices}
              open={activeMenu === "mic"}
              onOpenChange={setMicMenu}
              emphasizeSplit={isGotobigwin}
              onPickDevice={async (id) => {
                await setAudioDevice(id);
                // Bat246 only — picking a device is how a confused
                // presenter tries to "turn the mic on"; leaving it muted
                // after they picked one reads as "still broken."
                if (isGotobigwin && !micEnabled) onToggleMic();
                toast.success("Microphone switched");
              }}
            />
          ) : (
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={onToggleMic}
                className={`${GLASS_BTN_BASE} ${GLASS_BTN_SIZE} rounded-full ${
                  !micEnabled ? GLASS_BTN_MUTED : GLASS_BTN_IDLE
                }`}
                title={micEnabled ? "Mute" : "Unmute"}
              >
                {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </button>
              <span className={GLASS_CAPTION}>
                {micEnabled ? "Mic" : "Unmute"}
              </span>
            </div>
          )
        )}

        {/* Speaker — its own split button, deliberately decoupled from the
            mic: the face mutes/unmutes what YOU hear (RemoteAudio playback),
            the chevron picks the output device. Muting the mic never touches
            this, and vice versa. Shown to everyone — attendees are view-only
            but still hear the webinar. */}
        {listMediaDevices && setOutputDevice && (
          <SpeakerButton
            listDevices={listMediaDevices}
            open={activeMenu === "speaker"}
            onOpenChange={setSpeakerMenu}
            onPickOutputDevice={async (id) => {
              await setOutputDevice(id);
              toast.success("Speaker switched");
            }}
          />
        )}

        {/* Camera — same split pattern as Mic. */}
        {isPresenter && mediaStarted && (
          listMediaDevices && setVideoDevice ? (
            <MediaSplitButton
              kind="video"
              enabled={camEnabled}
              onToggle={onToggleCam}
              onIcon={<Video className="h-5 w-5" />}
              offIcon={<VideoOff className="h-5 w-5" />}
              onLabel="Camera"
              offLabel="Start Video"
              listDevices={listMediaDevices}
              open={activeMenu === "cam"}
              onOpenChange={setCamMenu}
              emphasizeSplit={isGotobigwin}
              onPickDevice={async (id) => {
                await setVideoDevice(id);
                if (isGotobigwin && !camEnabled) onToggleCam();
                toast.success("Camera switched");
              }}
            />
          ) : (
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={onToggleCam}
                className={`${GLASS_BTN_BASE} ${GLASS_BTN_SIZE} rounded-full ${
                  !camEnabled ? GLASS_BTN_MUTED : GLASS_BTN_IDLE
                }`}
                title={camEnabled ? "Stop video" : "Start video"}
              >
                {camEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </button>
              <span className={GLASS_CAPTION}>
                {camEnabled ? "Camera" : "Start Video"}
              </span>
            </div>
          )
        )}

        {/* Screen Share */}
        {isPresenter && mediaStarted && (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={onShareScreen}
              className={`${GLASS_BTN_BASE} ${GLASS_BTN_SIZE} rounded-full ${
                screenSharing ? GLASS_BTN_ACTIVE_GREEN : GLASS_BTN_IDLE
              }`}
              title={screenSharing ? "Stop sharing" : "Share screen"}
            >
              {screenSharing ? (
                <ScreenShareOff className="h-5 w-5" />
              ) : (
                <ScreenShare className="h-5 w-5" />
              )}
            </button>
            <span className={GLASS_CAPTION}>
              {screenSharing ? "Stop Share" : "Share"}
            </span>
          </div>
        )}

        {/* Virtual Background — presenter only, available even before camera
            is on (the hook will turn the camera on when applying). The
            popover itself is NOT rendered here: it's portalled to
            document.body so it can't affect this row's sizing at all. */}
        {isPresenter && (
          <div className="flex flex-col items-center gap-1">
            <button
              ref={bgButtonRef}
              onClick={() => toggleMenu("background")}
              className={`${GLASS_BTN_BASE} ${GLASS_BTN_SIZE} rounded-full ${
                virtualBg.backgroundType !== "none"
                  ? GLASS_BTN_ACTIVE_BLUE
                  : GLASS_BTN_IDLE
              }`}
              title="Virtual background"
              aria-haspopup="dialog"
              aria-expanded={showBackgroundPicker}
            >
              <Sparkles className="h-5 w-5" />
            </button>
            <span className={GLASS_CAPTION}>
              Background
            </span>
          </div>
        )}

        {/* Voice memos — quick mic capture posted to NetworkChain's
            voice-agent (transcribe → summarize → searchable). Available
            to anyone in the webinar; each user sees only their own
            memos. */}
        <div className="relative flex flex-col items-center gap-1">
          <button
            onClick={() => toggleMenu("memos")}
            className={`${GLASS_BTN_BASE} ${GLASS_BTN_SIZE} rounded-full ${
              showVoiceMemos ? GLASS_BTN_ACTIVE_BLUE : GLASS_BTN_IDLE
            }`}
            title="Voice memos"
          >
            <StickyNote className="h-5 w-5" />
          </button>
          <span className={GLASS_CAPTION}>Memos</span>
          {showVoiceMemos && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={closeMenus}
                aria-hidden
              />
              {/* Out of flow above the button; anchored to the right edge
                  because the panel is far wider than this control and a
                  centred one would hang off the bar. */}
              <div className="pointer-events-auto absolute bottom-full right-0 z-50 mb-3">
                <VoiceMemoPanel
                  webinarId={webinarId}
                  participants={useWebinarStore.getState().peers.map((p) => ({
                    identity: p.userId,
                    name: p.name,
                  }))}
                  onClose={closeMenus}
                />
              </div>
            </>
          )}
        </div>

        {/* Picture-in-picture — pop the call out into a small floating
            window so the user can keep watching while doing other work.
            Available to anyone (host, panelist, attendee). Browser support
            flag comes from the parent (Document PiP — Chromium only). */}
        {isPipSupported && onOpenPip && (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => {
                void onOpenPip();
              }}
              className={`${GLASS_BTN_BASE} ${GLASS_BTN_SIZE} rounded-full ${GLASS_BTN_IDLE}`}
              title="Picture in picture"
            >
              <PictureInPicture2 className="h-5 w-5" />
            </button>
            <span className={GLASS_CAPTION}>PiP</span>
          </div>
        )}

        {/* Sell Product — host only */}
        {role === "host" && (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => {
                closeMenus();
                setShowProductPicker(true);
              }}
              className={`${GLASS_BTN_BASE} ${GLASS_BTN_SIZE} rounded-full ${GLASS_BTN_IDLE}`}
              title="Pin a product to sell"
            >
              <ShoppingBag className="h-5 w-5" />
            </button>
            <span className={GLASS_CAPTION}>Sell</span>
          </div>
        )}

        {/* Attendee: Raise Hand */}
        {role === "attendee" && (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={handleRaiseHand}
              className={`${GLASS_BTN_BASE} ${GLASS_BTN_SIZE} rounded-full ${
                handRaised ? GLASS_BTN_ACTIVE_YELLOW : GLASS_BTN_IDLE
              }`}
              title={handRaised ? "Lower hand" : "Raise hand"}
            >
              <Hand className="h-5 w-5" />
            </button>
            <span className={GLASS_CAPTION}>
              {handRaised ? "Lower" : "Raise"}
            </span>
          </div>
        )}

        {/* Emoji Reactions */}
        <div className="relative flex flex-col items-center gap-1" data-reactions>
          <div className="relative">
            <button
              onClick={() => toggleMenu("reactions")}
              className={`${GLASS_BTN_BASE} ${GLASS_BTN_SIZE} rounded-full ${
                showReactions ? GLASS_BTN_ACTIVE_BLUE : GLASS_BTN_IDLE
              }`}
              title="React"
            >
              <Smile className="h-5 w-5" />
            </button>
            {showReactions && (
              <div
                // Out of flow above the button — a picker left in normal flow
                // stretched the bar's row and pushed every control up.
                className={`${GLASS_MENU} pointer-events-auto absolute bottom-full left-1/2 z-50 mb-3 flex -translate-x-1/2 gap-1 p-2`}
              >
                {REACTION_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => sendReaction(e)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-2xl transition hover:bg-white/[0.12] hover:scale-110"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className={GLASS_CAPTION}>React</span>
        </div>

        {/* Recording — host only.
            - Manual mode: button toggles start/stop.
            - Automatic mode: button hidden; a small "Recording" indicator
              shows so the host knows a capture is underway. */}
        {role === "host" && recordingMode === "manual" && (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              className={`${GLASS_BTN_BASE} ${GLASS_BTN_SIZE} rounded-full ${
                isRecording ? GLASS_BTN_ACTIVE_RED : GLASS_BTN_IDLE
              }`}
              title={isRecording ? "Stop recording" : "Record"}
            >
              {isRecording ? (
                <Square className="h-4 w-4" />
              ) : (
                <Circle className="h-5 w-5 fill-current" />
              )}
            </button>
            <span className={GLASS_CAPTION}>
              {isRecording ? fmt(elapsed) : "Record"}
            </span>
          </div>
        )}
        {role === "host" && recordingMode === "automatic" && isRecording && (
          <div className="flex flex-col items-center gap-1">
            <div
              className={`${GLASS_BTN_BASE} ${GLASS_BTN_SIZE} rounded-full border-red-400/40 bg-red-500/20`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            </div>
            <span className="text-[9px] sm:text-[10px] text-red-300 font-mono drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              REC {fmt(elapsed)}
            </span>
          </div>
        )}

        {/* Leave / End */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={role === "host" ? handleEndWebinar : handleLeave}
            className={`${GLASS_BTN_BASE} ${GLASS_BTN_SIZE} rounded-full ${GLASS_BTN_DANGER}`}
            title={role === "host" ? "End webinar" : "Leave"}
          >
            <PhoneOff className="h-5 w-5" />
          </button>
          <span className={GLASS_CAPTION}>
            {role === "host" ? "End" : "Leave"}
          </span>
        </div>

        {/* (Mic level bars now render inside the mic button — see the
            MicLevelMeter inside the MediaSplitButton onIcon above. The
            standalone right-edge VU has been retired so the indicator
            visually anchors to the mic control like NetworkChain's.) */}

        {/* Product picker dialog */}
        {role === "host" && (
          <ProductPickerDialog
            open={showProductPicker}
            onOpenChange={setShowProductPicker}
            onPick={handlePickProduct}
          />
        )}
      </div>

      {/* Virtual background popover — portalled to document.body, so it is
          not in the control bar's DOM tree at all and cannot shift its
          layout. Position is computed from the Background button's rect and
          applied as `fixed`, which also frees it from the bar's opacity
          fade and stacking context. */}
      {isPresenter &&
        showBackgroundPicker &&
        bgAnchor &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            {/* Click-away backdrop */}
            <div
              className="fixed inset-0 z-[60]"
              onClick={closeMenus}
              aria-hidden
            />
            <div
              role="dialog"
              aria-label="Virtual background"
              style={{
                position: "fixed",
                left: bgAnchor.left,
                bottom: bgAnchor.bottom,
                transform: "translateX(-50%)",
              }}
              className={`${GLASS_MENU} z-[61] w-72 p-4`}
            >
              <VirtualBackgroundPicker
                backgroundType={virtualBg.backgroundType}
                backgroundImage={virtualBg.backgroundImage}
                isProcessing={virtualBg.isProcessing}
                onSetBlur={virtualBg.setBlur}
                onSetImage={virtualBg.setImage}
                onRemove={virtualBg.removeBackground}
                onClose={closeMenus}
              />
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
