'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import {
  useLocalParticipant,
  useMediaDeviceSelect,
  useMultibandTrackVolume,
} from '@livekit/components-react';
import { Track, type LocalAudioTrack } from 'livekit-client';
import { useScreenShare } from '@/hooks/office/useScreenShare';
import { motion } from 'framer-motion';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  Link2,
  Check,
  PictureInPicture2,
  CircleDot,
  Square,
  MoreVertical,
  PhoneOff,
  Loader2,
  ChevronUp,
  Sparkles,
  Smile,
  BookHeadphones,
  Hand,
  ShoppingBag,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import VirtualBackgroundPicker from './VirtualBackgroundPicker';
import { REACTION_EMOJIS } from '@/hooks/office/useEmojiReactions';
import type { BackgroundType } from '@/hooks/office/useVirtualBackground';
import { fetchMyAffiliateId } from '@/lib/api/garage';

interface ControlBarProps {
  onLeave(): void;
  isHost?: boolean;
  // True when this room belongs to a Webinar entity. Combined with
  // !isHost it puts the bar into watch-only mode: mic/cam/screen
  // controls are hidden because the LiveKit token denies publishing
  // anyway, and pressing them would only error.
  isWebinar?: boolean;
  // Recording
  recording?: boolean;
  recordingLoading?: boolean;
  onRecordStart?(): void;
  onRecordStop?(): void;
  // (sidebar is controlled from header, not control bar)
  // PiP
  isPipSupported?: boolean;
  onOpenPip?(): void;
  // Copy link
  roomId?: string;
  // Connected state
  connected?: boolean;
  // End meeting (host)
  onEndMeeting?(): void;
  // Virtual background
  backgroundType?: BackgroundType;
  backgroundImage?: string;
  isBackgroundProcessing?: boolean;
  onSetBlur?(): void;
  onSetImage?(url: string): void;
  onRemoveBackground?(): void;
  // Emoji reactions
  onSendReaction?(emoji: string): void;
  // Voice memo (per-user)
  onOpenMemoPanel?(): void;
  /** Webinar "Sell" — opens the cross-org product picker. When
   *  the callback is provided AND the user is the host, a
   *  ShoppingBag button renders inline with the rest of the
   *  controls (Garage parity — Sell sits in the control bar, not
   *  the header). Non-host attendees never see it. */
  onSellClick?(): void;
}

/**
 * Make raw device labels human-readable. Browsers expose strings like
 * "camera2 0, facing front (49ba)" or "Default - Speakers (Realtek)";
 * this maps the most common patterns to clean labels users actually
 * understand. Falls back to the original label when nothing matches.
 */
function prettifyDeviceLabel(label: string, kind: MediaDeviceKind): string {
  const raw = (label || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (kind === 'videoinput') {
    if (/(facing\s+)?front|front[\s-]?camera|user/.test(lower)) return 'Front Camera';
    if (/(facing\s+)?back|rear[\s-]?camera|environment/.test(lower)) return 'Back Camera';
    if (/built[\s-]?in|integrated|facetime|webcam/.test(lower)) return 'Built-in Camera';
    if (/external|usb/.test(lower)) return 'External Camera';
    return raw;
  }
  if (kind === 'audiooutput') {
    if (/^default(\s|$)/i.test(raw)) return 'Default Speaker';
    if (/communications/i.test(lower)) return 'Communications Speaker';
    if (/headphone|airpod|earbuds|earpods/.test(lower)) return 'Headphones';
    if (/bluetooth|bt\b/.test(lower)) return 'Bluetooth Speaker';
    if (/speaker|output/.test(lower)) return 'Speaker';
    return raw;
  }
  if (kind === 'audioinput') {
    if (/^default(\s|$)/i.test(raw)) return 'Default Microphone';
    if (/communications/i.test(lower)) return 'Communications Mic';
    if (/headphone|airpod|earbuds|earpods/.test(lower)) return 'Headphone Mic';
    if (/bluetooth|bt\b/.test(lower)) return 'Bluetooth Mic';
    if (/built[\s-]?in|integrated/.test(lower)) return 'Built-in Microphone';
    if (/microphone|mic\b/.test(lower)) return 'Microphone';
    return raw;
  }
  return raw;
}

/**
 * Google-Meet-style audio level bars — 3 thin bars whose heights track
 * your mic input in real time. Rendered inside the mic toggle so the
 * speaker can see at a glance that the mic is picking them up.
 *
 * Why multiband instead of a single RMS: a single level produces three
 * bars that all move in lockstep, which doesn't read as audio. Three
 * bands (low/mid/high) move independently, which actually looks like
 * sound. Update interval 80ms ~= 12.5fps — slow enough that React isn't
 * re-rendering every animation frame, fast enough to feel reactive.
 */
function MicLevelBars({ track }: { track: LocalAudioTrack | undefined }) {
  const levels = useMultibandTrackVolume(track, {
    bands: 3,
    updateInterval: 80,
    loPass: 100,
    hiPass: 600,
  });
  if (!track || levels.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-1.5 flex items-end justify-center gap-[3px]">
      {levels.map((lvl, i) => {
        // Clamp so a quiet room still shows a 2px baseline (visual cue
        // that the mic is live) and a shout caps at 14px (fits inside
        // the 40/48px button without overflowing the icon).
        // Quiet rooms keep a 2px baseline so the indicator visibly
        // exists; loud caps at 9px so the bars never collide with the
        // mic icon (h-5 = 20px, centered in a 40–48px button).
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

function DeviceList({
  kind,
  label,
}: {
  kind: MediaDeviceKind;
  label: string;
}) {
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind });

  if (devices.length === 0) return null;

  // Dedup-by-suffix: phones expose several "Back Camera"s (wide/ultra/tele).
  // Keep each distinct sensor (selection keys on deviceId) but number repeats
  // so the list doesn't show "Back Camera" three identical times.
  const seen: Record<string, number> = {};
  const labels = devices.map((d) => {
    const base = prettifyDeviceLabel(d.label, kind) || `Device ${d.deviceId.slice(0, 4)}`;
    seen[base] = (seen[base] || 0) + 1;
    return seen[base] > 1 ? `${base} ${seen[base]}` : base;
  });

  return (
    <div>
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <div className="flex flex-col gap-0.5">
        {devices.map((d, i) => {
          const friendly = labels[i];
          return (
          <button
            key={d.deviceId}
            onClick={() => setActiveMediaDevice(d.deviceId)}
            className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
              d.deviceId === activeDeviceId
                ? 'bg-white/[0.08] text-white'
                : 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-200'
            }`}
          >
            {friendly || `Device ${d.deviceId.slice(0, 8)}`}
          </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ControlBar({
  onLeave,
  isHost = false,
  isWebinar = false,
  recording = false,
  recordingLoading,
  onRecordStart,
  onRecordStop,
  isPipSupported = false,
  onOpenPip,
  roomId,
  connected = true,
  onEndMeeting,
  backgroundType = 'none',
  backgroundImage = '',
  isBackgroundProcessing = false,
  onSetBlur,
  onSetImage,
  onRemoveBackground,
  onSendReaction,
  onSellClick,
  onOpenMemoPanel,
}: ControlBarProps) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, microphoneTrack } = useLocalParticipant();
  const { sharing, toggle: toggleScreen, supported: screenShareSupported } = useScreenShare(localParticipant);
  // The actual LocalAudioTrack the multiband analyser needs to attach to.
  // `microphoneTrack` is the *publication*, so unwrap `.audioTrack`. If the
  // user hasn't enabled the mic yet (no publication, or muted via a server
  // policy), this will be undefined and MicLevelBars renders nothing.
  const micAudioTrack =
    (microphoneTrack?.audioTrack as LocalAudioTrack | undefined) ?? undefined;
  const [copied, setCopied] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const toggleMic = useCallback(async () => {
    await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  }, [localParticipant, isMicrophoneEnabled]);

  const toggleCam = useCallback(async () => {
    await localParticipant.setCameraEnabled(!isCameraEnabled);
  }, [localParticipant, isCameraEnabled]);

  // Cache the host's Garage affiliate id once per page lifetime so
  // every invite-link click doesn't re-hit Garage's backend. null
  // means "not loaded yet"; "" means "loaded but host has no aff_…"
  // (so we know to skip appending instead of refetching).
  const myAffiliateIdRef = useRef<string | null>(null);

  async function copyLink() {
    // Append the host's Garage affiliate id as `?ref=<id>` so the
    // guest's pre-join prompt pre-fills the Affiliate ID field and
    // attribution flows through automatically. Falls back to the raw
    // URL when the host has no aff_… or Garage is unreachable.
    let href = window.location.href;
    try {
      let aff = myAffiliateIdRef.current;
      if (aff === null) {
        aff = (await fetchMyAffiliateId()) || '';
        myAffiliateIdRef.current = aff;
      }
      if (aff) {
        const url = new URL(window.location.href);
        // First-touch wins: if the URL already has ?ref= (this user
        // joined the meet via someone else's affiliate link), keep it.
        if (!url.searchParams.has('ref')) {
          url.searchParams.set('ref', aff);
          href = url.toString();
        }
      }
    } catch {
      /* fall back to raw href */
    }
    navigator.clipboard.writeText(href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }


  const disabled = !connected;
  // Webinar viewers can't publish — hide every control that would
  // produce a track. The LiveKit token already denies publishing
  // server-side; this just keeps users from clicking buttons that
  // would 401 on the wire.
  const viewerMode = isWebinar && !isHost;

  // Local raise-hand state for webinar viewers. Visual-only for now;
  // a future increment can broadcast it via LiveKit DataChannel so
  // hosts see who has their hand up in the People panel (Garage
  // does this via socket.io). Mirrors Garage's viewer ControlBar
  // layout, where attendees get Hand + React + Leave instead of
  // mic/cam/screen.
  const [handRaised, setHandRaised] = useState(false);

  return (
    <div className="no-scrollbar relative flex flex-nowrap items-end [justify-content:safe_center] gap-2 sm:gap-3 lg:gap-4 overflow-x-auto overflow-y-hidden border-t border-[#2a2a35] bg-[#111116] px-3 sm:px-4 py-2 sm:py-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {viewerMode && (
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => setHandRaised((v) => !v)}
            disabled={disabled}
            className={`flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full transition disabled:opacity-50 ${
              handRaised
                ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
            title={handRaised ? 'Lower hand' : 'Raise hand'}
          >
            <Hand className="h-5 w-5" />
          </button>
          <span className="text-[9px] sm:text-[10px] text-gray-500">
            {handRaised ? 'Lower' : 'Raise'}
          </span>
        </div>
      )}
      {!viewerMode && (
      <>
      {/* Mic with device selector */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center">
          <button
            onClick={toggleMic}
            disabled={disabled}
            className={`relative flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full rounded-r-none transition disabled:opacity-50 ${
              !isMicrophoneEnabled
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
            title={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
          >
            {isMicrophoneEnabled ? (
              <>
                <Mic className="h-5 w-5 -translate-y-1" />
                <MicLevelBars track={micAudioTrack} />
              </>
            ) : (
              <MicOff className="h-5 w-5" />
            )}
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button
                disabled={disabled}
                className="flex h-11 w-7 sm:h-12 sm:w-6 items-center justify-center rounded-r-full bg-gray-700 text-gray-400 transition hover:bg-gray-600 hover:text-white disabled:opacity-50 border-l border-gray-600"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              collisionPadding={12}
              className="w-64 max-w-[calc(100vw-1.5rem)] border-[#2a2a35] bg-[#1a1a20] p-3 shadow-xl"
            >
              <DeviceList kind="audioinput" label="Microphone" />
              <div className="my-2 border-t border-[#2a2a35]" />
              <DeviceList kind="audiooutput" label="Speaker" />
            </PopoverContent>
          </Popover>
        </div>
        <span className="text-[9px] sm:text-[10px] text-gray-500">{isMicrophoneEnabled ? 'Mic' : 'Unmute'}</span>
      </div>

      {/* Camera with device selector */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center">
          <button
            onClick={toggleCam}
            disabled={disabled}
            className={`flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full rounded-r-none transition disabled:opacity-50 ${
              !isCameraEnabled
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
            title={isCameraEnabled ? 'Stop video' : 'Start video'}
          >
            {isCameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button
                disabled={disabled}
                className="flex h-11 w-7 sm:h-12 sm:w-6 items-center justify-center rounded-r-full bg-gray-700 text-gray-400 transition hover:bg-gray-600 hover:text-white disabled:opacity-50 border-l border-gray-600"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              collisionPadding={12}
              className="w-64 max-w-[calc(100vw-1.5rem)] border-[#2a2a35] bg-[#1a1a20] p-3 shadow-xl"
            >
              <DeviceList kind="videoinput" label="Camera" />
            </PopoverContent>
          </Popover>
        </div>
        <span className="text-[9px] sm:text-[10px] text-gray-500">{isCameraEnabled ? 'Camera' : 'Start Video'}</span>
      </div>

      {/* Screen share */}
      <div className="flex flex-col items-center gap-1">
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <button
            onClick={toggleScreen}
            disabled={disabled}
            className={`flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full transition disabled:opacity-50 ${
              sharing
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-gray-700 text-white hover:bg-gray-600'
            } ${!screenShareSupported && !sharing ? 'opacity-40' : ''}`}
            title={
              !screenShareSupported
                ? "Your browser can't share your screen — use the app on mobile, or a computer"
                : sharing
                  ? 'Stop sharing'
                  : 'Share screen'
            }
          >
            {sharing ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />}
          </button>
        </motion.div>
        <span className="text-[9px] sm:text-[10px] text-gray-500">{sharing ? 'Stop Share' : 'Share'}</span>
      </div>
      </>
      )}

      {/* Emoji reactions */}
      <div className="flex flex-col items-center gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <button
              disabled={disabled}
              className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-gray-700 text-white transition hover:bg-gray-600 disabled:opacity-50"
              title="React"
            >
              <Smile className="h-5 w-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-auto border-[#2a2a35] bg-[#1a1a20] p-2 shadow-xl">
            <div className="flex gap-1">
              {REACTION_EMOJIS.map((e) => (
                <button
                  key={e.key}
                  onClick={() => onSendReaction?.(e.char)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-2xl transition hover:bg-white/[0.08] hover:scale-110"
                  title={e.label}
                >
                  {e.char}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <span className="text-[9px] sm:text-[10px] text-gray-500">React</span>
      </div>

      {/* Desktop-only buttons */}
      <div className="hidden sm:flex items-center gap-3">
        {/* Copy link */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={copyLink}
            disabled={disabled}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-700 text-white transition hover:bg-gray-600 disabled:opacity-50"
            title="Copy invite link"
          >
            {copied ? <Check className="h-5 w-5 text-green-400" /> : <Link2 className="h-5 w-5" />}
          </button>
          <span className="text-[10px] text-gray-500">{copied ? 'Copied!' : 'Invite'}</span>
        </div>

        {/* Virtual background */}
        <div className="flex flex-col items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <button
                disabled={disabled}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition disabled:opacity-50 ${
                  backgroundType !== 'none'
                    ? 'bg-purple-500 text-white hover:bg-purple-600'
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                }`}
                title="Virtual background"
              >
                <Sparkles className="h-5 w-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" className="w-72 border-[#2a2a35] bg-[#1a1a20] p-3 shadow-xl">
              <VirtualBackgroundPicker
                backgroundType={backgroundType}
                backgroundImage={backgroundImage}
                isProcessing={isBackgroundProcessing}
                onSetBlur={() => onSetBlur?.()}
                onSetImage={(url) => onSetImage?.(url)}
                onRemove={() => onRemoveBackground?.()}
              />
            </PopoverContent>
          </Popover>
          <span className="text-[10px] text-gray-500">Background</span>
        </div>

        {/* PiP */}
        {isPipSupported && (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={onOpenPip}
              disabled={disabled}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-700 text-white transition hover:bg-gray-600 disabled:opacity-50"
              title="Picture in picture"
            >
              <PictureInPicture2 className="h-5 w-5" />
            </button>
            <span className="text-[10px] text-gray-500">PiP</span>
          </div>
        )}

        {/* Recording (host) */}
        {isHost && (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={recording ? onRecordStop : onRecordStart}
              disabled={disabled || recordingLoading}
              className={`flex h-12 w-12 items-center justify-center rounded-full transition disabled:opacity-50 ${
                recording
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
              title={recording ? 'Stop recording' : 'Record'}
            >
              {recordingLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : recording ? (
                <Square className="h-4 w-4" />
              ) : (
                <CircleDot className="h-5 w-5" />
              )}
            </button>
            <span className="text-[10px] text-gray-500">{recording ? 'Stop Rec' : 'Record'}</span>
          </div>
        )}

        {/* Sell (webinar host only) — opens the cross-org product
            picker so the host can pin an item to the broadcast.
            Garage parity: Sell lives in the control bar, not the
            header. Rendered only when both isHost AND onSellClick
            were wired up (so meet rooms don't show it). */}
        {isHost && onSellClick && (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={onSellClick}
              disabled={disabled}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-600 text-white transition hover:bg-purple-500 disabled:opacity-50"
              title="Pin an item to sell"
            >
              <ShoppingBag className="h-5 w-5" />
            </button>
            <span className="text-[10px] text-gray-500">Sell</span>
          </div>
        )}

        {/* Voice memo — per-user, opens sidebar */}
        {onOpenMemoPanel && (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={onOpenMemoPanel}
              disabled={disabled}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-700 text-white transition hover:bg-gray-600 disabled:opacity-50"
              title="Voice memo"
            >
              <BookHeadphones className="h-5 w-5" />
            </button>
            <span className="text-[10px] text-gray-500">Memo</span>
          </div>
        )}
      </div>

      {/* Mobile overflow menu */}
      <div className="sm:hidden flex flex-col items-center gap-1">
        <Popover open={showMobileMenu} onOpenChange={setShowMobileMenu}>
          <PopoverTrigger asChild>
            <button
              disabled={disabled}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-700 text-white transition hover:bg-gray-600 disabled:opacity-50"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          </PopoverTrigger>
          {/* Portaled to <body> by Radix, so the control bar's overflow-x-auto
              (which also clips the Y axis) can't cut the menu off. */}
          <PopoverContent
            side="top"
            align="end"
            collisionPadding={12}
            className="w-64 max-w-[calc(100vw-1.5rem)] max-h-[70vh] overflow-y-auto border-[#2a2a35] bg-[#1a1a24] p-1.5 shadow-xl"
          >
            {/* Copy invite link */}
            <button
              onClick={() => { copyLink(); setShowMobileMenu(false); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-gray-300 hover:bg-white/[0.06]"
            >
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Link2 className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy invite link'}
            </button>

            {/* Virtual background */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-gray-300 hover:bg-white/[0.06]">
                  <Sparkles className="h-4 w-4" />
                  Virtual background
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" className="w-72 border-[#2a2a35] bg-[#1a1a20] p-3 shadow-xl">
                <VirtualBackgroundPicker
                  backgroundType={backgroundType}
                  backgroundImage={backgroundImage}
                  isProcessing={isBackgroundProcessing}
                  onSetBlur={() => onSetBlur?.()}
                  onSetImage={(url) => onSetImage?.(url)}
                  onRemove={() => onRemoveBackground?.()}
                />
              </PopoverContent>
            </Popover>

            {/* PiP */}
            {isPipSupported && (
              <button
                onClick={() => { onOpenPip?.(); setShowMobileMenu(false); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-gray-300 hover:bg-white/[0.06]"
              >
                <PictureInPicture2 className="h-4 w-4" />
                Picture in picture
              </button>
            )}

            {/* Recording — host only */}
            {isHost && (
              <button
                onClick={() => {
                  recording ? onRecordStop?.() : onRecordStart?.();
                  setShowMobileMenu(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-gray-300 hover:bg-white/[0.06]"
              >
                {recording ? <Square className="h-4 w-4 text-red-400" /> : <CircleDot className="h-4 w-4" />}
                {recording ? 'Stop recording' : 'Start recording'}
              </button>
            )}

            {/* Voice memo */}
            {onOpenMemoPanel && (
              <button
                onClick={() => {
                  onOpenMemoPanel();
                  setShowMobileMenu(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-gray-300 hover:bg-white/[0.06]"
              >
                <BookHeadphones className="h-4 w-4" />
                Voice memo
              </button>
            )}

            {/* Device pickers live on the mic / camera button carets (always
                visible now), not buried here — keeps this menu slim on mobile. */}
          </PopoverContent>
        </Popover>
        <span className="text-[9px] text-gray-500">More</span>
      </div>

      {/* End meeting (host) */}
      {isHost && onEndMeeting && (
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={onEndMeeting}
            disabled={disabled}
            className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-orange-600 text-white transition hover:bg-orange-700 disabled:opacity-50"
            title="End meeting"
          >
            <Square className="h-4 w-4" />
          </button>
          <span className="text-[9px] sm:text-[10px] text-gray-500">End</span>
        </div>
      )}

      {/* Leave / End — for webinar hosts, this doubles as the
          end-broadcast action so it gets the explicit "End" label,
          mirroring Garage's host PhoneOff button. */}
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={onLeave}
          className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-700"
          title={isWebinar && isHost ? 'End webinar' : 'Leave'}
        >
          <PhoneOff className="h-5 w-5" />
        </button>
        <span className="text-[9px] sm:text-[10px] text-gray-500">
          {isWebinar && isHost ? 'End' : 'Leave'}
        </span>
      </div>

      {/* Live indicator — bottom-left edge of the ControlBar. Mirrors
          Garage's webinar control bar; only rendered for webinar
          rooms so regular meet calls don't get a redundant pill. */}
      {isWebinar && (
        <div className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
          <span
            className={`w-2 h-2 rounded-full ${
              connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}
          />
          <span
            className={`text-[10px] ${
              connected ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>
      )}
    </div>
  );
}
