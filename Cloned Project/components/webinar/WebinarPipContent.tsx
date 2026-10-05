"use client";

import { useEffect, useRef, useState } from "react";
import useWebinarStore from "@/store/webinarStore";
import { useAuthStore } from "@/store/authStore";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  LayoutGrid,
  Monitor,
} from "lucide-react";

/* ── Tiny video tile for the PiP window ──────────────────────────────────── */

interface PipVideoTileProps {
  stream: MediaStream | null;
  name: string;
  isScreen?: boolean;
  isLocal?: boolean;
  isMuted?: boolean;
  camOff?: boolean;
  avatar?: string;
  speaking?: boolean;
  /** When set, renders a "<presenter> · Presenting" chip on the screen tile. */
  presenterName?: string;
  /** Compact mode for the filmstrip — smaller avatar, no name label. */
  compact?: boolean;
}

function PipVideoTile({
  stream,
  name,
  isScreen,
  isLocal,
  isMuted,
  camOff,
  avatar,
  speaking,
  presenterName,
  compact,
}: PipVideoTileProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatar]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !stream) {
      setHasVideo(false);
      return;
    }

    el.srcObject = stream;
    el.play().catch(() => {});

    // Mirror VideoGrid.tsx — mediasoup pauses (doesn't end) tracks on
    // camera-off, so we must read .muted explicitly to decide whether the
    // video element has anything live to show.
    const check = () => {
      const t = stream.getVideoTracks()[0];
      const ok = !!t && t.readyState !== "ended" && !t.muted;
      setHasVideo(ok);
      if (ok) el.play().catch(() => {});
    };
    check();

    let tracked: MediaStreamTrack | null = stream.getVideoTracks()[0] || null;
    const onMute = () => check();
    if (tracked) {
      tracked.addEventListener("unmute", onMute);
      tracked.addEventListener("mute", onMute);
      tracked.addEventListener("ended", onMute);
    }

    const onAdd = (e: MediaStreamTrackEvent) => {
      if (e.track.kind === "video") {
        if (tracked) {
          tracked.removeEventListener("unmute", onMute);
          tracked.removeEventListener("mute", onMute);
          tracked.removeEventListener("ended", onMute);
        }
        tracked = e.track;
        tracked.addEventListener("unmute", onMute);
        tracked.addEventListener("mute", onMute);
        tracked.addEventListener("ended", onMute);
      }
      check();
    };
    const onRemove = () => check();

    stream.addEventListener("addtrack", onAdd);
    stream.addEventListener("removetrack", onRemove);

    return () => {
      if (tracked) {
        tracked.removeEventListener("unmute", onMute);
        tracked.removeEventListener("mute", onMute);
        tracked.removeEventListener("ended", onMute);
      }
      stream.removeEventListener("addtrack", onAdd);
      stream.removeEventListener("removetrack", onRemove);
    };
  }, [stream]);

  const showVideo = hasVideo && !camOff;
  const showAvatarImage = !!avatar && !avatarFailed;

  const initials =
    (name || "?")
      .split(/\s+/)
      .filter((w) => w && !w.startsWith("("))
      .map((w) => w[0].toUpperCase())
      .slice(0, 2)
      .join("") || "?";

  const avatarSize = compact ? "w-7 h-7 text-[10px]" : "w-10 h-10 text-xs";

  return (
    <div
      className={`relative w-full h-full rounded-md overflow-hidden flex items-center justify-center bg-[#282828] transition-shadow ${
        speaking
          ? "ring-2 ring-white/80 shadow-[0_0_0_2px_rgba(255,255,255,0.14)]"
          : "border border-white/[0.08]"
      }`}
    >
      {!showVideo &&
        (showAvatarImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt={name}
            onError={() => setAvatarFailed(true)}
            className={`${avatarSize} rounded-full object-cover`}
          />
        ) : (
          <div
            className={`${avatarSize} rounded-full bg-gradient-to-br from-white/25 to-white/5 border border-white/15 flex items-center justify-center text-white font-bold`}
          >
            {initials}
          </div>
        ))}

      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full ${
          isScreen ? "object-contain bg-[#181818]" : "object-cover"
        } ${showVideo ? "opacity-100" : "opacity-0"} ${
          isLocal && !isScreen ? "scale-x-[-1]" : ""
        }`}
      />

      {/* Presenting chip on screen-share tile */}
      {isScreen && presenterName && (
        <div className="absolute top-1 left-1 rounded border border-white/20 bg-white/15 px-1.5 py-px text-[10px] font-medium text-white backdrop-blur-md max-w-[80%] truncate">
          {presenterName} · Presenting
        </div>
      )}

      {/* Name badge — one frosted style for everyone, reading "You" on your
          own tile. Hidden in the compact filmstrip to save space. */}
      {!compact && !isScreen && (
        <div className="absolute bottom-1 left-1 max-w-[80%] truncate rounded-full border border-white/15 bg-white/15 px-2 py-px text-[10px] font-medium text-white shadow-sm backdrop-blur-md drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          {isLocal ? "You" : name}
        </div>
      )}

      {/* Mic-muted indicator */}
      {!isScreen && isMuted && (
        <div
          className={`absolute ${
            compact ? "top-0.5 right-0.5 w-3 h-3" : "top-1 right-1 w-4 h-4"
          } rounded-full bg-red-500/90 text-white flex items-center justify-center`}
        >
          <MicOff className={compact ? "w-2 h-2" : "w-2.5 h-2.5"} />
        </div>
      )}
    </div>
  );
}

/* ── Main PiP content ────────────────────────────────────────────────────── */

interface Props {
  onToggleMic: () => void;
  onToggleCam: () => void;
  onLeave: () => void;
}

export default function WebinarPipContent({
  onToggleMic,
  onToggleCam,
  onLeave,
}: Props) {
  const webinarTitle = useWebinarStore((s) => s.webinarTitle);
  const role = useWebinarStore((s) => s.role);
  const peers = useWebinarStore((s) => s.peers);
  const localStream = useWebinarStore((s) => s.localStream);
  const screenStream = useWebinarStore((s) => s.screenStream);
  const screenSharing = useWebinarStore((s) => s.screenSharing);
  const micEnabled = useWebinarStore((s) => s.micEnabled);
  const camEnabled = useWebinarStore((s) => s.camEnabled);
  const isLocalSpeaking = useWebinarStore((s) => s.isLocalSpeaking);
  const localAvatarFromStore = useWebinarStore((s) => s.localAvatar);
  const user = useAuthStore((s) => s.user);

  const myAvatar =
    localAvatarFromStore ||
    (user as { profilePicture?: string } | null)?.profilePicture ||
    "";
  const myName = user?.name || "You";

  const isPresenter = role === "host" || role === "panelist";
  // The note-taker bot joins as a subscribe-only co-host purely to record
  // and transcribe. It never publishes media, so a tile for it is a dead
  // "camera off" block and it inflates the "in call" count. Same rule as
  // VideoGrid: keep it in the room and the participants list, never on a
  // tile.
  const isNoteTakerBot = (p: (typeof peers)[number]) =>
    p.userId === "notetaker-bot" || p.name === "Note Taker";
  const presenters = peers.filter(
    (p) => (p.role === "host" || p.role === "panelist") && !isNoteTakerBot(p)
  );

  const remoteScreen = peers.find((p) => p.streams?.screen);
  const activeScreen =
    screenSharing && screenStream
      ? screenStream
      : remoteScreen?.streams?.screen || null;
  const screenPresenterName = screenSharing
    ? myName
    : remoteScreen?.name || "";
  const screenLabel = screenSharing
    ? "Your Screen"
    : remoteScreen
      ? `${remoteScreen.name}'s Screen`
      : "";

  type Tile = {
    key: string;
    stream: MediaStream | null;
    name: string;
    isLocal: boolean;
    isMuted: boolean;
    camOff: boolean;
    avatar?: string;
    speaking: boolean;
  };

  const rawTiles: Tile[] = [
    ...(isPresenter
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
          },
        ]
      : []),
    ...presenters.map((p) => ({
      key: p.socketId,
      stream: p.streams?.video || null,
      name: p.name,
      isLocal: false,
      isMuted: !!p.isMuted,
      camOff: p.cameraEnabled === false,
      avatar: p.avatar,
      speaking: !!p.isSpeaking,
    })),
  ];

  // Active speakers float to the top, then peers with cameras on, then the
  // rest. Mirrors the spotlight ordering in VideoGrid.tsx so the most
  // useful tiles fill the limited filmstrip slots first.
  const tiles = rawTiles.slice().sort((a, b) => {
    if (a.speaking !== b.speaking) return a.speaking ? -1 : 1;
    const aLive = !a.camOff && !!a.stream ? 1 : 0;
    const bLive = !b.camOff && !!b.stream ? 1 : 0;
    if (aLive !== bLive) return bLive - aLive;
    return 0;
  });

  const count = tiles.length;

  // Toggle inside the PiP window so the user can switch between the combined
  // view (screen share + participant filmstrip) and a participants-only grid.
  // Resets when the screen share ends so the next share starts combined.
  const [showParticipantsOnly, setShowParticipantsOnly] = useState(false);
  useEffect(() => {
    if (!activeScreen) setShowParticipantsOnly(false);
  }, [activeScreen]);

  const showCombinedView = !!activeScreen && !showParticipantsOnly;

  const filmstripMax = 5;
  const gridMax = 4;
  const visibleTiles = showCombinedView
    ? tiles.slice(0, filmstripMax)
    : tiles.slice(0, gridMax);
  const overflowCount =
    tiles.length - (showCombinedView ? filmstripMax : gridMax);

  return (
    <div
      className="flex flex-col h-full bg-[#181818] text-white"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      {/* Header */}
      <div className="flex items-center px-2 py-1 gap-1.5 flex-shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0 animate-pulse" />
        <span className="text-[11px] font-semibold truncate flex-1">
          {webinarTitle || "Webinar"}
        </span>
        {activeScreen && (
          <button
            onClick={() => setShowParticipantsOnly((prev) => !prev)}
            title={
              showParticipantsOnly
                ? "Show screen share with participants"
                : "Show participants only"
            }
            className={`w-[22px] h-[22px] rounded flex items-center justify-center flex-shrink-0 border text-white transition-colors ${
              showParticipantsOnly
                ? "border-white/25 bg-white/20 hover:bg-white/30"
                : "border-white/10 bg-white/10 hover:bg-white/20"
            }`}
          >
            {showParticipantsOnly ? (
              <Monitor className="w-3 h-3" />
            ) : (
              <LayoutGrid className="w-3 h-3" />
            )}
          </button>
        )}
        <span className="text-zinc-400 text-[10px] flex-shrink-0">
          {count} in call
        </span>
      </div>

      {/* Video area */}
      <div className="flex-1 px-1 pb-1 min-h-0 flex flex-col gap-1">
        {showCombinedView && activeScreen ? (
          <>
            <div className="flex-1 min-h-0">
              <PipVideoTile
                stream={activeScreen}
                name={screenLabel}
                isScreen
                presenterName={screenPresenterName}
              />
            </div>
            {visibleTiles.length > 0 && (
              <div className="flex gap-1 h-[52px] flex-shrink-0">
                {visibleTiles.map((t) => (
                  <div key={t.key} className="flex-1 min-w-0">
                    <PipVideoTile
                      stream={t.stream}
                      name={t.name}
                      isLocal={t.isLocal}
                      isMuted={t.isMuted}
                      camOff={t.camOff}
                      avatar={t.avatar}
                      speaking={t.speaking}
                      compact
                    />
                  </div>
                ))}
                {overflowCount > 0 && (
                  <div className="flex-1 min-w-0 flex items-center justify-center rounded-md border border-white/[0.08] bg-[#282828] text-[10px] text-zinc-400 font-semibold">
                    +{overflowCount}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div
            className="w-full h-full grid gap-0.5"
            style={{
              gridTemplateColumns: count <= 1 ? "1fr" : "1fr 1fr",
              gridTemplateRows: count <= 2 ? "1fr" : "1fr 1fr",
            }}
          >
            {visibleTiles.map((t) => (
              <PipVideoTile
                key={t.key}
                stream={t.stream}
                name={t.name}
                isLocal={t.isLocal}
                isMuted={t.isMuted}
                camOff={t.camOff}
                avatar={t.avatar}
                speaking={t.speaking}
              />
            ))}
            {overflowCount > 0 && (
              <div className="flex items-center justify-center rounded-md border border-white/[0.08] bg-[#282828] text-[11px] text-zinc-400 font-semibold">
                +{overflowCount} more
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 px-2 py-1.5 border-t border-white/10 bg-[#282828] flex-shrink-0">
        {isPresenter && (
          <>
            <button
              onClick={onToggleMic}
              className={`w-8 h-8 rounded-full flex items-center justify-center border text-white transition-colors ${
                micEnabled
                  ? "border-white/15 bg-white/10 hover:bg-white/20"
                  : "border-red-400/40 bg-red-500/80 hover:bg-red-500"
              }`}
            >
              {micEnabled ? (
                <Mic className="w-3.5 h-3.5" />
              ) : (
                <MicOff className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={onToggleCam}
              className={`w-8 h-8 rounded-full flex items-center justify-center border text-white transition-colors ${
                camEnabled
                  ? "border-white/15 bg-white/10 hover:bg-white/20"
                  : "border-red-400/40 bg-red-500/80 hover:bg-red-500"
              }`}
            >
              {camEnabled ? (
                <Video className="w-3.5 h-3.5" />
              ) : (
                <VideoOff className="w-3.5 h-3.5" />
              )}
            </button>
          </>
        )}
        <button
          onClick={onLeave}
          className="w-8 h-8 rounded-full border border-red-400/40 bg-red-500/85 text-white hover:bg-red-500 flex items-center justify-center transition-colors"
        >
          <PhoneOff className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
