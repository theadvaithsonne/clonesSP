"use client";

import { useRef, useCallback } from "react";
import type { Socket } from "socket.io-client";
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteParticipant,
  ConnectionState,
  TrackPublication,
  VideoPresets,
  ConnectionQuality,
  DisconnectReason,
} from "livekit-client";
import { toast } from "sonner";
import useWebinarStore from "@/store/webinarStore";
import type { PeerStreams } from "@/store/webinarStore";
import { getToken } from "@/lib/auth";
import {
  NC_BID_TOPIC,
  dispatchLocalPing,
  publishBidPing as publishBidPingTo,
} from "@/lib/webinar/bid-channel";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Webinar transport hook backed by LiveKit. Drop-in replacement for the old
 * mediasoup-based hook — exposes the same public surface so the webinar page
 * and Socket.IO overlays (chat / Q&A / polls / hand-raise / pinned products)
 * keep working unchanged.
 *
 *  Mediasoup concept            →  LiveKit concept
 *  -----------------------------    --------------------------------------
 *  Send/Recv transports         →  Single Room connection
 *  Producer.produce(track)      →  LocalParticipant.publishTrack()
 *  Consumer.consume()           →  Auto on RemoteTrackPublished/Subscribed
 *  rtpCapabilities init handshake → Token-based handshake (Phase 1 endpoint)
 *  appData.type ∈ camera/audio/  → Track.Source ∈ Camera/Microphone/
 *    screen/screenAudio              ScreenShare/ScreenShareAudio
 */

interface InitDeviceArgs {
  /** "host" or "panelist" or "attendee" or "pre-guest" — drives publish grants. */
  role: "host" | "panelist" | "attendee" | "pre-guest";
  /** Pre-shared panelist token from the URL query (optional). */
  panelistToken?: string | null;
  /** Guest socket JWT, if user is unauthenticated. */
  guestToken?: string | null;
}

function slotForSource(source: Track.Source | undefined): keyof PeerStreams {
  switch (source) {
    case Track.Source.Camera:
      return "video";
    case Track.Source.Microphone:
      return "audio";
    case Track.Source.ScreenShare:
      return "screen";
    case Track.Source.ScreenShareAudio:
      return "screenAudio";
    default:
      return "video";
  }
}

/**
 * Build a fresh MediaStream wrapping the given track. We use a new MediaStream
 * per publication so the existing <video>/<audio> components key cleanly off
 * the stream identity.
 */
function streamForTrack(track: MediaStreamTrack): MediaStream {
  return new MediaStream([track]);
}

export function useWebinarLiveKit(
  socketRef: React.MutableRefObject<Socket | null>,
  webinarId: string,
  /**
   * Called when LiveKit reports a participant the socket roster has never
   * heard of — a missed `webinar:peerJoined`. The page hangs its roster
   * resync here (a ref, because the resync closure is born inside the
   * page's join effect, after this hook has run).
   */
  onRosterOutOfSyncRef?: React.MutableRefObject<(() => void) | null>
) {
  const roomRef = useRef<Room | null>(null);
  const connectingRef = useRef<Promise<Room> | null>(null);

  // Presence parity with the mobile room: LiveKit is the authority on who is
  // actually in the room, so an unexpected room drop must heal itself rather
  // than silently blanking the stage.
  const lastInitArgsRef = useRef<InitDeviceArgs | null>(null);
  const manualCloseRef = useRef(false);
  const rejoinAttemptRef = useRef(0);
  const rejoinRef = useRef<() => void>(() => {});

  // Mirror of LocalParticipant tracks so we can stop them on cleanup and
  // expose a unified MediaStream to the existing VideoGrid component.
  const localCameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const localMicTrackRef = useRef<MediaStreamTrack | null>(null);
  const localScreenTrackRef = useRef<MediaStreamTrack | null>(null);
  const localScreenAudioTrackRef = useRef<MediaStreamTrack | null>(null);

  const {
    setLocalStream,
    setScreenStream,
    setMicEnabled,
    setCamEnabled,
    setScreenSharing,
    updatePeerStream,
  } = useWebinarStore();

  // ── Resolve the LiveKit identity → store peer's socketId ───────────────
  // Remote tracks arrive keyed by participant.identity (= userId or guestId).
  // The webinar store keys peers by socketId because the chat / role-change
  // events still address peers that way. Translate using the metadata that
  // joinRoom emits.
  const peerSocketIdForIdentity = useCallback((identity: string): string | null => {
    const peers = useWebinarStore.getState().peers;
    const match = peers.find((p) => {
      // LiveKit identity matches either userId (logged-in) or "guest_xxx".
      return p.userId === identity || p.socketId === identity;
    });
    return match?.socketId ?? null;
  }, []);

  // ── Wire LiveKit → webinar store ────────────────────────────────────────

  const handleTrackSubscribed = useCallback(
    (
      track: RemoteTrack,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant
    ) => {
      const socketId = peerSocketIdForIdentity(participant.identity);
      if (!socketId) {
        // Peer isn't in the store yet (joinRoom payload arrives via Socket.IO,
        // sometimes after the LiveKit subscribe). Retry once on the next tick.
        setTimeout(() => {
          const retrySocketId = peerSocketIdForIdentity(participant.identity);
          if (retrySocketId && track.mediaStreamTrack) {
            updatePeerStream(
              retrySocketId,
              streamForTrack(track.mediaStreamTrack),
              slotForSource(publication.source)
            );
          }
        }, 250);
        return;
      }

      if (!track.mediaStreamTrack) return;
      updatePeerStream(
        socketId,
        streamForTrack(track.mediaStreamTrack),
        slotForSource(publication.source)
      );
    },
    [peerSocketIdForIdentity, updatePeerStream]
  );

  const handleTrackUnsubscribed = useCallback(
    (
      _track: RemoteTrack,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant
    ) => {
      const socketId = peerSocketIdForIdentity(participant.identity);
      if (!socketId) return;
      updatePeerStream(socketId, null, slotForSource(publication.source));
    },
    [peerSocketIdForIdentity, updatePeerStream]
  );

  const handleTrackMuted = useCallback(
    (publication: TrackPublication, participant: any) => {
      // LiveKit fires Muted when the remote pauses their mic — mirror that
      // into the existing isMuted flag on the peer for the UI mute icon.
      if (publication.source === Track.Source.Microphone) {
        const socketId = peerSocketIdForIdentity(participant.identity);
        if (socketId) useWebinarStore.getState().updatePeerMuted(socketId, true);
      }
    },
    [peerSocketIdForIdentity]
  );

  const handleTrackUnmuted = useCallback(
    (publication: TrackPublication, participant: any) => {
      if (publication.source === Track.Source.Microphone) {
        const socketId = peerSocketIdForIdentity(participant.identity);
        if (socketId) useWebinarStore.getState().updatePeerMuted(socketId, false);
      }
    },
    [peerSocketIdForIdentity]
  );

  // ── Connect to LiveKit room ─────────────────────────────────────────────

  const initDevice = useCallback(
    async (args: InitDeviceArgs) => {
      lastInitArgsRef.current = args;
      manualCloseRef.current = false;
      if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
        return roomRef.current;
      }
      if (connectingRef.current) return connectingRef.current;
      // A Room object that lost its connection is dead weight — dispose it
      // rather than letting its listeners fire alongside the replacement's.
      if (roomRef.current) {
        roomRef.current.disconnect().catch(() => {});
        roomRef.current = null;
      }

      const userToken = getToken();
      const authToken = userToken || args.guestToken || "";
      if (!authToken) {
        throw new Error("Missing auth token for LiveKit token exchange");
      }

      const tokenPromise = (async () => {
        const res = await fetch(`${API_URL}/webinar/${webinarId}/livekit-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            role: args.role,
            panelistToken: args.panelistToken || undefined,
          }),
        });
        const data = await res.json();
        if (!data?.success) {
          throw new Error(data?.error || "Failed to fetch LiveKit token");
        }
        return data as {
          token: string;
          livekitUrl: string;
          room: string;
          identity: string;
        };
      })();

      connectingRef.current = tokenPromise.then(async (creds) => {
        const room = new Room({
          // pixelDensity 'screen' → remote tiles decode at their on-screen
          // size × DPR, not full res. Keeps the sharp 1080p publish below but
          // saves viewer CPU/bandwidth when tiles are small.
          adaptiveStream: { pixelDensity: "screen" },
          dynacast: true,
          // Capture at 1080p so the published source is sharp; LiveKit
          // simulcasts down from this for lower layers.
          videoCaptureDefaults: {
            resolution: VideoPresets.h1080.resolution,
          },
          publishDefaults: {
            // Webinars: viewers usually stare at the host's tile, so a
            // 180p worst-case looks bad even on small tiles. We drop h180
            // and keep h360/h720/h1080 so adaptiveStream's floor is h360.
            videoSimulcastLayers: [
              VideoPresets.h360,
              VideoPresets.h720,
              VideoPresets.h1080,
            ],
            screenShareEncoding: {
              maxBitrate: 5_000_000,
              maxFramerate: 30,
            },
          },
        });

        room
          .on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
          .on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
          .on(RoomEvent.TrackMuted, handleTrackMuted)
          .on(RoomEvent.TrackUnmuted, handleTrackUnmuted)
          .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
            // LiveKit tells us who's currently producing audible audio.
            // We mirror that into the webinar store so VideoGrid can
            // render a speaking pulse on the right tile (or the local
            // self-tile, since the local participant uses isLocalSpeaking).
            const store = useWebinarStore.getState();
            const ids = speakers.map((s) => s.identity);
            store.setActiveSpeakers(ids);
            const localIdentity = room.localParticipant?.identity;
            store.setIsLocalSpeaking(
              !!localIdentity && ids.includes(localIdentity)
            );
          })
          // LiveKit auto-syncs egress state to every participant. Mirror
          // it into the store so the RecordingBanner shows for late
          // joiners (who'd otherwise miss the webinar:recordingStarted
          // socket broadcast that fires only on the start transition).
          .on(RoomEvent.RecordingStatusChanged, (isRec: boolean) => {
            useWebinarStore.getState().setIsRecording(!!isRec);
          })
          // Auction pings. Any client that places a bid publishes on the
          // `nc:bid` topic; the packet carries no state, only "lot X
          // changed". We re-broadcast it as a window event so useLiveLot
          // can refetch immediately instead of waiting out its 3s poll —
          // that is what makes the price move for every viewer at once.
          // Same wire format as the NetworkChain/store rooms, so a bid
          // placed from the phone app moves the price here too.
          .on(
            RoomEvent.DataReceived,
            (
              payload: Uint8Array,
              _participant?: RemoteParticipant,
              _kind?: unknown,
              topic?: string
            ) => {
              if (topic !== NC_BID_TOPIC) return;
              try {
                const parsed = JSON.parse(new TextDecoder().decode(payload));
                if (parsed?.type !== NC_BID_TOPIC) return;
                dispatchLocalPing(parsed.productId ?? null);
              } catch {
                /* ignore malformed packets */
              }
            }
          )
          // Connection quality per-participant. LiveKit fires this on
          // every quality transition; we mirror it into the store so
          // VideoGrid can render the cell-tower bars on each tile,
          // and a separate slot for the local participant's bars.
          .on(
            RoomEvent.ConnectionQualityChanged,
            (
              quality: import('livekit-client').ConnectionQuality,
              participant: import('livekit-client').Participant,
            ) => {
              const mapped =
                quality === ConnectionQuality.Excellent
                  ? 'excellent'
                  : quality === ConnectionQuality.Good
                  ? 'good'
                  : quality === ConnectionQuality.Poor
                  ? 'poor'
                  : quality === ConnectionQuality.Lost
                  ? 'lost'
                  : 'unknown';
              const store = useWebinarStore.getState();
              if (participant.isLocal) {
                store.setLocalConnectionQuality(mapped);
              } else {
                store.updatePeerConnectionQuality(participant.identity, mapped);
              }
            },
          )
          // ── Presence (ported from the mobile room) ──────────────────
          // The socket roster and LiveKit can disagree: a peer's socket
          // dies during permission prompts / backgrounding / reconnects
          // while their media flows on, and vice versa. LiveKit is the
          // authority — these two handlers reconcile the roster to it.
          .on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
            const known = useWebinarStore
              .getState()
              .peers.some(
                (pp) => pp.userId === p.identity || pp.socketId === p.identity
              );
            if (!known) onRosterOutOfSyncRef?.current?.();
          })
          .on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
            // A ghost row is a peer whose socket died while their media
            // lived on. Their LiveKit leg ending is the real "left".
            const store = useWebinarStore.getState();
            const ghosts = store.peers.filter(
              (pp) => pp.socketStale && pp.userId === p.identity
            );
            if (ghosts.length > 0) {
              toast.info(`${ghosts[0].name} left`);
              store.removeStalePeersByUserId(p.identity);
            }
          })
          .on(RoomEvent.Reconnecting, () => {
            toast.info("Video connection interrupted — reconnecting…", {
              id: "lk-reconnect",
            });
          })
          .on(RoomEvent.Reconnected, () => {
            toast.success("Video connection restored", { id: "lk-reconnect" });
            // Re-fire the subscribe handler for everything the room holds so
            // any stream reference dropped during the gap is rebound.
            room.remoteParticipants.forEach((participant) => {
              participant.trackPublications.forEach((pub) => {
                if (pub.track && pub.isSubscribed) {
                  handleTrackSubscribed(
                    pub.track as RemoteTrack,
                    pub as RemoteTrackPublication,
                    participant
                  );
                }
              });
            });
          })
          .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
            // A superseded Room instance (disposed by a later initDevice)
            // fires this too — only the current room's death matters.
            const wasCurrent = roomRef.current === room;
            if (wasCurrent) roomRef.current = null;
            if (!wasCurrent || manualCloseRef.current) return;
            if (reason === DisconnectReason.CLIENT_INITIATED) return;
            if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
              // The server allows one media session per identity — a second
              // device/tab on this account just took ours. Reconnecting here
              // would only steal it back and ping-pong forever.
              toast.error(
                "This stream was opened from another device or tab — video stopped here."
              );
              return;
            }
            if (
              reason === DisconnectReason.PARTICIPANT_REMOVED ||
              reason === DisconnectReason.ROOM_DELETED
            ) {
              // Kicked / webinar ended — the matching socket events own the
              // UX and navigation; rejoining would fight them.
              return;
            }
            rejoinRef.current();
          });

        await room.connect(creds.livekitUrl, creds.token);
        // Pick up the current state immediately — RecordingStatusChanged
        // doesn't fire on connect, only on transitions.
        if (room.isRecording) {
          useWebinarStore.getState().setIsRecording(true);
        }
        roomRef.current = room;
        connectingRef.current = null;
        return room;
      });

      return connectingRef.current;
    },
    [
      webinarId,
      onRosterOutOfSyncRef,
      handleTrackSubscribed,
      handleTrackUnsubscribed,
      handleTrackMuted,
      handleTrackUnmuted,
    ]
  );

  // ── Local media ─────────────────────────────────────────────────────────

  const rebuildLocalStream = useCallback(() => {
    const tracks: MediaStreamTrack[] = [];
    if (localCameraTrackRef.current) tracks.push(localCameraTrackRef.current);
    if (localMicTrackRef.current) tracks.push(localMicTrackRef.current);
    setLocalStream(tracks.length > 0 ? new MediaStream(tracks) : null);
  }, [setLocalStream]);

  const startMedia = useCallback(async () => {
    const room = roomRef.current;
    if (!room) throw new Error("LiveKit room not connected");

    // Enable camera + mic via the SDK helpers — they negotiate & publish in
    // one call.
    const [camPub, micPub] = await Promise.all([
      room.localParticipant.setCameraEnabled(true).catch((err) => {
        console.warn("[LK] camera enable failed:", err?.message);
        return undefined;
      }),
      room.localParticipant.setMicrophoneEnabled(true).catch((err) => {
        console.warn("[LK] mic enable failed:", err?.message);
        return undefined;
      }),
    ]);

    localCameraTrackRef.current = camPub?.track?.mediaStreamTrack ?? null;
    localMicTrackRef.current = micPub?.track?.mediaStreamTrack ?? null;

    rebuildLocalStream();
    setCamEnabled(!!localCameraTrackRef.current);
    setMicEnabled(!!localMicTrackRef.current);
    socketRef.current?.emit("webinar:micState", {
      webinarId,
      muted: !localMicTrackRef.current,
    });

    return useWebinarStore.getState().localStream;
  }, [rebuildLocalStream, setCamEnabled, setMicEnabled, socketRef, webinarId]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const enabled = room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(!enabled);
    setMicEnabled(!enabled);
    socketRef.current?.emit("webinar:micState", {
      webinarId,
      muted: enabled, // muted state AFTER toggle is the previous "enabled"
    });
  }, [setMicEnabled, socketRef, webinarId]);

  const forceMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setMicrophoneEnabled(false);
    setMicEnabled(false);
    socketRef.current?.emit("webinar:micState", { webinarId, muted: true });
  }, [setMicEnabled, socketRef, webinarId]);

  const toggleCam = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const enabled = room.localParticipant.isCameraEnabled;
    await room.localParticipant.setCameraEnabled(!enabled);
    const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
    localCameraTrackRef.current = !enabled
      ? (camPub?.track?.mediaStreamTrack ?? null)
      : null;
    rebuildLocalStream();
    setCamEnabled(!enabled);
    // Explicit camera-state signal — viewers swap to avatar overlay
    // immediately rather than holding the last frame while waiting on
    // an inbound `mute` event that may not arrive on flaky networks.
    socketRef.current?.emit("webinar:cameraState", {
      webinarId,
      enabled: !enabled,
    });
  }, [rebuildLocalStream, setCamEnabled, socketRef, webinarId]);

  const shareScreen = useCallback(async () => {
    const room = roomRef.current;
    if (!room) throw new Error("LiveKit room not connected");

    await room.localParticipant.setScreenShareEnabled(true, { audio: true });

    const screenPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
    const screenAudioPub = room.localParticipant.getTrackPublication(
      Track.Source.ScreenShareAudio
    );

    localScreenTrackRef.current = screenPub?.track?.mediaStreamTrack ?? null;
    localScreenAudioTrackRef.current =
      screenAudioPub?.track?.mediaStreamTrack ?? null;

    const screenTracks: MediaStreamTrack[] = [];
    if (localScreenTrackRef.current) screenTracks.push(localScreenTrackRef.current);
    if (localScreenAudioTrackRef.current)
      screenTracks.push(localScreenAudioTrackRef.current);
    const screenStream = screenTracks.length
      ? new MediaStream(screenTracks)
      : null;
    setScreenStream(screenStream);
    setScreenSharing(true);

    // Detect the user clicking "Stop sharing" in the browser bar — LiveKit
    // fires LocalTrackUnpublished on the screen track when that happens.
    if (localScreenTrackRef.current) {
      localScreenTrackRef.current.addEventListener(
        "ended",
        () => stopScreenShare(),
        { once: true }
      );
    }

    return screenStream;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setScreenStream, setScreenSharing]);

  const stopScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setScreenShareEnabled(false);
    localScreenTrackRef.current = null;
    localScreenAudioTrackRef.current = null;
    setScreenStream(null);
    setScreenSharing(false);
  }, [setScreenStream, setScreenSharing]);

  // ── Demotion: unpublish but keep subscribed ─────────────────────────────

  const cleanupSendOnly = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    await Promise.all([
      room.localParticipant.setCameraEnabled(false),
      room.localParticipant.setMicrophoneEnabled(false),
      room.localParticipant.setScreenShareEnabled(false),
    ]).catch(() => {});

    localCameraTrackRef.current = null;
    localMicTrackRef.current = null;
    localScreenTrackRef.current = null;
    localScreenAudioTrackRef.current = null;
    setLocalStream(null);
    setScreenStream(null);
    setScreenSharing(false);
    setCamEnabled(false);
    setMicEnabled(false);
  }, [
    setLocalStream,
    setScreenStream,
    setScreenSharing,
    setCamEnabled,
    setMicEnabled,
  ]);

  // ── Full disconnect ─────────────────────────────────────────────────────

  const cleanup = useCallback(async () => {
    // Deliberate teardown — the Disconnected handler must not treat it as a
    // failure and try to rejoin.
    manualCloseRef.current = true;
    const room = roomRef.current;
    if (room) {
      await room.disconnect().catch(() => {});
      roomRef.current = null;
    }
    connectingRef.current = null;
    localCameraTrackRef.current = null;
    localMicTrackRef.current = null;
    localScreenTrackRef.current = null;
    localScreenAudioTrackRef.current = null;
  }, []);

  // ── No-ops kept for API parity with the old mediasoup hook ──────────────
  // The webinar page still calls these in a couple of places; LiveKit makes
  // them unnecessary but we keep them callable so callers don't need to be
  // refactored at the same time.

  const consume = useCallback(async () => {
    /* LiveKit auto-subscribes — no-op */
  }, []);

  const refreshConsumers = useCallback(() => {
    // LiveKit re-fires TrackSubscribed for any track we already have, so
    // rebuilding from the room state is the safest "refresh".
    const room = roomRef.current;
    if (!room) return;
    room.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((pub) => {
        if (pub.track && pub.isSubscribed) {
          handleTrackSubscribed(
            pub.track as RemoteTrack,
            pub as RemoteTrackPublication,
            participant
          );
        }
      });
    });
  }, [handleTrackSubscribed]);

  const ensureSendTransport = useCallback(async () => {
    /* LiveKit Room owns the publish path — nothing to ensure. */
  }, []);

  /**
   * Stable accessor for the underlying LiveKit Room. Used by feature hooks
   * (e.g. virtual background) that need direct access to localParticipant /
   * track publications. Returns null until `initDevice` has connected.
   */
  const getRoom = useCallback(() => roomRef.current, []);

  // Rejoin after an unexpected room drop. Lives in a ref so the Disconnected
  // handler (wired inside initDevice's closure) always calls the current
  // render's version. Backoff grows per attempt; three misses means the
  // network is gone and a toast asks for a reload instead of spinning.
  rejoinRef.current = () => {
    const args = lastInitArgsRef.current;
    if (!args || manualCloseRef.current) return;
    const attempt = ++rejoinAttemptRef.current;
    if (attempt > 3) {
      toast.error(
        "Could not restore the video connection — reload the page to rejoin."
      );
      rejoinAttemptRef.current = 0;
      return;
    }
    toast.warning("Video connection lost — reconnecting…", {
      id: "lk-reconnect",
    });
    window.setTimeout(async () => {
      if (manualCloseRef.current) return;
      const wasCam = useWebinarStore.getState().camEnabled;
      const wasMic = useWebinarStore.getState().micEnabled;
      try {
        await initDevice(args);
        rejoinAttemptRef.current = 0;
        toast.success("Video connection restored", { id: "lk-reconnect" });
        const room = roomRef.current;
        if (room && (wasCam || wasMic)) {
          // The old room's local tracks died with it — republish what the
          // user had on so a blip doesn't silently take a host off air.
          await Promise.all([
            wasCam
              ? room.localParticipant.setCameraEnabled(true)
              : Promise.resolve(undefined),
            wasMic
              ? room.localParticipant.setMicrophoneEnabled(true)
              : Promise.resolve(undefined),
          ]).catch(() => {});
          const camPub = room.localParticipant.getTrackPublication(
            Track.Source.Camera
          );
          const micPub = room.localParticipant.getTrackPublication(
            Track.Source.Microphone
          );
          localCameraTrackRef.current = camPub?.track?.mediaStreamTrack ?? null;
          localMicTrackRef.current = micPub?.track?.mediaStreamTrack ?? null;
          rebuildLocalStream();
        }
      } catch {
        rejoinRef.current();
      }
    }, 1500 * attempt);
  };

  /**
   * Announce a placed bid on the `nc:bid` topic so every other viewer refetches
   * the lot immediately rather than on their own poll. Reliable delivery: a
   * dropped ping costs a viewer up to 3 seconds of stale price on a lot that
   * may only run for 30.
   *
   * Best-effort by design — the bid itself is already committed server-side,
   * so a failed publish is a latency problem, never a correctness one.
   */
  const publishBidPing = useCallback(async (productId: string | null) => {
    await publishBidPingTo(roomRef.current, productId);
  }, []);

  // ── Device selection (multi-cam / multi-mic users) ─────────────────────

  /** Enumerate input + output devices the browser knows about. */
  const listMediaDevices = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      return {
        videoinput: [] as MediaDeviceInfo[],
        audioinput: [] as MediaDeviceInfo[],
        audiooutput: [] as MediaDeviceInfo[],
      };
    }
    const all = await navigator.mediaDevices.enumerateDevices();
    return {
      videoinput: all.filter((d) => d.kind === "videoinput"),
      audioinput: all.filter((d) => d.kind === "audioinput"),
      audiooutput: all.filter((d) => d.kind === "audiooutput"),
    };
  }, []);

  /**
   * Switch the active camera device. Updates the published camera track in
   * place via LiveKit's switchActiveDevice — no need to unpublish/republish.
   */
  const setVideoDevice = useCallback(async (deviceId: string) => {
    const room = roomRef.current;
    if (!room) return;
    await room.switchActiveDevice("videoinput", deviceId);
    const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
    localCameraTrackRef.current = camPub?.track?.mediaStreamTrack ?? null;
    rebuildLocalStream();
  }, [rebuildLocalStream]);

  /** Switch the active microphone — see setVideoDevice for behaviour. */
  const setAudioDevice = useCallback(async (deviceId: string) => {
    const room = roomRef.current;
    if (!room) return;
    await room.switchActiveDevice("audioinput", deviceId);
    const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    localMicTrackRef.current = micPub?.track?.mediaStreamTrack ?? null;
    rebuildLocalStream();
  }, [rebuildLocalStream]);

  /**
   * Switch the speaker (audio-output) device. LiveKit's
   * switchActiveDevice("audiooutput", id) walks every <audio>/<video>
   * element it attached to and applies setSinkId(id). Browsers that
   * don't implement setSinkId (Firefox without a flag, some mobile
   * Safari versions) are no-ops — LiveKit silently skips them.
   *
   * We also stash the chosen sinkId on the room so any LATER attached
   * track (e.g. a participant joining after the user picked) inherits
   * it; LiveKit handles that internally via switchActiveDevice's
   * persistence model.
   */
  const setOutputDevice = useCallback(async (deviceId: string) => {
    const room = roomRef.current;
    if (!room) return;
    await room.switchActiveDevice("audiooutput", deviceId);
  }, []);

  return {
    initDevice,
    startMedia,
    toggleMic,
    forceMute,
    toggleCam,
    shareScreen,
    stopScreenShare,
    consume,
    cleanup,
    cleanupSendOnly,
    refreshConsumers,
    ensureSendTransport,
    getRoom,
    publishBidPing,
    listMediaDevices,
    setVideoDevice,
    setAudioDevice,
    setOutputDevice,
  };
}
