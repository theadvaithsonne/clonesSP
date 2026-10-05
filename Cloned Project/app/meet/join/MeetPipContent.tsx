"use client";
import React, { useEffect, useRef, useState } from "react";

export interface PipParticipant {
  id: string;
  name: string;
  videoTrack: MediaStreamTrack | null;
  isMuted: boolean;
  isLocal: boolean;
  avatarUrl?: string;
}

export interface PipScreenShare {
  track: MediaStreamTrack;
  presenterName: string;
}

interface MeetPipContentProps {
  meetTitle: string;
  participants: PipParticipant[];
  screenShare?: PipScreenShare | null;
  isMicMuted: boolean;
  isCameraOff: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onLeaveCall: () => void;
}

function PipAvatar({
  name,
  avatarUrl,
  size,
}: {
  name: string;
  avatarUrl?: string;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [avatarUrl]);

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const showImage = !!avatarUrl && !failed;

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        overflow: "hidden",
        background: "linear-gradient(135deg, #6366f1, #a855f7)",
      }}
    >
      {showImage ? (
        <img
          src={avatarUrl}
          alt={name}
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: `${Math.round(size * 0.38)}px`,
            fontWeight: 600,
            color: "white",
          }}
        >
          {initials}
        </div>
      )}
    </div>
  );
}

function PipScreenShareTile({ share }: { share: PipScreenShare }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = new MediaStream([share.track]);
    el.play().catch(() => {});
    return () => {
      el.srcObject = null;
    };
  }, [share.track]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "#000",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "4px",
          left: "4px",
          backgroundColor: "rgba(34, 197, 94, 0.85)",
          borderRadius: "4px",
          padding: "1px 6px",
          fontSize: "10px",
          fontWeight: 500,
          color: "white",
          maxWidth: "80%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {share.presenterName} sharing
      </div>
    </div>
  );
}

function PipVideoTile({ participant }: { participant: PipParticipant }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (!participant.videoTrack) {
      el.srcObject = null;
      return;
    }

    el.srcObject = new MediaStream([participant.videoTrack]);
    el.play().catch(() => {});

    return () => {
      el.srcObject = null;
    };
  }, [participant.videoTrack]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        backgroundColor: "#1a1a24",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      {participant.videoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: participant.isLocal ? "scaleX(-1)" : undefined,
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <PipAvatar name={participant.name} avatarUrl={participant.avatarUrl} size={40} />
        </div>
      )}

      {/* Name label */}
      <div
        style={{
          position: "absolute",
          bottom: "4px",
          left: "4px",
          backgroundColor: participant.isLocal
            ? "rgba(168, 85, 247, 0.85)"
            : "rgba(0, 0, 0, 0.7)",
          borderRadius: "4px",
          padding: "1px 6px",
          fontSize: "10px",
          fontWeight: 500,
          color: "white",
          maxWidth: "80%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {participant.isLocal ? "You" : participant.name}
      </div>

      {/* Mic muted indicator */}
      {participant.isMuted && (
        <div
          style={{
            position: "absolute",
            top: "4px",
            right: "4px",
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            backgroundColor: "rgba(239, 68, 68, 0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
          </svg>
        </div>
      )}
    </div>
  );
}

export default function MeetPipContent({
  meetTitle,
  participants,
  screenShare,
  isMicMuted,
  isCameraOff,
  onToggleMic,
  onToggleCamera,
  onLeaveCall,
}: MeetPipContentProps) {
  // Show up to 4 participants: prioritize remote with video, then local, then others
  const sorted = [...participants].sort((a, b) => {
    // Remote with video first
    if (!a.isLocal && a.videoTrack && (b.isLocal || !b.videoTrack)) return -1;
    if (!b.isLocal && b.videoTrack && (a.isLocal || !a.videoTrack)) return 1;
    // Then local
    if (a.isLocal && !b.isLocal) return -1;
    if (b.isLocal && !a.isLocal) return 1;
    return 0;
  });

  const hasScreen = !!screenShare;
  // With a screen share, show 2 small thumbs; without, up to 4 tiles
  const tileLimit = hasScreen ? 2 : 4;
  const visible = sorted.slice(0, tileLimit);
  const overflowCount = participants.length - tileLimit;

  const totalItems = visible.length + (overflowCount > 0 ? 1 : 0);

  const gridStyle: React.CSSProperties =
    totalItems <= 1
      ? { display: "flex", flexDirection: "column" }
      : {
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gridAutoRows: "1fr",
        };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0a0a0f",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "6px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #2a2a35",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
          <div
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "#4ade80",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "white",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {meetTitle}
          </span>
        </div>
        <span style={{ fontSize: "10px", color: "#9ca3af", flexShrink: 0, marginLeft: "6px" }}>
          {participants.length} in call
        </span>
      </div>

      {/* Body: screen share (when active) on top, participants below; else just grid */}
      {hasScreen ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "4px",
            gap: "4px",
            minHeight: 0,
          }}
        >
          <div style={{ flex: "1 1 65%", minHeight: 0 }}>
            <PipScreenShareTile share={screenShare!} />
          </div>
          <div
            style={{
              flex: "1 1 35%",
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "4px",
              minHeight: 0,
            }}
          >
            {visible.map((p) => (
              <PipVideoTile key={p.id} participant={p} />
            ))}
            {overflowCount > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#1a1a24",
                  borderRadius: "8px",
                  fontSize: "11px",
                  color: "#9ca3af",
                  fontWeight: 600,
                }}
              >
                +{overflowCount} more
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            padding: "4px",
            gap: "4px",
            minHeight: 0,
            position: "relative",
            ...gridStyle,
          }}
        >
          {visible.map((p) => (
            <PipVideoTile key={p.id} participant={p} />
          ))}
          {overflowCount > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#1a1a24",
                borderRadius: "8px",
                fontSize: "11px",
                color: "#9ca3af",
                fontWeight: 600,
                gridColumn: totalItems % 2 !== 0 ? "1 / -1" : undefined,
              }}
            >
              +{overflowCount} more
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div
        style={{
          padding: "6px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          borderTop: "1px solid #2a2a35",
          flexShrink: 0,
        }}
      >
        {/* Mic */}
        <button
          onClick={onToggleMic}
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isMicMuted ? "rgba(239, 68, 68, 0.25)" : "#374151",
            color: isMicMuted ? "#f87171" : "white",
            transition: "background-color 0.15s",
          }}
          title={isMicMuted ? "Unmute" : "Mute"}
        >
          {isMicMuted ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>

        {/* Camera */}
        <button
          onClick={onToggleCamera}
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isCameraOff ? "rgba(239, 68, 68, 0.25)" : "#374151",
            color: isCameraOff ? "#f87171" : "white",
            transition: "background-color 0.15s",
          }}
          title={isCameraOff ? "Turn on camera" : "Turn off camera"}
        >
          {isCameraOff ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16.16 3.84a.5.5 0 0 1 .68-.02l4 3.2a.5.5 0 0 1 .16.38v9.2a.5.5 0 0 1-.16.36l-4 3.2a.5.5 0 0 1-.68-.02" />
              <rect x="2" y="6" width="14" height="12" rx="2" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16.16 3.84a.5.5 0 0 1 .68-.02l4 3.2a.5.5 0 0 1 .16.38v9.2a.5.5 0 0 1-.16.36l-4 3.2a.5.5 0 0 1-.68-.02" />
              <rect x="2" y="6" width="14" height="12" rx="2" />
            </svg>
          )}
        </button>

        {/* Leave Call */}
        <button
          onClick={onLeaveCall}
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#dc2626",
            color: "white",
            transition: "background-color 0.15s",
          }}
          title="Leave call"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
            <line x1="23" y1="1" x2="1" y2="23" />
          </svg>
        </button>
      </div>
    </div>
  );
}
