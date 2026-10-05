'use client';

import { Track } from 'livekit-client';
import type { Participant } from 'livekit-client';
import { ParticipantTile, useTracks, useParticipants, useIsSpeaking } from '@livekit/components-react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { useVideoGrid } from '@/hooks/livekit/useVideoGrid';
import { MicOff, UserX, ScreenShare } from 'lucide-react';

export type RoomLayout = 'gallery' | 'spotlight' | 'presenter';

interface VideoGridProps {
  isHost?: boolean;
  onKickParticipant?(identity: string, name: string): void;
  onMuteParticipant?(identity: string, trackSid: string): void;
  // Legacy props for officestream backward compat
  hasScreenShare?: boolean;
  layout?: RoomLayout;
}

function SpeakingBorderWrapper({
  participant,
  children,
  isHost,
  isScreenShare,
  isSharing,
  onKick,
  onMute,
}: {
  participant: Participant;
  children: React.ReactNode;
  isHost: boolean;
  isScreenShare?: boolean;
  isSharing?: boolean;
  onKick?(identity: string, name: string): void;
  onMute?(identity: string, trackSid: string): void;
}) {
  const isSpeaking = useIsSpeaking(participant);
  const name = participant.name || participant.identity;

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

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={`group relative rounded-lg overflow-hidden bg-[#1a1a20] h-full w-full transition-all duration-300 ${
        isScreenShare
          ? 'border-2 border-blue-500'
          : isSpeaking
          ? 'border-2 border-green-500 shadow-[0_0_12px_rgba(34,197,94,0.4)]'
          : 'border border-[#2a2a35]'
      }`}
    >
      {/* When camera is off: show avatar (non-absolute, gives the container height) */}
      {!isCameraOn && !isScreenShare ? (
        <div className="flex h-full w-full flex-col items-center justify-center bg-[#1a1a20]">
          <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-xl sm:text-2xl font-semibold text-white mb-3">
            {initials}
          </div>
          <p className="text-sm font-medium text-white">{name}</p>
          {isMicMuted && (
            <div className="mt-1.5 flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-400">
              <MicOff className="h-3 w-3" />
              Muted
            </div>
          )}
        </div>
      ) : (
        <>
          {children}
          {/* Name label when camera is on */}
          {!isScreenShare && (
            <div className="absolute bottom-2 left-2 z-[1] rounded bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
              {participant.isLocal ? `${name} (You)` : name}
            </div>
          )}
        </>
      )}

      {/* Sharing badge */}
      {isSharing && !isScreenShare && (
        <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-green-500/90 px-2 py-0.5 text-[10px] font-medium text-white">
          <ScreenShare className="h-3 w-3" />
          Sharing
        </div>
      )}

      {/* Screen share label */}
      {isScreenShare && (
        <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-blue-500/80 px-2 py-0.5 text-[10px] font-medium text-white">
          <ScreenShare className="h-3 w-3" />
          {participant.isLocal ? 'Your Screen' : `${name}'s Screen`}
        </div>
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
  hasScreenShare: hasScreenShareProp,
  layout,
}: VideoGridProps) {
  const cameraTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  const screenTracks = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }]);
  const participants = useParticipants();

  // Legacy mode: when hasScreenShare/layout props are provided, use old simple rendering
  if (hasScreenShareProp !== undefined || layout !== undefined) {
    return <LegacyVideoGrid cameraTracks={cameraTracks} screenTracks={screenTracks} hasScreenShare={hasScreenShareProp} layout={layout} />;
  }

  // Identify who is screen sharing
  const sharingIdentities = new Set(screenTracks.map((t) => t.participant.identity));

  const hasScreenShare = screenTracks.length > 0;

  // Compute grid classes based on count
  function getGridClasses(count: number) {
    if (count <= 1) return 'grid-cols-1 h-full auto-rows-fr';
    if (count <= 4) return 'grid-cols-1 sm:grid-cols-2 h-full auto-rows-fr';
    if (count <= 6) return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 h-full auto-rows-fr';
    if (count <= 8) return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4 h-full auto-rows-fr';
    return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4 auto-rows-[minmax(150px,1fr)] overflow-y-auto';
  }

  // Screen share view
  if (hasScreenShare) {
    return (
      <div className="flex h-full flex-col sm:flex-row gap-2 overflow-hidden">
        {/* Main screen share area */}
        <div className="flex-1 min-h-0">
          <SpeakingBorderWrapper
            participant={screenTracks[0].participant}
            isHost={isHost}
            isScreenShare
            onKick={onKickParticipant}
            onMute={onMuteParticipant}
          >
            <ParticipantTile trackRef={screenTracks[0]} />
          </SpeakingBorderWrapper>
        </div>

        {/* Camera strip */}
        <div className="flex sm:flex-col gap-2 overflow-x-auto sm:overflow-y-auto sm:overflow-x-hidden sm:w-48 h-28 sm:h-auto shrink-0">
          {cameraTracks.map((track) => (
            <div key={track.participant.sid} className="w-32 sm:w-auto shrink-0 sm:h-44">
              <SpeakingBorderWrapper
                participant={track.participant}
                isHost={isHost}
                isSharing={sharingIdentities.has(track.participant.identity)}
                onKick={onKickParticipant}
                onMute={onMuteParticipant}
              >
                <ParticipantTile trackRef={track} />
              </SpeakingBorderWrapper>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Single participant: fill
  if (cameraTracks.length <= 1) {
    return (
      <div className="flex h-full w-full items-center justify-center overflow-hidden">
        {cameraTracks.map((track) => (
          <div key={track.participant.sid} className="relative h-full w-full">
            <SpeakingBorderWrapper
              participant={track.participant}
              isHost={isHost}
              onKick={onKickParticipant}
              onMute={onMuteParticipant}
            >
              <ParticipantTile trackRef={track} />
            </SpeakingBorderWrapper>
          </div>
        ))}
      </div>
    );
  }

  // Regular camera grid
  return (
    <div className={`grid gap-2 sm:gap-4 overflow-hidden ${getGridClasses(cameraTracks.length)}`}>
      {cameraTracks.map((track) => (
        <SpeakingBorderWrapper
          key={track.participant.sid}
          participant={track.participant}
          isHost={isHost}
          isSharing={sharingIdentities.has(track.participant.identity)}
          onKick={onKickParticipant}
          onMute={onMuteParticipant}
        >
          <ParticipantTile trackRef={track} />
        </SpeakingBorderWrapper>
      ))}
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
        <div className="h-full w-full rounded-xl overflow-hidden bg-[#0f3460]">
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
        <div className="flex-1 rounded-xl overflow-hidden bg-[#0f3460]">
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
