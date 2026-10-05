"use client";

import { memo, useMemo, useRef, useEffect, useState } from "react";
import { PeerState } from "../types";
import {
  getPreferredScreenTrack,
  isLiveCameraTrack,
  buildSingleTrackStream,
  getActiveCameraTrack,
} from "../utils";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { OccupantAvatarSmall } from "./OccupantAvatarSmall";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DoorClosed, MessageSquare, Mic, MicOff, PhoneOff, User } from "lucide-react";
// import { UserTodosDialog } from "@/components/dashboard/UserTodosDialog"; // hidden
import { LastSeen } from "@/components/shared/LastSeen";

export const UserSpaceCard = memo(
  ({
    owner,
    occupants,
    meId,
    mySpaceId,
    onKnock,
    onCancelKnock,
    knockingId,
    onWatchScreenShare,
    onBook,
    isInKnockCall,
    isMicMuted,
    onToggleMic,
    onEndCall,
  }: {
    owner: PeerState & {
      isBusyInPrivateMeeting?: boolean;
      isBusyInPublicMeeting?: boolean;
      isBusyInBookingMeeting?: boolean;
      isBusyInEventMeeting?: boolean;
    };
    occupants: PeerState[];
    meId: string;
    mySpaceId: string;
    onKnock: (peer: PeerState) => void;
    onCancelKnock?: (peer: PeerState) => void;
    knockingId: string | null;
    onWatchScreenShare: (peer: PeerState) => void;
    onBook: () => void;
    // Knock call (audio-only) controls
    isInKnockCall?: boolean;
    isMicMuted?: boolean;
    onToggleMic?: () => void;
    onEndCall?: () => void;
  }) => {
    // const [showUserTodoDialog, setShowUserTodoDialog] = useState(false); // hidden

    // Function to open DM chat via custom event
    const handleOpenDM = () => {
      window.dispatchEvent(
        new CustomEvent("notification:open-dm", {
          detail: { userId: owner.id },
        })
      );
    };

    const isPrivate = occupants.length > 1;
    const isMyCard = owner.id === meId;
    const amInThisSpace = occupants.some((p) => p.id === meId);
    const isKnocking = knockingId === owner.id;
    const amInAnyRoom = mySpaceId !== "lobby";

    const lobbyVideoRef = useRef<HTMLVideoElement>(null);
    const isVideoOn = useMemo(
      () => owner.stream?.getVideoTracks().some(isLiveCameraTrack) ?? false,
      [owner.stream]
    );
    const initials = useMemo(
      () => (owner.name || owner.email || "?").slice(0, 2).toUpperCase(),
      [owner.name, owner.email]
    );
    const isBusyAsGuest =
      !isPrivate && owner.spaceId !== "lobby" && owner.spaceId !== owner.id;

    // Host is busy when they're in their own room (not lobby)
    const isBusyAsHost =
      !isPrivate && owner.spaceId !== "lobby" && owner.spaceId === owner.id;

    // Check if user is in a conference meeting (floor meeting, booking, or event)
    const isInConferenceMeeting =
      !isPrivate &&
      owner.spaceId !== "lobby" &&
      (owner.spaceId.startsWith("floor-meeting:") ||
        owner.spaceId.startsWith("booking:") ||
        owner.spaceId.startsWith("event:"));

    const canInteract =
      !isPrivate &&
      !isMyCard &&
      !isBusyAsGuest &&
      !isBusyAsHost &&
      !isInConferenceMeeting &&
      !isKnocking &&
      !amInAnyRoom &&
      !owner.isBusyInPrivateMeeting &&
      !owner.isBusyInPublicMeeting &&
      !owner.isBusyInBookingMeeting &&
      !owner.isBusyInEventMeeting;

    const showHoverButtons = !isPrivate && !isMyCard && !isKnocking;

    // Show DM button even when in a room or when user is offline
    const showDMButton = !isPrivate && !isMyCard;

    useEffect(() => {
      if (isPrivate) return;
      const element = lobbyVideoRef.current;
      if (!element) return;

      if (owner.stream && isVideoOn) {
        if (element.srcObject !== owner.stream) {
          element.srcObject = owner.stream;
        }
      } else if (element.srcObject) {
        element.srcObject = null;
      }
    }, [isPrivate, owner.stream, isVideoOn]);

    // --- LOBBY CARD VIEW ---
    if (!isPrivate) {
      // Live presence dot + "Available/Busy/Offline/In a meeting" label was
      // removed with the workspace-presence cleanup. The card now just shows
      // the user's name; recency lives on the floor/sidebar rosters via
      // <LastSeen>. Knock-call buttons below still work the same — they
      // route via the socket if the user is reachable, push otherwise.
      return (
        <div className="relative group">
          <motion.div
            className={cn(
              "relative bg-[#1a1a20] border border-[#2a2a35] rounded-lg flex flex-col min-h-[120px] w-[240px] shadow-sm transition-all duration-300 overflow-hidden",
              canInteract
                ? "hover:border-[#3a3a45] hover:shadow-md"
                : "cursor-default"
            )}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            whileHover={{ scale: canInteract ? 1.02 : 1 }}
            layout
          >
            {owner.isRecording && (
              <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] uppercase tracking-wide text-red-200 bg-red-500/20 border border-red-400/50 rounded-full px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                Rec
              </div>
            )}
            <div className="flex-1 p-4">
              <div className="mb-2">
                <p className="font-medium text-sm text-white truncate">
                  {owner.name || owner.email}
                </p>
                {!isMyCard && (
                  <LastSeen
                    date={owner.lastSeenAt}
                    className="text-[10px] text-gray-500 mt-0.5 block truncate"
                  />
                )}
              </div>

            </div>

            <div
              className={cn(
                "absolute bottom-3 right-3 h-12 w-12 rounded-full border-2 border-[#2a2a35] overflow-hidden",
                !isMyCard && "cursor-pointer"
              )}
              onClick={(e) => {
                if (!isMyCard) {
                  e.stopPropagation();
                  window.dispatchEvent(
                    new CustomEvent("affiliate-profile:open", {
                      detail: { userId: owner.id },
                    })
                  );
                }
              }}
            >
              {isVideoOn ? (
                <video
                  ref={lobbyVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={cn(
                    "w-full h-full object-cover",
                    isMyCard && "transform scale-x-[-1]"
                  )}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-700">
                  <Avatar className="h-full w-full">
                    {owner.profilePicture ? (
                      <img
                        src={owner.profilePicture}
                        alt={owner.name || owner.email}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <AvatarFallback className="text-xs bg-[#2a1752] text-[#e6d7ff]">
                        {initials}
                      </AvatarFallback>
                    )}
                  </Avatar>
                </div>
              )}
            </div>

            {/* Knocking overlay */}
            {isKnocking && (
              <div className="absolute inset-0 bg-black/70 rounded-lg flex flex-col items-center justify-center gap-3 z-20">
                <span className="text-white font-medium text-sm">
                  Knocking...
                </span>
                {onCancelKnock && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancelKnock(owner);
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            )}
          </motion.div>

          {/* Hover Action Buttons */}
          {(showHoverButtons || showDMButton) && (
            <div className="absolute bg-[#111116] w-full -bottom-12 border-t-0 border border-[#2a2a35] rounded-lg rounded-t-none py-2 px-1 left-1/2 -translate-x-1/2 flex gap-2 z-30 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-200 ease-out">
              {/* Hiding the knock button as requested
              showHoverButtons &&
                !isBusyAsGuest &&
                !isBusyAsHost &&
                !isInConferenceMeeting &&
                !owner.isBusyInPrivateMeeting &&
                !owner.isBusyInPublicMeeting &&
                !owner.isBusyInBookingMeeting &&
                !owner.isBusyInEventMeeting && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="hover:bg-purple-500/40"
                    title="Knock to Join"
                    onClick={(e) => {
                      e.stopPropagation();
                      onKnock(owner);
                    }}
                  >
                    <DoorClosed className="h-4 w-4" />
                  </Button>
                )*/}
              {showHoverButtons && (
                <>
                  {/* Book a Meeting button — hidden
                  <Button
                    size="sm"
                    variant="ghost"
                    className="hover:bg-blue-500/40"
                    title="Book a Meeting"
                    onClick={(e) => {
                      e.stopPropagation();
                      onBook();
                    }}
                  >
                    <Calendar className="h-4 w-4" />
                  </Button>
                  */}
                  {/* View/Assign Todos button — hidden
                  <Button
                    size="sm"
                    variant="ghost"
                    className="hover:bg-green-500/40"
                    title="View/Assign Todos"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUserTodoDialog(true);
                    }}
                  >
                    <CheckSquare className="h-4 w-4" />
                  </Button>
                  */}
                  {showDMButton && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="hover:bg-yellow-500/40"
                        title="Open DM Chat"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDM();
                        }}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="hover:bg-purple-500/40"
                        title="View Profile"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.dispatchEvent(
                            new CustomEvent("affiliate-profile:open", {
                              detail: { userId: owner.id },
                            })
                          );
                        }}
                      >
                        <User className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* User Todos Dialog — hidden
          <UserTodosDialog
            isOpen={showUserTodoDialog}
            onClose={() => setShowUserTodoDialog(false)}
            targetUser={{
              id: owner.id,
              name: owner.name || "",
              email: owner.email || "",
            }}
          />
          */}
        </div>
      );
    }

    // --- PRIVATE ROOM VIEW ---
    const roomName = isMyCard
      ? "Your Private Room"
      : `${owner.name || owner.email}'s Room`;
    return (
      <motion.div
        className={cn(
          "relative p-4 border border-purple-500/30 rounded-lg bg-[#1a1a20]/50 backdrop-blur-sm shadow-lg w-[280px] min-h-[160px] group"
        )}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        layout
      >
        {owner.isRecording && (
          <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] uppercase tracking-wide text-red-200 bg-red-500/20 border border-red-400/50 rounded-full px-2 py-0.5 z-30">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
            Recording
          </div>
        )}
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-purple-300 truncate">
            {isInKnockCall ? "Audio Call" : roomName}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {occupants.length} member
            {occupants.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Knock call controls */}
        {isInKnockCall && (
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5 flex-1">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-400 font-medium">Live</span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "rounded-full w-8 h-8 text-white hover:bg-white/10",
                isMicMuted && "bg-red-500 hover:bg-red-600"
              )}
              aria-label={isMicMuted ? "Unmute" : "Mute"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleMic?.();
              }}
            >
              {isMicMuted ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="icon"
              className="rounded-full w-8 h-8 bg-red-600 hover:bg-red-700 text-white"
              aria-label="End call"
              onClick={(e) => {
                e.stopPropagation();
                onEndCall?.();
              }}
            >
              <PhoneOff className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="absolute bottom-3 right-3 flex gap-1.5">
          {occupants.slice(0, 3).map((peer) => {
            const initials = (peer.name || peer.email)
              .slice(0, 2)
              .toUpperCase();
            const isLocal = peer.id === meId;
            const screenTrack = getPreferredScreenTrack(
              peer.stream,
              peer.isScreenSharing
            );
            const isScreenSharing = Boolean(
              peer.isScreenSharing || screenTrack
            );
            const cameraTrack = !isScreenSharing
              ? getActiveCameraTrack(peer.stream)
              : null;
            const isVideoOn = Boolean(cameraTrack);

            return (
              <OccupantAvatarSmall
                key={peer.id}
                peer={peer}
                isLocal={isLocal}
                initials={initials}
                isVideoOn={isVideoOn}
                isScreenSharing={isScreenSharing}
                onWatchScreenShare={() => {
                  if (!screenTrack) return;
                  const previewStream = buildSingleTrackStream(screenTrack);
                  if (!previewStream) return;
                  onWatchScreenShare({
                    ...peer,
                    stream: previewStream,
                    isScreenSharing: true,
                  });
                }}
              />
            );
          })}

          {occupants.length > 3 && (
            <div className="h-8 w-8 rounded-full bg-gray-600 border border-[#3a3a45] flex items-center justify-center">
              <span className="text-[8px] text-gray-300 font-medium">
                +{occupants.length - 3}
              </span>
            </div>
          )}
        </div>
      </motion.div>
    );
  }
);
UserSpaceCard.displayName = "UserSpaceCard";
