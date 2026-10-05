"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Socket } from "socket.io-client";
import useWebinarStore, { detectLocalDeviceType } from "@/store/webinarStore";
import type {
  WebinarRole,
  WebinarPeer,
  ChatMessage,
  QAQuestion,
  Poll,
  PeerStreams,
} from "@/store/webinarStore";
import type { useMediasoup } from "./useMediasoup";

// ── Types ───────────────────────────────────────────────────────────────────

type Mediasoup = ReturnType<typeof useMediasoup>;

interface JoinRoomResponse {
  success: boolean;
  error?: string;
  role?: WebinarRole;
  webinarTitle?: string;
  rtpCapabilities?: unknown;
  chatHistory?: ChatMessage[];
  peers?: WebinarPeer[];
}

interface ProducerInfo {
  producerId: string;
  producerSocketId: string;
  kind: "audio" | "video";
  appData?: { type?: string; [key: string]: unknown };
}

interface ConsumerClosedPayload {
  consumerId: string;
  producerSocketId?: string;
  kind?: "audio" | "video";
  appData?: { type?: string; [key: string]: unknown };
}

interface ScreenShareStoppedPayload {
  producerSocketId: string;
  type?: string;
}

interface PeerJoinedPayload extends WebinarPeer {}

interface PeerLeftPayload {
  socketId: string;
}

interface PeerRoleChangedPayload {
  socketId: string;
  role: WebinarRole;
}

interface PeerMicStatePayload {
  socketId: string;
  muted: boolean;
}

interface HandRaisedPayload {
  socketId: string;
  name: string;
  raised: boolean;
}

interface RoleChangedPayload {
  role: WebinarRole;
}

interface ReactionPayload {
  /** Sender's socket id — used to drop the echo of our own reaction. */
  socketId?: string;
  name: string;
  emoji: string;
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useWebinarSocket(
  socketRef: React.MutableRefObject<Socket | null>,
  webinarId: string,
  mediasoup: Mediasoup
) {
  const router = useRouter();
  const hasJoinedRef = useRef(false);

  const {
    setRole,
    setWebinarId,
    setWebinarTitle,
    addPeer,
    removePeer,
    updatePeerStream,
    updatePeerRole,
    updatePeerMuted,
    updateHandRaised,
    addMessage,
    setMessages,
    setIsRecording,
    addReaction,
    addQuestion,
    updateQuestion,
    addPoll,
    updatePoll,
    resetRoom,
  } = useWebinarStore();

  // ── Register all inbound socket events ──────────────────────────────────

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    // -- Peer lifecycle --

    const onPeerJoined = (peer: PeerJoinedPayload) => {
      useWebinarStore.getState().addPeer(peer);
    };

    const onPeerLeft = ({ socketId }: PeerLeftPayload) => {
      useWebinarStore.getState().removePeer(socketId);
    };

    const onPeerRoleChanged = ({ socketId, role }: PeerRoleChangedPayload) => {
      useWebinarStore.getState().updatePeerRole(socketId, role);
    };

    const onPeerMicState = ({ socketId, muted }: PeerMicStatePayload) => {
      useWebinarStore.getState().updatePeerMuted(socketId, muted);
    };

    // -- Mediasoup consumers --

    const onNewProducer = ({
      producerId,
      producerSocketId,
      kind,
      appData,
    }: ProducerInfo) => {
      mediasoup.consume(producerId, producerSocketId, kind, appData);
    };

    const onConsumerClosed = ({
      producerSocketId,
      kind,
      appData,
    }: ConsumerClosedPayload) => {
      if (producerSocketId) {
        const type = appData?.type || "";
        const slot: keyof PeerStreams =
          type === "screen"
            ? "screen"
            : type === "screenAudio"
              ? "screenAudio"
              : ((kind || "video") as keyof PeerStreams);
        useWebinarStore
          .getState()
          .updatePeerStream(producerSocketId, null, slot);
      }
    };

    const onScreenShareStopped = ({
      producerSocketId,
      type,
    }: ScreenShareStoppedPayload) => {
      console.log("[screenShareStopped]", producerSocketId, type);
      useWebinarStore
        .getState()
        .updatePeerStream(
          producerSocketId,
          null,
          type === "screenAudio" ? "screenAudio" : "screen"
        );
    };

    // -- Host actions --

    const onForceMuted = () => {
      mediasoup.forceMute();
    };

    const onRoleChanged = async ({ role: newRole }: RoleChangedPayload) => {
      useWebinarStore.getState().setRole(newRole);
      if (newRole === "panelist") {
        try {
          await mediasoup.startMedia();
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.warn("Auto media start failed for co-host:", message);
        }
      } else if (newRole === "attendee") {
        // Demoted - stop all media
        mediasoup.stopScreenShare();
        mediasoup.cleanup();
      }
    };

    const onRemovedFromRoom = () => {
      doCleanup();
      router.push("/");
    };

    const onWebinarEnded = () => {
      // Delay slightly to allow any upload to continue
      setTimeout(() => {
        doCleanup();
        router.push("/");
      }, 2000);
    };

    // -- Chat & messaging --

    const onNewMessage = (msg: ChatMessage) => {
      useWebinarStore.getState().addMessage(msg);
    };

    const onRecordingStarted = () => {
      useWebinarStore.getState().setIsRecording(true);
    };

    const onRecordingStopped = () => {
      useWebinarStore.getState().setIsRecording(false);
    };

    // -- Reactions --

    const onReaction = ({ socketId, name, emoji }: ReactionPayload) => {
      // Our own reaction is spawned locally on click; skip the echo.
      if (socketId && socketId === socket.id) return;
      useWebinarStore
        .getState()
        .addReaction({ name, emoji, id: Date.now() + Math.random() });
    };

    // -- Hand raise --

    const onHandRaised = ({ socketId, name, raised }: HandRaisedPayload) => {
      useWebinarStore.getState().updateHandRaised(socketId, raised);
    };

    // -- Q&A --

    const onNewQA = (qa: QAQuestion) => {
      useWebinarStore.getState().addQuestion(qa);
    };

    const onQAUpdated = (qa: QAQuestion) => {
      useWebinarStore.getState().updateQuestion(qa);
    };

    // -- Polls --

    const onNewPoll = (poll: Poll) => {
      useWebinarStore.getState().addPoll(poll);
    };

    const onPollUpdated = (poll: Poll) => {
      useWebinarStore.getState().updatePoll(poll);
    };

    // ── Attach listeners ──────────────────────────────────────────────────

    socket.on("webinar:peerJoined", onPeerJoined);
    socket.on("webinar:peerLeft", onPeerLeft);
    socket.on("webinar:peerRoleChanged", onPeerRoleChanged);
    socket.on("webinar:peerMicState", onPeerMicState);
    socket.on("webinar:newProducer", onNewProducer);
    socket.on("webinar:consumerClosed", onConsumerClosed);
    socket.on("webinar:screenShareStopped", onScreenShareStopped);
    socket.on("webinar:forceMuted", onForceMuted);
    socket.on("webinar:roleChanged", onRoleChanged);
    socket.on("webinar:removedFromRoom", onRemovedFromRoom);
    socket.on("webinar:webinarEnded", onWebinarEnded);
    socket.on("webinar:newMessage", onNewMessage);
    socket.on("webinar:recordingStarted", onRecordingStarted);
    socket.on("webinar:recordingStopped", onRecordingStopped);
    socket.on("webinar:reaction", onReaction);
    socket.on("webinar:handRaised", onHandRaised);
    socket.on("webinar:newQA", onNewQA);
    socket.on("webinar:qaUpdated", onQAUpdated);
    socket.on("webinar:newPoll", onNewPoll);
    socket.on("webinar:pollUpdated", onPollUpdated);

    // ── Cleanup listeners on unmount ──────────────────────────────────────

    return () => {
      socket.off("webinar:peerJoined", onPeerJoined);
      socket.off("webinar:peerLeft", onPeerLeft);
      socket.off("webinar:peerRoleChanged", onPeerRoleChanged);
      socket.off("webinar:peerMicState", onPeerMicState);
      socket.off("webinar:newProducer", onNewProducer);
      socket.off("webinar:consumerClosed", onConsumerClosed);
      socket.off("webinar:screenShareStopped", onScreenShareStopped);
      socket.off("webinar:forceMuted", onForceMuted);
      socket.off("webinar:roleChanged", onRoleChanged);
      socket.off("webinar:removedFromRoom", onRemovedFromRoom);
      socket.off("webinar:webinarEnded", onWebinarEnded);
      socket.off("webinar:newMessage", onNewMessage);
      socket.off("webinar:recordingStarted", onRecordingStarted);
      socket.off("webinar:recordingStopped", onRecordingStopped);
      socket.off("webinar:reaction", onReaction);
      socket.off("webinar:handRaised", onHandRaised);
      socket.off("webinar:newQA", onNewQA);
      socket.off("webinar:qaUpdated", onQAUpdated);
      socket.off("webinar:newPoll", onNewPoll);
      socket.off("webinar:pollUpdated", onPollUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketRef.current, webinarId]);

  // ── Internal cleanup helper ─────────────────────────────────────────────

  function doCleanup() {
    const socket = socketRef.current;
    if (socket) {
      socket.removeAllListeners();
    }
    mediasoup.cleanup();
    resetRoom();
    hasJoinedRef.current = false;
  }

  // ── joinRoom ────────────────────────────────────────────────────────────

  const joinRoom = useCallback(
    async (options?: {
      role?: string;
      panelistToken?: string | null;
      userId?: string;
    }): Promise<{
      success: boolean;
      error?: string;
      role?: WebinarRole;
    }> => {
      const socket = socketRef.current;
      console.log("[useWebinarSocket] joinRoom called, socket:", !!socket, "connected:", socket?.connected, "hasJoined:", hasJoinedRef.current);
      if (!socket) return { success: false, error: "Socket not connected" };
      if (hasJoinedRef.current)
        return { success: false, error: "Already joined" };

      hasJoinedRef.current = true;

      console.log("[useWebinarSocket] Emitting webinar:joinRoom with webinarId:", webinarId);
      return new Promise((resolve) => {
        const handleResponse = async (response: JoinRoomResponse) => {
          console.log("[useWebinarSocket] Received joinRoom response:", response.success, response.role);

          if (!response.success) {
            hasJoinedRef.current = false;
            resolve({
              success: false,
              error: response.error || "Failed to join room",
            });
            return;
          }

          const assignedRole = response.role || "attendee";

          setWebinarId(webinarId);
          setWebinarTitle(response.webinarTitle || "");
          setRole(assignedRole);
          setMessages(response.chatHistory || []);

          // Add existing peers (filter out self if userId provided)
          (response.peers || []).forEach((peer) => {
            addPeer(peer);
          });

          try {
            // Initialize mediasoup device with server's RTP capabilities
            await mediasoup.initDevice(response.rtpCapabilities as any);

            // Consume all existing producers in the room
            socket.emit(
              "webinar:getProducers",
              { webinarId },
              (producers: ProducerInfo[]) => {
                (producers || []).forEach(
                  ({ producerId, producerSocketId, kind, appData }) => {
                    mediasoup.consume(
                      producerId,
                      producerSocketId,
                      kind,
                      appData
                    );
                  }
                );
              }
            );

            // Auto-start camera+mic for host and panelist
            if (assignedRole === "host" || assignedRole === "panelist") {
              try {
                await mediasoup.startMedia();
              } catch (err: unknown) {
                const message =
                  err instanceof Error ? err.message : String(err);
                console.warn("Auto media start failed:", message);
              }
            }

            resolve({ success: true, role: assignedRole });
          } catch (err: unknown) {
            const message =
              err instanceof Error ? err.message : String(err);
            console.error("mediasoup init error:", err);
            resolve({
              success: false,
              error: "Failed to initialize video: " + message,
            });
          }
        };

        // Emit join request with ack callback (WebSocket transport supports this)
        socket.emit(
          "webinar:joinRoom",
          {
            webinarId,
            role: options?.role || "attendee",
            panelistToken: options?.panelistToken || null,
            deviceType: detectLocalDeviceType(),
          },
          handleResponse
        );
      });
    },
    [
      socketRef,
      webinarId,
      mediasoup,
      setWebinarId,
      setWebinarTitle,
      setRole,
      setMessages,
      addPeer,
    ]
  );

  // ── leaveRoom ───────────────────────────────────────────────────────────

  const leaveRoom = useCallback(() => {
    const socket = socketRef.current;
    if (socket) {
      socket.emit("webinar:leaveRoom", { webinarId });
    }
    doCleanup();
  }, [socketRef, webinarId]);

  return { joinRoom, leaveRoom };
}
