'use client';

import { Users, X, UserX } from 'lucide-react';
import { useParticipants, useIsSpeaking } from '@livekit/components-react';
import type { Participant } from 'livekit-client';
import { parseParticipantMeta } from '@/lib/meet-metadata';
import { ParticipantAvatar } from './ParticipantAvatar';

interface MeetParticipantsPanelProps {
  isOpen: boolean;
  onClose(): void;
  isHost: boolean;
  onKick?(identity: string, name: string): void;
}

function ParticipantRow({
  participant,
  isHost,
  isLocalHost,
  onKick,
}: {
  participant: Participant;
  isHost: boolean;
  isLocalHost: boolean;
  onKick?(identity: string, name: string): void;
}) {
  const isSpeaking = useIsSpeaking(participant);
  const name = participant.name || participant.identity;
  const meta = parseParticipantMeta(participant.metadata);
  const participantIsHost = meta.isHost;

  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-white/[0.04]">
      {/* Avatar */}
      <div className="relative h-8 w-8 shrink-0">
        <ParticipantAvatar name={name} avatarUrl={meta.avatar} sizeClass="h-8 w-8" textSizeClass="text-xs" />
        {/* Speaking indicator */}
        {isSpeaking && (
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#111116] bg-green-400 animate-pulse" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-white truncate">{name}</span>
          {participantIsHost && (
            <span className="shrink-0 rounded bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-medium text-purple-400">
              Host
            </span>
          )}
          {participant.isLocal && (
            <span className="shrink-0 text-[10px] text-gray-500">(you)</span>
          )}
        </div>
      </div>

      {/* Kick button (host only, not for self or other hosts) */}
      {isLocalHost && !participant.isLocal && !participantIsHost && onKick && (
        <button
          onClick={() => onKick(participant.identity, name)}
          className="shrink-0 rounded-lg p-1.5 text-gray-600 transition hover:bg-white/[0.06] hover:text-red-400"
          title="Remove from meeting"
        >
          <UserX className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export default function MeetParticipantsPanel({ isOpen, onClose, isHost, onKick }: MeetParticipantsPanelProps) {
  const participants = useParticipants();

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-[#2a2a35] bg-[#111116]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2a2a35] px-4 py-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-semibold text-white">Participants</span>
          <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-medium text-gray-400">
            {participants.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-gray-400 transition hover:bg-white/[0.06] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Participant list */}
      <div className="flex-1 overflow-y-auto p-2">
        {participants.map((p) => (
          <ParticipantRow
            key={p.identity}
            participant={p}
            isHost={false}
            isLocalHost={isHost}
            onKick={onKick}
          />
        ))}
      </div>
    </div>
  );
}
