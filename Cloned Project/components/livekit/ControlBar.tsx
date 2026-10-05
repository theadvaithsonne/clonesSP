'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { useLocalParticipant, useMediaDeviceSelect } from '@livekit/components-react';
import { useScreenShare } from '@/hooks/livekit/useScreenShare';
import { motion } from 'framer-motion';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  MessageSquare,
  Link2,
  Check,
  PictureInPicture2,
  Users,
  CircleDot,
  Square,
  MoreVertical,
  PhoneOff,
  Loader2,
  ChevronUp,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface ControlBarProps {
  onLeave(): void;
  isHost?: boolean;
  // Recording
  recording?: boolean;
  recordingLoading?: boolean;
  onRecordStart?(): void;
  onRecordStop?(): void;
  // Chat
  isChatOpen?: boolean;
  onToggleChat?(): void;
  unreadChatCount?: number;
  // Participants
  showParticipants?: boolean;
  onToggleParticipants?(): void;
  // PiP
  isPipSupported?: boolean;
  pipActive?: boolean;
  onOpenPip?(): void;
  // Copy link
  roomId?: string;
  // Connected state
  connected?: boolean;
  // End meeting (host)
  onEndMeeting?(): void;
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

  return (
    <div>
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <div className="flex flex-col gap-0.5">
        {devices.map((d) => (
          <button
            key={d.deviceId}
            onClick={() => setActiveMediaDevice(d.deviceId)}
            className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
              d.deviceId === activeDeviceId
                ? 'bg-white/[0.08] text-white'
                : 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-200'
            }`}
          >
            {d.label || `Device ${d.deviceId.slice(0, 8)}`}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ControlBar({
  onLeave,
  isHost = false,
  recording = false,
  recordingLoading,
  onRecordStart,
  onRecordStop,
  isChatOpen = false,
  onToggleChat,
  unreadChatCount = 0,
  showParticipants = false,
  onToggleParticipants,
  isPipSupported = false,
  pipActive,
  onOpenPip,
  roomId,
  connected = true,
  onEndMeeting,
}: ControlBarProps) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const { sharing, toggle: toggleScreen } = useScreenShare(localParticipant);
  const [copied, setCopied] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const toggleMic = useCallback(async () => {
    await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  }, [localParticipant, isMicrophoneEnabled]);

  const toggleCam = useCallback(async () => {
    await localParticipant.setCameraEnabled(!isCameraEnabled);
  }, [localParticipant, isCameraEnabled]);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Close mobile menu on outside click
  useEffect(() => {
    if (!showMobileMenu) return;
    const handle = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setShowMobileMenu(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showMobileMenu]);

  const disabled = !connected;

  return (
    <div className="flex flex-wrap items-end justify-center gap-3 sm:gap-4 border-t border-[#2a2a35] bg-[#111116] px-4 py-2 sm:py-3">
      {/* Mic with device selector */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center">
          <button
            onClick={toggleMic}
            disabled={disabled}
            className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full sm:rounded-r-none transition disabled:opacity-50 ${
              !isMicrophoneEnabled
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
            title={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
          >
            {isMicrophoneEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button
                disabled={disabled}
                className="hidden sm:flex h-12 w-6 items-center justify-center rounded-r-full bg-gray-700 text-gray-400 transition hover:bg-gray-600 hover:text-white disabled:opacity-50 border-l border-gray-600"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" className="w-64 border-[#2a2a35] bg-[#1a1a20] p-3 shadow-xl">
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
            className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full sm:rounded-r-none transition disabled:opacity-50 ${
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
                className="hidden sm:flex h-12 w-6 items-center justify-center rounded-r-full bg-gray-700 text-gray-400 transition hover:bg-gray-600 hover:text-white disabled:opacity-50 border-l border-gray-600"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" className="w-64 border-[#2a2a35] bg-[#1a1a20] p-3 shadow-xl">
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
            className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full transition disabled:opacity-50 ${
              sharing
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
            title={sharing ? 'Stop sharing' : 'Share screen'}
          >
            {sharing ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />}
          </button>
        </motion.div>
        <span className="text-[9px] sm:text-[10px] text-gray-500">{sharing ? 'Stop Share' : 'Share'}</span>
      </div>

      {/* Chat toggle */}
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={onToggleChat}
          disabled={disabled}
          className={`relative flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full transition disabled:opacity-50 ${
            isChatOpen
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-700 text-white hover:bg-gray-600'
          }`}
          title="Chat"
        >
          <MessageSquare className="h-5 w-5" />
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadChatCount > 9 ? '9+' : unreadChatCount}
            </span>
          )}
        </button>
        <span className="text-[9px] sm:text-[10px] text-gray-500">Chat</span>
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

        {/* Participants (host) */}
        {isHost && (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={onToggleParticipants}
              disabled={disabled}
              className={`flex h-12 w-12 items-center justify-center rounded-full transition disabled:opacity-50 ${
                showParticipants
                  ? 'bg-purple-500 text-white hover:bg-purple-600'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
              title="Participants"
            >
              <Users className="h-5 w-5" />
            </button>
            <span className="text-[10px] text-gray-500">People</span>
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
      </div>

      {/* Mobile overflow menu */}
      <div className="relative sm:hidden flex flex-col items-center gap-1" ref={mobileMenuRef}>
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          disabled={disabled}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-700 text-white transition hover:bg-gray-600 disabled:opacity-50"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
        <span className="text-[9px] text-gray-500">More</span>
        {showMobileMenu && (
          <div className="absolute bottom-full mb-2 right-0 z-50 w-48 rounded-xl border border-[#2a2a35] bg-[#1a1a24] p-1.5 shadow-xl">
            <button
              onClick={() => { copyLink(); setShowMobileMenu(false); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-white/[0.06]"
            >
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Link2 className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy invite link'}
            </button>
            {isPipSupported && (
              <button
                onClick={() => { onOpenPip?.(); setShowMobileMenu(false); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-white/[0.06]"
              >
                <PictureInPicture2 className="h-4 w-4" />
                Picture in picture
              </button>
            )}
            {isHost && (
              <button
                onClick={() => { onToggleParticipants?.(); setShowMobileMenu(false); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-white/[0.06]"
              >
                <Users className="h-4 w-4" />
                People
              </button>
            )}
            {isHost && (
              <button
                onClick={() => {
                  recording ? onRecordStop?.() : onRecordStart?.();
                  setShowMobileMenu(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-white/[0.06]"
              >
                {recording ? <Square className="h-4 w-4 text-red-400" /> : <CircleDot className="h-4 w-4" />}
                {recording ? 'Stop recording' : 'Start recording'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* End meeting (host) */}
      {isHost && onEndMeeting && (
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={onEndMeeting}
            disabled={disabled}
            className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-orange-600 text-white transition hover:bg-orange-700 disabled:opacity-50"
            title="End meeting"
          >
            <Square className="h-4 w-4" />
          </button>
          <span className="text-[9px] sm:text-[10px] text-gray-500">End</span>
        </div>
      )}

      {/* Leave */}
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={onLeave}
          className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-700"
          title="Leave"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
        <span className="text-[9px] sm:text-[10px] text-gray-500">Leave</span>
      </div>
    </div>
  );
}
