"use client";

import { useEffect, useRef, useState } from "react";
import { MicOff } from "lucide-react";
import useWebinarStore from "@/store/webinarStore";
import { useAuthStore } from "@/store/authStore";

/* ── Floating emoji reaction overlay ──────────────────────────────────────── */

function ReactionOverlay() {
  const reactions = useWebinarStore((s) => s.reactions);
  const stageRef = useRef<HTMLDivElement>(null);

  // Emojis climb a fixed fraction of the *stage*, measured rather than
  // expressed in vh: with a side panel open or the window resized, a vh
  // figure either stops short of the top edge or sails past it before the
  // fade-out has finished.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const apply = () => {
      const h = el.clientHeight;
      if (h > 0) {
        el.style.setProperty(
          "--reaction-rise",
          `-${Math.round(h * 0.85)}px`
        );
      }
    };

    apply();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={stageRef}
      className="absolute inset-0 pointer-events-none overflow-hidden z-20"
    >
      {reactions.map((r) => (
        // Positioning layer — static transform only, so the two animated
        // layers below it are free to own transform outright.
        <div
          key={r.id}
          className="absolute bottom-10 -translate-x-1/2"
          style={{ left: `${r.xPercent}%` }}
        >
          <div
            className="webinar-reaction-rise"
            style={{ animationDuration: `${r.durationMs}ms` }}
          >
            <div
              className="webinar-reaction-sway"
              style={
                {
                  animationDuration: `${r.durationMs}ms`,
                  "--reaction-sway": r.swayDirection,
                } as React.CSSProperties
              }
            >
              <div
                className="flex flex-col items-center gap-1"
                style={{
                  transform: `scale(${r.scale}) rotate(${r.rotationDeg}deg)`,
                }}
              >
                <span className="text-4xl sm:text-5xl leading-none drop-shadow-[0_4px_14px_rgba(0,0,0,0.6)]">
                  {r.emoji}
                </span>
                <span className="bg-black/60 backdrop-blur-md text-white text-[11px] font-medium px-2.5 py-0.5 rounded-full border border-white/10 shadow-lg whitespace-nowrap">
                  {r.name}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Audio autoplay unlock ────────────────────────────────────────────────── */
// Browsers block autoplay until the user interacts with the page. By the
// time the user is in the room they've already clicked something to get
// here (Join button, name input, etc) — but the autoplay policy is
// per-element, so RemoteAudio elements created later still need a
// real user gesture before they can call play().
//
// We attach a one-time listener at the document level for any gesture
// (pointerdown, keydown, touchstart) and flush all queued audio elements
// when it fires. No banner — autoplay restrictions become invisible to
// the user as long as they've clicked anywhere on the page once.

const pendingAudioEls: HTMLVideoElement[] = [];
let audioUnlocked = false;
let gestureListenerInstalled = false;

function unlockAllAudio() {
  audioUnlocked = true;
  pendingAudioEls.forEach((el) => el.play().catch(() => {}));
  pendingAudioEls.length = 0;
}

function ensureGestureUnlock() {
  if (gestureListenerInstalled || typeof window === "undefined") return;
  gestureListenerInstalled = true;
  const handler = () => {
    unlockAllAudio();
    window.removeEventListener("pointerdown", handler, true);
    window.removeEventListener("keydown", handler, true);
    window.removeEventListener("touchstart", handler, true);
  };
  window.addEventListener("pointerdown", handler, true);
  window.addEventListener("keydown", handler, true);
  window.addEventListener("touchstart", handler, true);
}

/* ── Pin ad-video with autoplay + unmute button ───────────────────────────── */
// Browsers block autoplay-with-sound until the user interacts with the page.
// We start muted (so the loop plays immediately) and try to unmute on the
// first pointer/key event anywhere on the page. If the auto-unmute is
// blocked, an "Unmute" pill sits on top of the video for a one-click fix.
function PinAdVideoSpotlight({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    // Fresh source → start muted so autoplay works.
    setMuted(true);
    el.muted = true;
    void el.play().catch(() => {});

    // Try to unmute on the next user gesture.
    const tryUnmute = () => {
      const v = videoRef.current;
      if (!v) return;
      v.muted = false;
      v.volume = 1;
      v.play()
        .then(() => setMuted(false))
        .catch(() => {
          // Still blocked (rare after any prior click) — leave muted;
          // the click-to-unmute pill covers this case.
          v.muted = true;
          setMuted(true);
        });
      window.removeEventListener("pointerdown", tryUnmute, true);
      window.removeEventListener("keydown", tryUnmute, true);
      window.removeEventListener("touchstart", tryUnmute, true);
    };
    window.addEventListener("pointerdown", tryUnmute, true);
    window.addEventListener("keydown", tryUnmute, true);
    window.addEventListener("touchstart", tryUnmute, true);
    return () => {
      window.removeEventListener("pointerdown", tryUnmute, true);
      window.removeEventListener("keydown", tryUnmute, true);
      window.removeEventListener("touchstart", tryUnmute, true);
    };
  }, [src]);

  return (
    <>
      <video
        ref={videoRef}
        key={src}
        src={src}
        autoPlay
        loop
        playsInline
        className="w-full h-full object-contain bg-[#181818]"
      />
      {muted && (
        <button
          type="button"
          onClick={() => {
            const v = videoRef.current;
            if (!v) return;
            v.muted = false;
            v.volume = 1;
            void v.play();
            setMuted(false);
          }}
          className="absolute top-4 right-4 z-20 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-black/70 hover:bg-black/85 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg border border-white/20"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinejoin="round" strokeLinecap="round" />
            <line x1="23" y1="9" x2="17" y2="15" strokeLinecap="round" />
            <line x1="17" y1="9" x2="23" y2="15" strokeLinecap="round" />
          </svg>
          Tap to unmute
        </button>
      )}
    </>
  );
}

/* ── Hidden audio player for remote peers ─────────────────────────────────── */

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  // Local speaker mute (the control bar's Speaker button). Kept separate
  // from mic mute by design — this only gates playback elements.
  const speakerMuted = useWebinarStore((s) => s.speakerMuted);

  useEffect(() => {
    if (ref.current) ref.current.muted = speakerMuted;
  }, [speakerMuted]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !stream) return;

    el.srcObject = stream;
    el.muted = useWebinarStore.getState().speakerMuted;
    el.volume = 1;

    const tryPlay = () => {
      el.play().catch((err) => {
        if (err?.name === "NotAllowedError") {
          if (!pendingAudioEls.includes(el)) pendingAudioEls.push(el);
        }
      });
    };

    if (audioUnlocked) {
      tryPlay();
    } else {
      pendingAudioEls.push(el);
      // Make sure a gesture listener is armed; the next click/keypress
      // anywhere on the page will flush this queue silently.
      ensureGestureUnlock();
      // Also attempt play immediately — if the user has already clicked
      // the page (very common, since they had to interact to land here)
      // the policy is satisfied and we won't need any deferred unlock.
      tryPlay();
    }

    const onUnmute = () => tryPlay();
    let currentTrack: MediaStreamTrack | null = null;

    const attachTrack = (track: MediaStreamTrack) => {
      detachTrack();
      track.addEventListener("unmute", onUnmute);
      currentTrack = track;
    };

    const detachTrack = () => {
      if (currentTrack) {
        currentTrack.removeEventListener("unmute", onUnmute);
        currentTrack = null;
      }
    };

    const track = stream.getAudioTracks()[0];
    if (track) attachTrack(track);

    const onAddTrack = (e: MediaStreamTrackEvent) => {
      if (e.track.kind === "audio") {
        attachTrack(e.track);
        tryPlay();
      }
    };

    stream.addEventListener("addtrack", onAddTrack);

    return () => {
      detachTrack();
      stream.removeEventListener("addtrack", onAddTrack);
      const idx = pendingAudioEls.indexOf(el);
      if (idx >= 0) pendingAudioEls.splice(idx, 1);
    };
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: "none",
      }}
    />
  );
}

/* ── Single video tile ────────────────────────────────────────────────────── */

interface TileProps {
  stream: MediaStream | null;
  name: string;
  isLocal?: boolean;
  small?: boolean;
  isScreen?: boolean;
  isMuted?: boolean;
  camOff?: boolean;
  /** Profile picture URL — shown when camera is off. */
  avatar?: string;
  /** Active speaker — adds a green pulse ring around the tile. */
  speaking?: boolean;
  /** LiveKit connection quality for this peer (mirrored into the
   *  store via RoomEvent.ConnectionQualityChanged). */
  connectionQuality?: 'excellent' | 'good' | 'poor' | 'lost' | 'unknown';
}

/**
 * Cell-tower-style three-bar signal indicator. Excellent/Good/Poor
 * map to 3/2/1 filled bars in green/amber/red. Hidden during the
 * brief "unknown" window so we don't flash a placeholder on join.
 */
function ConnectionBars({
  quality,
  className = '',
}: {
  quality?: 'excellent' | 'good' | 'poor' | 'lost' | 'unknown';
  className?: string;
}) {
  if (!quality || quality === 'unknown') return null;
  const filled =
    quality === 'excellent' ? 3 : quality === 'good' ? 2 : 1;
  const colorClass =
    quality === 'excellent'
      ? 'bg-emerald-400'
      : quality === 'good'
      ? 'bg-amber-400'
      : 'bg-red-400';
  const label =
    quality === 'excellent'
      ? 'Connection: excellent'
      : quality === 'good'
      ? 'Connection: good'
      : quality === 'poor'
      ? 'Connection: poor'
      : 'Connection lost';
  const heights = ['h-1', 'h-1.5', 'h-2.5'];
  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex items-end gap-[2px] rounded bg-black/40 px-1 py-1 ring-1 ring-white/10 ${className}`}
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-[1px] ${h} ${
            i < filled ? colorClass : 'bg-white/20'
          }`}
        />
      ))}
    </span>
  );
}

function Tile({
  stream,
  name,
  isLocal = false,
  small = false,
  isScreen = false,
  isMuted,
  camOff,
  avatar,
  speaking,
  connectionQuality,
}: TileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

  // Hold the "speaking" ring ~1.5s after speech stops so it doesn't strobe on
  // natural pauses (isSpeaking flips every breath).
  const [stickySpeaking, setStickySpeaking] = useState(speaking);
  useEffect(() => {
    if (speaking) {
      setStickySpeaking(true);
      return;
    }
    const t = setTimeout(() => setStickySpeaking(false), 1500);
    return () => clearTimeout(t);
  }, [speaking]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stream) {
      video.srcObject = stream;
      video.play().catch(() => {});

      const check = () => {
        const t = stream.getVideoTracks()[0];
        // A remote peer turning their camera off in mediasoup pauses the
        // track (track.muted = true) without ending it — readyState stays
        // "live", so the old gate kept showing the last frozen frame.
        // Read .muted explicitly so the avatar takes over the moment the
        // pause arrives, and comes back to video on resume.
        const valid = !!t && t.readyState !== "ended" && !t.muted;
        setHasVideo(valid);
        if (valid) {
          video.play().catch(() => {});
        }
      };
      check();

      // Track-level listener management — re-attaches when tracks are swapped
      // on a stable MediaStream (prevents PIP freeze on track replacement)
      let currentTrack: MediaStreamTrack | null = null;

      const attachTrackListeners = (track: MediaStreamTrack) => {
        detachTrackListeners();
        track.addEventListener("unmute", check);
        track.addEventListener("mute", check);
        track.addEventListener("ended", check);
        currentTrack = track;
      };

      const detachTrackListeners = () => {
        if (currentTrack) {
          currentTrack.removeEventListener("unmute", check);
          currentTrack.removeEventListener("mute", check);
          currentTrack.removeEventListener("ended", check);
          currentTrack = null;
        }
      };

      const initialTrack = stream.getVideoTracks()[0];
      if (initialTrack) attachTrackListeners(initialTrack);

      const onAddTrack = (e: MediaStreamTrackEvent) => {
        if (e.track.kind === "video") {
          attachTrackListeners(e.track);
        }
        check();
      };

      const onRemoveTrack = () => check();

      stream.addEventListener("addtrack", onAddTrack);
      stream.addEventListener("removetrack", onRemoveTrack);

      // Poll briefly for track readiness (fallback for missed events)
      const pollId = setInterval(check, 1000);
      const stopPoll = setTimeout(() => clearInterval(pollId), 10000);

      return () => {
        detachTrackListeners();
        stream.removeEventListener("addtrack", onAddTrack);
        stream.removeEventListener("removetrack", onRemoveTrack);
        clearInterval(pollId);
        clearTimeout(stopPoll);
      };
    } else {
      video.srcObject = null;
      setHasVideo(false);
    }
  }, [stream]);

  const showVideo = hasVideo && !camOff;

  // The label doubles as the old "You" badge: your own camera tile reads
  // "You" instead of your name. Screen tiles are excluded — the local share
  // is already named "Your Screen" and "You" would lose that meaning.
  const label = isLocal && !isScreen ? "You" : name;

  // Build initials from name
  const initials =
    (name || "?")
      .split(/\s+/)
      .filter((w) => w && !w.startsWith("("))
      .map((w) => w[0].toUpperCase())
      .slice(0, 2)
      .join("") || "?";

  return (
    <div
      className={`relative bg-zinc-950 rounded-xl overflow-hidden flex items-center justify-center group w-full h-full transition-shadow ${
        stickySpeaking
          ? "ring-2 ring-white/80 shadow-[0_0_0_3px_rgba(255,255,255,0.14)]"
          : "border border-white/[0.08]"
      }`}
    >
      {/* Connection-quality bars (top-left). Driven by the
          peer.connectionQuality field on the store, which is updated
          from RoomEvent.ConnectionQualityChanged in useWebinarLiveKit.
          Hidden on tiny tiles where the dot would be a visual noise. */}
      {!small && (
        <ConnectionBars
          quality={connectionQuality}
          className="absolute left-2 top-2 z-10"
        />
      )}

      {/* Avatar placeholder — uses profile picture if available, otherwise initials */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity ${
          showVideo ? "opacity-0" : "opacity-100"
        }`}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt={name}
            className={`rounded-full object-cover shadow-lg ${
              small ? "w-8 h-8" : "w-20 h-20"
            }`}
          />
        ) : (
          <div
            className={`rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center font-bold text-white shadow-lg ${
              small ? "w-8 h-8 text-sm" : "w-14 h-14 text-xl"
            }`}
          >
            {initials}
          </div>
        )}
        {!small && (
          <span className="text-zinc-500 text-xs mt-2">Camera off</span>
        )}
      </div>

      {/* Video — always muted since audio is handled by separate <RemoteAudio> elements.
          The LOCAL camera tile is CSS-mirrored (like a mirror — Zoom/Meet do
          the same) so your own movements track the way you expect. Display
          only: the published track, remote viewers and recordings are
          untouched. Screen shares are never mirrored (text would flip). */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full transition-opacity ${
          isScreen ? "object-contain bg-[#181818]" : "object-cover"
        } ${isLocal && !isScreen ? "scale-x-[-1]" : ""} ${
          showVideo ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Name badge — frosted pill. `flex` on the wrapper is what makes the
          span's truncate work (an inline span won't clip). */}
      {!small && (
        <div className="absolute bottom-2 left-2 right-2 z-10 flex">
          <span className="max-w-[85%] truncate rounded-full border border-white/15 bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white shadow-sm backdrop-blur-md drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            {label}
          </span>
        </div>
      )}
      {small && (
        <div className="absolute bottom-1 left-1 right-1">
          <span className="text-white text-xs font-medium truncate block drop-shadow-lg text-center">
            {label?.split(" ")[0]}
          </span>
        </div>
      )}

      {/* Mute chip — offset past the ConnectionBars meter so the two never
          overlap. On `small` tiles the bars aren't rendered, so the chip
          takes the left edge itself and drops the text label. */}
      {!isScreen && isMuted && (
        <div
          className={`absolute top-2 z-10 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-md ${
            small ? "left-2" : "left-9"
          }`}
          title="Microphone off"
        >
          <MicOff className="h-3 w-3 shrink-0" />
          {!small && <span>Mic off</span>}
        </div>
      )}
    </div>
  );
}

/* ── Main VideoGrid ───────────────────────────────────────────────────────── */

export default function VideoGrid() {
  const { peers, localStream, screenStream, screenSharing, micEnabled, camEnabled } =
    useWebinarStore();
  const isLocalSpeaking = useWebinarStore((s) => s.isLocalSpeaking);
  const localConnectionQuality = useWebinarStore(
    (s) => s.localConnectionQuality,
  );
  const localAvatarFromStore = useWebinarStore((s) => s.localAvatar);
  const user = useAuthStore((s) => s.user);
  // Prefer the avatar the backend echoed at joinRoom (sourced from
  // User.profilePicture). Fall back to anything the auth store happens to
  // carry — older session payloads, impersonation, etc.
  const myAvatar =
    localAvatarFromStore ||
    (user as { profilePicture?: string } | null)?.profilePicture ||
    "";

  // Find active screen share (local or remote)
  const localScreenActive = screenSharing && !!screenStream;
  const remoteScreenPeer = peers.find((p) => p.streams?.screen);
  const spotlightStream = localScreenActive
    ? screenStream
    : remoteScreenPeer?.streams?.screen || null;
  const spotlightName = localScreenActive
    ? "Your Screen"
    : remoteScreenPeer
      ? `${remoteScreenPeer.name}'s Screen`
      : null;
  const inSpotlight = !!spotlightStream;

  // Pin ad-video spotlight — when a pinned product's AI ad video is ready
  // and no real screen share is currently on air, we take over the stage
  // with the video and demote camera tiles to a PiP strip (same shape as
  // a screen share). Playback runs muted + looped so it can autoplay even
  // if the browser hasn't unlocked audio yet.
  const pinnedProduct = useWebinarStore((s) => s.pinnedProduct);
  const pinVideoUrl =
    pinnedProduct?.videoUrl && pinnedProduct.videoStatus === "ready"
      ? pinnedProduct.videoUrl
      : null;
  const inPinVideoSpotlight = !!pinVideoUrl && !inSpotlight;

  const myName = user?.name || "You";
  const myRole = useWebinarStore((s) => s.role);

  // Only show host and panelist (co-host) tiles — attendees are view-only.
  // Tile order is the original peer-array order (host(s) then panelists,
  // by join time). We previously sorted by isSpeaking, which flipped
  // every time someone paused for breath and made the grid bounce
  // around every second — viewers reported motion sickness. Active
  // speakers are signalled by the green pulse ring on each tile
  // instead of by reordering.
  // The note-taker bot joins as a subscribe-only co-host (LiveKit identity
  // "notetaker-bot", display name "Note Taker") purely to record + transcribe.
  // It never publishes media, so its tile is always a dead "Camera off" block
  // wasting a grid slot — keep it in the room (and the participants list) but
  // never give it a video tile.
  const isNoteTakerBot = (p: (typeof peers)[number]) =>
    p.userId === "notetaker-bot" || p.name === "Note Taker";
  const presenters = peers.filter(
    (p) => (p.role === "host" || p.role === "panelist") && !isNoteTakerBot(p),
  );
  const iAmPresenter = myRole === "host" || myRole === "panelist";

  // PiP camera tiles (shown when in spotlight mode)
  const pipTiles = [
    ...(iAmPresenter
      ? [
          {
            key: "local",
            stream: localStream,
            name: myName,
            isLocal: true,
            isMuted: !micEnabled,
            camOff: !camEnabled,
            avatar: myAvatar,
            speaking: isLocalSpeaking,
            connectionQuality: localConnectionQuality,
          },
        ]
      : []),
    ...presenters.map((p) => ({
      key: p.socketId,
      stream: p.streams?.video || null,
      name: p.name,
      isLocal: false,
      isMuted: !!p.isMuted,
      // Trust the explicit `webinar:peerCameraState` signal over the
      // WebRTC `mute` event (which doesn't always reach the receiver
      // promptly). Default to "on" when no signal has arrived yet.
      camOff: p.cameraEnabled === false,
      avatar: p.avatar,
      speaking: !!p.isSpeaking,
      connectionQuality: p.connectionQuality,
    })),
  ];

  // Grid tiles (shown when NOT in spotlight mode)
  const gridTiles = [
    ...(iAmPresenter
      ? [
          {
            key: "local-cam",
            stream: localStream,
            name: myName,
            isLocal: true,
            isMuted: !micEnabled,
            camOff: !camEnabled,
            avatar: myAvatar,
            speaking: isLocalSpeaking,
            connectionQuality: localConnectionQuality,
          },
        ]
      : []),
    ...presenters.map((p) => ({
      key: `${p.socketId}-video`,
      stream: p.streams?.video || null,
      name: p.name,
      isLocal: false,
      isMuted: !!p.isMuted,
      camOff: p.cameraEnabled === false,
      avatar: p.avatar,
      speaking: !!p.isSpeaking,
      connectionQuality: p.connectionQuality,
    })),
  ];

  // Cap the on-stage grid so a webinar with many promoted panelists doesn't
  // pack tiles into unreadable specks. Presenters are curated so this rarely
  // fires, but it bounds the worst case (Google-Meet style): local + active
  // speakers + live cameras first; the rest collapse into a "+N more" pill.
  const MAX_STAGE_TILES = 16;
  const stageOverflow = Math.max(0, gridTiles.length - MAX_STAGE_TILES);
  const stageTiles =
    stageOverflow === 0
      ? gridTiles
      : [...gridTiles]
          .sort((a, b) => {
            const score = (t: (typeof gridTiles)[number]) =>
              (t.isLocal ? 1000 : 0) +
              (t.speaking ? 500 : 0) +
              (t.stream && !t.camOff ? 100 : 0);
            const d = score(b) - score(a);
            return d !== 0 ? d : String(a.key).localeCompare(String(b.key));
          })
          .slice(0, MAX_STAGE_TILES - 1);

  const count = stageTiles.length;
  const gridCols =
    count === 1
      ? "grid-cols-1"
      : count === 2
        ? "grid-cols-2"
        : count <= 4
          ? "grid-cols-2"
          : count <= 9
            ? "grid-cols-3"
            : "grid-cols-4";

  return (
    <>
      {/* Audio autoplay is unlocked silently on first page gesture —
          no banner. See ensureGestureUnlock() above. */}
      {/* Hidden audio players for peer mic + screen share audio */}
      {peers.map((p) =>
        p.streams?.audio ? (
          <RemoteAudio key={`audio-${p.socketId}`} stream={p.streams.audio} />
        ) : null
      )}
      {peers.map((p) =>
        p.streams?.screenAudio ? (
          <RemoteAudio
            key={`screen-audio-${p.socketId}`}
            stream={p.streams.screenAudio}
          />
        ) : null
      )}

      <div className="relative w-full h-full">
        <ReactionOverlay />

        {inSpotlight ? (
          /* SPOTLIGHT MODE */
          <div className="relative w-full h-full bg-[#181818]">
            <Tile
              stream={spotlightStream}
              name={spotlightName || "Screen"}
              isLocal={localScreenActive}
              isScreen
            />
            {/* PiP strip - bottom right */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
              {pipTiles.map((t) => (
                <div
                  key={t.key}
                  className="w-36 h-24 rounded-xl overflow-hidden shadow-2xl border border-white/10 ring-1 ring-black/50"
                >
                  <Tile
                    stream={t.stream}
                    name={t.name}
                    isLocal={t.isLocal}
                    small
                    isMuted={t.isMuted}
                    camOff={t.camOff}
                    avatar={t.avatar}
                    speaking={t.speaking}
                    connectionQuality={t.connectionQuality}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : inPinVideoSpotlight ? (
          /* PIN AD-VIDEO SPOTLIGHT — mirrors screen-share layout so
             attendees read the Grok Imagine clip as "someone's presenting
             the product". Starts muted so autoplay always works; the
             PinAdVideoSpotlight sub-component auto-unmutes on the next
             user gesture, or offers a click-to-unmute pill. */
          <div className="relative w-full h-full bg-[#181818]">
            <PinAdVideoSpotlight src={pinVideoUrl!} />
            <div className="absolute top-4 left-4 z-10">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white bg-white/15 border border-white/20 backdrop-blur-md px-2.5 py-1 rounded-full shadow">
                Featured product ad
              </span>
            </div>
            <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
              {pipTiles.map((t) => (
                <div
                  key={t.key}
                  className="w-36 h-24 rounded-xl overflow-hidden shadow-2xl border border-white/10 ring-1 ring-black/50"
                >
                  <Tile
                    stream={t.stream}
                    name={t.name}
                    isLocal={t.isLocal}
                    small
                    isMuted={t.isMuted}
                    camOff={t.camOff}
                    avatar={t.avatar}
                    speaking={t.speaking}
                    connectionQuality={t.connectionQuality}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* GRID MODE */
          <div
            className={`grid ${gridCols} gap-2 w-full h-full p-2 auto-rows-fr`}
          >
            {stageTiles.map((t) => (
              <Tile
                key={t.key}
                stream={t.stream}
                name={t.name}
                isLocal={t.isLocal}
                isMuted={t.isMuted}
                camOff={t.camOff}
                avatar={t.avatar}
                speaking={t.speaking}
                connectionQuality={t.connectionQuality}
              />
            ))}
          </div>
        )}

        {/* "+N more" pill — only in grid mode when the stage was capped. */}
        {!inSpotlight && stageOverflow > 0 && (
          <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/10 backdrop-blur">
            <span aria-hidden>+{stageOverflow}</span>
            <span className="text-white/70">more</span>
          </div>
        )}
      </div>
    </>
  );
}
