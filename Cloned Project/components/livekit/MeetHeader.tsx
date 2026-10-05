'use client';

import { PictureInPicture2 } from 'lucide-react';

interface MeetHeaderProps {
  roomId: string;
  connected: boolean;
  isHost: boolean;
  recording: boolean;
  recElapsed: number;
  isPipSupported: boolean;
  onOpenPip(): void;
  onLeave(): void;
}

export default function MeetHeader({
  roomId,
  connected,
  isHost,
  recording,
  recElapsed,
  isPipSupported,
  onOpenPip,
  onLeave,
}: MeetHeaderProps) {
  const minutes = Math.floor(recElapsed / 60);
  const seconds = (recElapsed % 60).toString().padStart(2, '0');

  return (
    <div className="flex items-center justify-between border-b border-[#2a2a35] bg-[#111116] px-4 py-2.5">
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onLeave}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-white truncate">Meeting</span>
          <span className="text-[10px] text-gray-400 truncate hidden sm:block">{roomId}</span>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Recording indicator */}
        {recording && (
          <span className="flex items-center gap-1.5 rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
            REC {minutes}:{seconds}
          </span>
        )}

        {/* Connection status */}
        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${
            connected
              ? 'bg-green-500/20 text-green-400'
              : 'bg-gray-500/20 text-gray-400'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              connected ? 'bg-green-400' : 'bg-gray-400 animate-pulse'
            }`}
          />
          {connected ? 'Connected' : 'Connecting...'}
        </span>

        {/* Host badge */}
        {isHost && (
          <span className="hidden sm:flex items-center rounded-full bg-purple-500/20 px-2.5 py-1 text-[10px] font-medium text-purple-400">
            Host
          </span>
        )}

        {/* PiP button */}
        {isPipSupported && (
          <button
            onClick={onOpenPip}
            className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-white transition hover:bg-gray-600"
            title="Picture in picture"
          >
            <PictureInPicture2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
