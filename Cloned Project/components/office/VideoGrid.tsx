'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Track, ConnectionQuality } from 'livekit-client';
import type { Participant } from 'livekit-client';
import { ParticipantTile, useTracks, useParticipants, useIsSpeaking, useSpeakingParticipants, useConnectionQualityIndicator } from '@livekit/components-react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { useVideoGrid } from '@/hooks/office/useVideoGrid';
import { MicOff, UserX, ScreenShare, Loader2, BookHeadphones } from 'lucide-react';
import { parseParticipantMeta } from '@/lib/meet-metadata';
import { ParticipantAvatar } from './ParticipantAvatar';

/**
 * Three-bar signal-strength indicator (cell-tower style). Maps
 * LiveKit's connection quality to a stepped fill:
 *   Excellent → 3 emerald bars
 *   Good      → 2 amber bars
 *   Poor      → 1 red bar
 *   Lost      → 1 red bar (treat as poorest)
 * The remaining bars stay neutral so users can read it as "X of 3".
 * Hidden during the brief Unknown window (first ~500ms after a join).
 */
function ConnectionBars({
  quality,
  className = '',
}: {
  quality: ConnectionQuality;
  className?: string;
}) {
  // Unknown is the default before the SFU has reported anything — and
  // for a camera-off, mic-off participant it can stay Unknown forever
  // (no uplink to measure). Render an idle 3-bar skeleton so the
  // indicator is always visible and lights up the moment LiveKit
  // reports real quality, instead of silently rendering nothing.
  const isUnknown = quality === ConnectionQuality.Unknown;
  const filled = isUnknown
    ? 0
    : quality === ConnectionQuality.Excellent
    ? 3
    : quality === ConnectionQuality.Good
    ? 2
    : 1;
  const colorClass =
    quality === ConnectionQuality.Excellent
      ? 'bg-emerald-400'
      : quality === ConnectionQuality.Good
      ? 'bg-amber-400'
      : 'bg-red-400';
  const label =
    quality === ConnectionQuality.Excellent
      ? 'Connection: excellent'
      : quality === ConnectionQuality.Good
      ? 'Connection: good'
      : quality === ConnectionQuality.Poor
      ? 'Connection: poor'
      : quality === ConnectionQuality.Lost
      ? 'Connection lost'
      : 'Connection: measuring…';
  // Stepped heights (1/3, 2/3, 3/3) — read like cell signal bars.
  const heights = ['h-1', 'h-1.5', 'h-2.5'];
  return (
    <span
      title={label}
      className={`inline-flex items-end gap-[2px] ${className}`}
      aria-label={label}
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

/**
 * Connection-quality bars overlaid on the camera-off avatar tile.
 * The LiveKit ParticipantTile the camera-on path renders has its
 * own indicator, so we only need this for the no-video fallback.
 */
/**
 * Persistent top-left signal-strength indicator. Rendered at the tile
 * root so it shows regardless of camera state and stays clear of the
 * bottom-right mute/host-control buttons. z-20 keeps it above LiveKit's
 * built-in metadata strip (which we suppress in the meet room layout
 * to avoid a double indicator).
 */
function PersistentConnectionBars({ participant }: { participant: Participant }) {
  const { quality } = useConnectionQualityIndicator({ participant });
  return (
    <ConnectionBars
      quality={quality}
      className="pointer-events-none absolute left-2 top-2 z-20 rounded bg-black/50 px-1 py-1 ring-1 ring-white/10"
    />
  );
}

/**
 * Camera tile that reports its video's aspect ratio up to the layout. Phone
 * cameras publish a PORTRAIT frame; the justified layout sizes the tile to that
 * ratio so the video fills it (object-cover) with no crop and no letterbox —
 * the tile itself becomes portrait, like Google Meet. Until the ratio is known
 * the tile defaults to 16:9.
 */
function CameraTile({
  track,
  onAspect,
}: {
  track: TrackReferenceOrPlaceholder;
  onAspect?: (ratio: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let video: HTMLVideoElement | null = null;
    const measure = () => {
      if (video && video.videoWidth && video.videoHeight) {
        onAspect?.(video.videoWidth / video.videoHeight);
      }
    };
    // The <video> is attached asynchronously by LiveKit, so poll briefly until
    // it appears, then track intrinsic-size changes (incl. device rotation).
    let tries = 0;
    const tick = () => {
      const el = root.querySelector('video');
      if (el && el !== video) {
        video?.removeEventListener('resize', measure);
        video?.removeEventListener('loadedmetadata', measure);
        video = el;
        video.addEventListener('resize', measure);
        video.addEventListener('loadedmetadata', measure);
      }
      measure();
    };
    tick();
    const id = setInterval(() => {
      tries += 1;
      tick();
      if (tries > 20) clearInterval(id); // ~10s safety net
    }, 500);
    return () => {
      clearInterval(id);
      video?.removeEventListener('resize', measure);
      video?.removeEventListener('loadedmetadata', measure);
    };
  }, [onAspect]);

  return (
    <div ref={ref} className="h-full w-full">
      <ParticipantTile trackRef={track} />
    </div>
  );
}

/**
 * Largest uniform tile HEIGHT such that tiles (each width = height × aspect)
 * pack into rows that fit the container — a "justified gallery" fit. Binary
 * search on height; greedy row-packing in order. Handles mixed aspect ratios
 * (portrait + landscape) so each tile keeps its true shape at the biggest size
 * that still fits, with no overflow.
 */
function bestTileHeight(W: number, H: number, ratios: number[], gap: number): number {
  if (!W || !H || ratios.length === 0) return 0;
  let lo = 24;
  let hi = H;
  let best = 24;
  for (let iter = 0; iter < 30; iter++) {
    const h = (lo + hi) / 2;
    let rows = 1;
    let rowW = 0;
    let overflow = false;
    for (const r of ratios) {
      const w = h * r;
      if (w > W + 0.5) {
        overflow = true; // a single tile is wider than the container at this h
        break;
      }
      if (rowW === 0) rowW = w;
      else if (rowW + gap + w <= W) rowW += gap + w;
      else {
        rows += 1;
        rowW = w;
      }
    }
    const neededH = rows * h + (rows - 1) * gap;
    if (!overflow && neededH <= H) {
      best = h;
      lo = h;
    } else {
      hi = h;
    }
  }
  return best;
}

/**
 * Justified tile layout: each tile is sized to its own aspect ratio and packed
 * to fill the available area at the largest size that fits. Replaces the rigid
 * uniform grid so portrait (mobile) participants get portrait tiles instead of
 * a cropped / letterboxed landscape cell.
 */
function JustifiedTiles({
  tracks,
  renderTile,
  gap = 12,
}: {
  tracks: TrackReferenceOrPlaceholder[];
  renderTile: (track: TrackReferenceOrPlaceholder, onAspect: (r: number) => void) => React.ReactNode;
  gap?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [aspects, setAspects] = useState<Record<string, number>>({});

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const ratios = tracks.map((t) => {
    const r = aspects[t.participant.sid];
    // Clamp so an extreme ratio can't blow up the packing; default landscape.
    return Math.min(2, Math.max(0.45, r || 16 / 9));
  });
  const tileH = bestTileHeight(size.w, size.h, ratios, gap);

  const reportAspect = (sid: string) => (r: number) =>
    setAspects((prev) => (prev[sid] === r ? prev : { ...prev, [sid]: r }));

  // Below md (phones / portrait tablets) the desktop aspect-justified packer
  // leaves big empty bands — tiles get width-capped and float. Mobile instead
  // uses an aspect-aware hybrid, matching how viewers expect phone video:
  //
  //   • 1–2 participants → full-width vertical stack where each band's HEIGHT is
  //     distributed by flexbox in proportion to that video's natural height
  //     (portrait phone → tall band, laptop landscape → short band). Video fills
  //     its band edge-to-edge (object-cover). Because flexbox always splits the
  //     exact available height, the column can NEVER overflow — so no tile can
  //     end up hidden behind the control bar, and there are no black side bands.
  //   • 3+ participants → uniform 2/3-col grid, cells object-cover (the
  //     standard mobile gallery; aspect-true would shrink everyone too far).
  //
  // Justified packing stays for md+ . The ref lives on a stable outer wrapper
  // so the ResizeObserver keeps firing across the layout switch (rotation).
  const isMobile = size.w > 0 && size.w < 768;

  let inner: React.ReactNode;
  if (isMobile && tracks.length <= 2) {
    inner = (
      <div
        className="flex h-full w-full flex-col overflow-hidden [&_video]:!object-cover"
        style={{ gap }}
      >
        {tracks.map((track, i) => (
          <div
            key={track.participant.sid}
            className="min-h-0 w-full"
            // Grow ∝ the video's natural height (1/ratio): a portrait tile claims
            // more vertical space than a landscape one, but the bands always sum
            // to exactly the container height.
            style={{ flexGrow: 1 / ratios[i], flexShrink: 1, flexBasis: 0 }}
          >
            {renderTile(track, reportAspect(track.participant.sid))}
          </div>
        ))}
      </div>
    );
  } else if (isMobile) {
    const cols = size.w >= 600 && tracks.length > 4 ? 3 : 2;
    inner = (
      <div
        className="grid h-full w-full [&_video]:!object-cover"
        style={{
          gap,
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridAutoRows: '1fr',
        }}
      >
        {tracks.map((track) => (
          <div key={track.participant.sid} className="min-h-0 min-w-0">
            {renderTile(track, reportAspect(track.participant.sid))}
          </div>
        ))}
      </div>
    );
  } else {
    inner = (
      <div
        className="flex h-full w-full flex-wrap content-center items-center justify-center"
        style={{ gap }}
      >
        {tracks.map((track, i) => (
          <div
            key={track.participant.sid}
            style={
              tileH > 0
                ? { height: tileH, width: tileH * ratios[i] }
                : { height: '100%', flex: '1 1 0' }
            }
          >
            {renderTile(track, reportAspect(track.participant.sid))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={ref} className="h-full w-full overflow-hidden">
      {inner}
    </div>
  );
}

export type RoomLayout = 'gallery' | 'spotlight' | 'presenter';

/**
 * The note-taker bot joins LiveKit as a real participant. We render
 * its tile in the grid alongside humans so the meeting clearly shows
 * that someone is listening — the tile is rendered specially below
 * (no avatar initials, headphones icon, "Listening" label) instead
 * of the generic camera-off treatment.
 */
export function isBotParticipant(participant: Participant): boolean {
  if (!participant.metadata) return false;
  try {
    const meta = JSON.parse(participant.metadata);
    return meta?.isBot === true;
  } catch {
    return false;
  }
}

interface VideoGridProps {
  isHost?: boolean;
  onKickParticipant?(identity: string, name: string): void;
  onMuteParticipant?(identity: string, trackSid: string): void;
  isBackgroundProcessing?: boolean;
  // Legacy props for officestream backward compat
  hasScreenShare?: boolean;
  layout?: RoomLayout;
}

/**
 * "Currently talking" mic visualizer, Google-Meet style. Three vertical
 * bars driven by the same `micBounce` keyframe with staggered
 * animation-delay so they bounce out of phase and read as audio
 * activity. Rendered inside SpeakingBorderWrapper's top-right corner
 * whenever useIsSpeaking(participant) flips true — same trigger as the
 * existing green-border treatment. Pure CSS; no audio analysis or
 * per-frame work.
 */
function SpeakingMicIndicator() {
  // Staggered phases (ms) so the three bars look like a real
  // visualizer rather than three synced bouncers.
  const phases = [0, 150, 300];
  return (
    <div
      className="pointer-events-none absolute right-2 top-2 z-20 flex items-end gap-[2px] rounded-full bg-black/55 px-1.5 py-1 ring-1 ring-white/10"
      aria-label="Speaking"
    >
      {phases.map((delay) => (
        <span
          key={delay}
          className="h-3 w-[3px] origin-bottom rounded-[1px] bg-emerald-400"
          style={{
            animation: 'micBounce 0.9s ease-in-out infinite',
            animationDelay: `${delay}ms`,
          }}
        />
      ))}
    </div>
  );
}

function SpeakingBorderWrapper({
  participant,
  children,
  isHost,
  isScreenShare,
  isSharing,
  isBackgroundProcessing,
  onKick,
  onMute,
}: {
  participant: Participant;
  children: React.ReactNode;
  isHost: boolean;
  isScreenShare?: boolean;
  isSharing?: boolean;
  isBackgroundProcessing?: boolean;
  onKick?(identity: string, name: string): void;
  onMute?(identity: string, trackSid: string): void;
}) {
  const isSpeaking = useIsSpeaking(participant);
  // Resolve the display name from the safest source first. LiveKit's
  // `participant.name` is unset on our tokens, and
  // `participant.identity` is the raw 24-hex mongo userId for
  // authenticated webinar users — surfacing that on a tile would
  // leak an internal id. Prefer the token-baked `displayName` (it
  // arrives shortly after connect), then `participant.name` if
  // somehow present, and only use identity when it doesn't look
  // like an ObjectId.
  const { displayName: tileMetaName } = parseParticipantMeta(
    participant.metadata,
  );
  const identityLooksLikeId = /^[a-f0-9]{24}$/i.test(
    participant.identity ?? '',
  );
  const fallbackTileName = identityLooksLikeId
    ? 'Participant'
    : participant.identity || 'Guest';
  const name = tileMetaName || participant.name || fallbackTileName;

  // Check if camera is enabled
  const cameraTrack = participant.getTrackPublications().find(
    (pub) => pub.source === Track.Source.Camera,
  );
  const isCameraOn = cameraTrack?.track && !cameraTrack.isMuted;

  // Check if mic is muted
  const micTrack = participant.getTrackPublications().find(
    (pub) => pub.source === Track.Source.Microphone,
  );
  const isMicMuted = !micTrack?.track || micTrack.isMuted;

  // Find the audio track for muting
  const audioTrack = participant.getTrackPublications().find(
    (pub) => pub.source === Track.Source.Microphone && pub.track,
  );

  const { avatar } = parseParticipantMeta(participant.metadata);
  const isBot = isBotParticipant(participant);

  return (
    <div
      className={`group relative rounded-2xl overflow-hidden bg-[#1a1a20] h-full w-full transition-all duration-300 ${
        isScreenShare
          ? 'border-2 border-blue-500'
          : isSpeaking
          ? 'border-2 border-green-500 shadow-[0_0_12px_rgba(34,197,94,0.4)]'
          : 'border border-[#2a2a35]'
      }`}
    >
      {/* Bot tile: distinct from a camera-off human (no avatar
          initials, no mic-muted badge — the bot is *listening*, not
          muted). Headphones icon mirrors the Memo button in the
          control bar for visual continuity. */}
      {isBot ? (
        <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#1a1a20] to-[#13131a]">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/15 ring-1 ring-brand/30 sm:h-20 sm:w-20">
            <BookHeadphones className="h-7 w-7 text-[#FFD24D] sm:h-8 sm:w-8" />
          </div>
          <p className="mt-3 text-sm font-medium text-white">{name}</p>
          <div className="mt-1.5 flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-0.5 text-[10px] font-medium text-red-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
            Listening
          </div>
        </div>
      ) : !isCameraOn && !isScreenShare ? (
        <div className="relative flex h-full w-full flex-col items-center justify-center bg-[#1a1a20]">
          <ParticipantAvatar
            name={name}
            avatarUrl={avatar}
            sizeClass="h-16 w-16 sm:h-20 sm:w-20"
            textSizeClass="text-xl sm:text-2xl"
            className="mb-3"
          />
          <p className="text-sm font-medium text-white">{name}</p>
          {isMicMuted && (
            <div className="mt-1.5 flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-400">
              <MicOff className="h-3 w-3" />
              Muted
            </div>
          )}
        </div>
      ) : (
        children
      )}

      {/* Persistent top-left signal indicator — visible regardless of
          camera/screen-share state so it never collides with the
          mute/host-control buttons in the bottom-right corner. Bot
          tiles are excluded (no network channel of their own to
          report on). */}
      {!isBot && <PersistentConnectionBars participant={participant} />}

      {/* Persistent name label (Google Meet / Zoom style) — bottom-left,
          visible on every tile regardless of camera state so people can
          always tell who they're looking at. Suppressed on:
            - screen-share tile (has its own "X · Presenting" label
              in the top-left)
            - camera-off tile (name is already rendered large under
              the avatar; a second copy at the bottom would be noise)
            - bot tile (name already rendered under the bot icon)
          Mic-muted state gets a small icon prefix so muted speakers
          are readable at a glance without hovering. */}
      {!isBot && !isScreenShare && isCameraOn && (
        <div className="pointer-events-none absolute bottom-2 left-2 z-10 flex max-w-[calc(100%-56px)] items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
          {isMicMuted && <MicOff className="h-3 w-3 shrink-0 text-red-400" />}
          <span className="truncate">
            {name}
            {participant.isLocal && (
              <span className="ml-1 text-white/50">(you)</span>
            )}
          </span>
        </div>
      )}

      {/* Background processing overlay (local participant only) */}
      {isBackgroundProcessing && participant.isLocal && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#1a1a20]/90">
          <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
          <p className="mt-2 text-xs text-gray-400">Applying background...</p>
        </div>
      )}

      {/* Sharing badge */}
      {isSharing && !isScreenShare && (
        <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-green-500/90 px-2 py-0.5 text-[10px] font-medium text-white">
          <ScreenShare className="h-3 w-3" />
          Sharing
        </div>
      )}

      {/* "Person is talking" mic indicator — top-right when speaking.
          Suppressed during screen-share so it doesn't fight the Sharing
          badge for the same corner, and when the mic is muted (which can
          briefly flip isSpeaking on some backends as the audio level
          decays toward zero). */}
      {isSpeaking && !isScreenShare && !isSharing && !isMicMuted && (
        <SpeakingMicIndicator />
      )}


      {/* Host controls overlay */}
      {isHost && !participant.isLocal && !isScreenShare && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {audioTrack?.track && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMute?.(participant.identity, audioTrack.trackSid);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/80 text-white transition hover:bg-red-600"
              title="Mute"
            >
              <MicOff className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onKick?.(participant.identity, name);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600/80 text-white transition hover:bg-red-700"
            title="Remove"
          >
            <UserX className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function VideoGrid({
  isHost = false,
  onKickParticipant,
  onMuteParticipant,
  isBackgroundProcessing = false,
  hasScreenShare: hasScreenShareProp,
  layout,
}: VideoGridProps) {
  const cameraTracksRaw = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  const screenTracksRaw = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }]);
  // The note-taker bot publishes nothing (canPublish=false) so it gets
  // a placeholder track ref from useTracks. We DO want it in the grid —
  // SpeakingBorderWrapper renders a bot-specific tile below.
  const screenTracks = screenTracksRaw;
  const participants = useParticipants();

  // Tile order is intentionally LiveKit's default (sid-based, stable)
  // — we used to re-sort by isSpeaking on every render, but isSpeaking
  // flips every time a person pauses for breath, so tiles ended up
  // bouncing around the grid every second. Active speakers are
  // signalled by SpeakingBorderWrapper (green ring + pulse) instead of
  // a layout shuffle, which gives the same "who's talking" affordance
  // without the motion-sickness side effect.
  //
  // Filter out audience subscribers (TV preview viewers). They can't
  // publish anything, but `withPlaceholder: true` on useTracks still
  // creates a placeholder track ref for them — that's why a bare
  // "audience-xxx" tile was popping into the host's grid every time
  // someone opened /tv.
  const cameraTracksAll = cameraTracksRaw.filter((t) => {
    const meta = parseParticipantMeta(t.participant.metadata);
    return !meta.isAudience;
  });

  // Active-speaker identities (one hook at grid level) — keeps whoever is
  // talking on-screen when the room is capped below.
  const speakingParticipants = useSpeakingParticipants();
  const speakingIdentities = useMemo(
    () => new Set(speakingParticipants.map((p) => p.identity)),
    [speakingParticipants],
  );

  // Grid ceiling — Google-Meet-style pagination for very large rooms. Past the
  // cap the justified packer collapses tiles into unusable strips (the "purple
  // bar"). Render at most MAX_GRID_TILES, prioritising: local user > active
  // speakers > live cameras > stable sid order; the rest collapse into one
  // "+N more" pill. Below the cap every track renders as before.
  const MAX_GRID_TILES = 25;
  const overflow = Math.max(0, cameraTracksAll.length - MAX_GRID_TILES);
  const cameraTracks = useMemo(() => {
    if (cameraTracksAll.length <= MAX_GRID_TILES) return cameraTracksAll;
    const score = (t: TrackReferenceOrPlaceholder) => {
      let s = 0;
      if (t.participant.isLocal) s += 1000;
      if (speakingIdentities.has(t.participant.identity)) s += 500;
      if (t.publication?.track && !t.publication.isMuted) s += 100;
      return s;
    };
    const sorted = [...cameraTracksAll].sort((a, b) => {
      const d = score(b) - score(a);
      if (d !== 0) return d;
      // Stable fallback on sid so the tile order doesn't churn.
      return a.participant.sid.localeCompare(b.participant.sid);
    });
    // Leave a slot for the "+N more" indicator so total = MAX_GRID_TILES.
    return sorted.slice(0, MAX_GRID_TILES - 1);
  }, [cameraTracksAll, speakingIdentities]);

  // Legacy mode: when hasScreenShare/layout props are provided, use old simple rendering
  if (hasScreenShareProp !== undefined || layout !== undefined) {
    return <LegacyVideoGrid cameraTracks={cameraTracks} screenTracks={screenTracks} hasScreenShare={hasScreenShareProp} layout={layout} />;
  }

  // Identify who is screen sharing
  const sharingIdentities = new Set(screenTracks.map((t) => t.participant.identity));

  const hasScreenShare = screenTracks.length > 0;

  // Screen share view
  if (hasScreenShare) {
    // Presenter identity for the label overlay. When multiple people
    // share we only mount the first track's tile here anyway, so
    // reading name off screenTracks[0].participant matches what the
    // viewer actually sees.
    const presenter = screenTracks[0].participant;
    const presenterMeta = parseParticipantMeta(presenter.metadata);
    const presenterName =
      presenter.name ||
      presenterMeta.displayName ||
      presenter.identity ||
      "Someone";
    const isLocalPresenter = presenter.isLocal;
    return (
      <div className="flex h-full flex-col sm:flex-row gap-2 overflow-hidden">
        {/* Main screen share area */}
        <div className="relative flex-1 min-h-0">
          <SpeakingBorderWrapper
            participant={screenTracks[0].participant}
            isHost={isHost}
            isScreenShare
            onKick={onKickParticipant}
            onMute={onMuteParticipant}
          >
            <div className="screenshare-tile h-full w-full">
              <ParticipantTile trackRef={screenTracks[0]} />
            </div>
          </SpeakingBorderWrapper>
          {/* Presenter label — matches NC's PiP label pattern
              ("<name> · Presenting"). Sits top-left of the share
              tile so it doesn't collide with the Sharing badge that
              rides the camera thumbnails top-right. Local presenter
              gets an amber tint so they can spot at a glance that
              they're the one broadcasting. */}
          <div
            className={
              "pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-white shadow-lg " +
              (isLocalPresenter
                ? "bg-amber-500/90 text-black"
                : "bg-black/70")
            }
          >
            <ScreenShare className="h-3 w-3" />
            <span>
              {isLocalPresenter ? "You" : presenterName} · Presenting
            </span>
          </div>
        </div>

        {/* Camera strip */}
        <div className="flex sm:flex-col gap-2 overflow-x-auto sm:overflow-y-auto sm:overflow-x-hidden sm:w-48 h-28 sm:h-auto shrink-0">
          {cameraTracks.map((track) => (
            <div key={track.participant.sid} className="w-32 sm:w-auto shrink-0 sm:h-44">
              <SpeakingBorderWrapper
                participant={track.participant}
                isHost={isHost}
                isSharing={sharingIdentities.has(track.participant.identity)}
                isBackgroundProcessing={isBackgroundProcessing}
                onKick={onKickParticipant}
                onMute={onMuteParticipant}
              >
                <CameraTile track={track} />
              </SpeakingBorderWrapper>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Camera-only grid (no screen share): justified layout — each tile is sized
  // to its own aspect ratio (portrait phones get portrait tiles) and packed to
  // fill the area at the largest size that fits. Replaces both the rigid
  // uniform grid and the single-participant special case, so a mobile/portrait
  // participant no longer gets cropped or letterboxed into a landscape cell.
  return (
    <div className="relative h-full w-full">
      <JustifiedTiles
        tracks={cameraTracks}
        gap={cameraTracks.length > 6 ? 8 : 12}
        renderTile={(track, onAspect) => (
          <SpeakingBorderWrapper
            participant={track.participant}
            isHost={isHost}
            isSharing={sharingIdentities.has(track.participant.identity)}
            isBackgroundProcessing={isBackgroundProcessing}
            onKick={onKickParticipant}
            onMute={onMuteParticipant}
          >
            <CameraTile track={track} onAspect={onAspect} />
          </SpeakingBorderWrapper>
        )}
      />
      {/* "+N more" pill — only when we sliced past the cap. Bottom-left so it
          doesn't collide with the top-right sharing / speaker badges. The
          People sidebar still lists everyone. */}
      {overflow > 0 && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/10 backdrop-blur">
          <span aria-hidden>+{overflow}</span>
          <span className="text-white/70">more</span>
        </div>
      )}
    </div>
  );
}

/** Legacy rendering for officestream backward compat (no host controls, no speaking borders). */
function LegacyVideoGrid({
  cameraTracks,
  screenTracks,
  hasScreenShare,
  layout = 'spotlight',
}: {
  cameraTracks: TrackReferenceOrPlaceholder[];
  screenTracks: TrackReferenceOrPlaceholder[];
  hasScreenShare?: boolean;
  layout?: RoomLayout;
}) {
  const { gridStyle } = useVideoGrid(cameraTracks.map((t) => t.participant) as Participant[]);

  if (hasScreenShare && screenTracks.length > 0) {
    if (layout === 'presenter') {
      return (
        <div className="h-full w-full rounded-xl overflow-hidden bg-[#0f3460] screenshare-tile">
          <ParticipantTile trackRef={screenTracks[0]} />
        </div>
      );
    }
    if (layout === 'gallery') {
      return (
        <div className="grid h-full gap-2 overflow-hidden" style={gridStyle}>
          {cameraTracks.map((track) => (
            <div key={track.participant.sid} className="relative rounded-xl overflow-hidden bg-[#0f3460]">
              <ParticipantTile trackRef={track} />
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="flex h-full gap-2 overflow-hidden">
        <div className="flex-1 rounded-xl overflow-hidden bg-[#0f3460] screenshare-tile">
          <ParticipantTile trackRef={screenTracks[0]} />
        </div>
        <div className="flex w-48 flex-col gap-2 overflow-y-auto">
          {cameraTracks.map((track) => (
            <div key={track.participant.sid} className="aspect-video rounded-lg overflow-hidden bg-[#0f3460] shrink-0">
              <ParticipantTile trackRef={track} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (cameraTracks.length <= 1) {
    return (
      <div className="flex h-full w-full items-center justify-center overflow-hidden">
        {cameraTracks.map((track) => (
          <div key={track.participant.sid} className="relative h-full w-full rounded-xl overflow-hidden bg-[#0f3460]">
            <ParticipantTile trackRef={track} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid h-full gap-2 overflow-hidden" style={gridStyle}>
      {cameraTracks.map((track) => (
        <div key={track.participant.sid} className="relative rounded-xl overflow-hidden bg-[#0f3460]">
          <ParticipantTile trackRef={track} />
        </div>
      ))}
    </div>
  );
}
