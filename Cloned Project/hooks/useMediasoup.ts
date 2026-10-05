"use client";

import { useRef, useCallback } from "react";
import type { Socket } from "socket.io-client";
import type { types } from "mediasoup-client";

type Transport = types.Transport;
type Producer = types.Producer;
type Consumer = types.Consumer;
type RtpCapabilities = types.RtpCapabilities;
import {
  loadDevice,
  createSendTransport,
  createRecvTransport,
  consumeStream,
} from "@/lib/mediasoupClient";
import useWebinarStore from "@/store/webinarStore";
import type { PeerStreams } from "@/store/webinarStore";

// ── Types ───────────────────────────────────────────────────────────────────

interface ProducerMap {
  video?: Producer;
  audio?: Producer;
  screen?: Producer;
  screenAudio?: Producer;
}

interface ConsumerMap {
  [producerId: string]: Consumer;
}

interface ProducerAppData {
  type?: string;
  [key: string]: unknown;
}

interface PendingConsume {
  producerId: string;
  producerSocketId: string;
  kind: "audio" | "video";
  appData?: ProducerAppData;
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useMediasoup(
  socketRef: React.MutableRefObject<Socket | null>,
  webinarId: string
) {
  const sendTransportRef = useRef<Transport | null>(null);
  const sendTransportPendingRef = useRef<Promise<void> | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const producersRef = useRef<ProducerMap>({});
  const consumersRef = useRef<ConsumerMap>({});
  // Queue for consume requests that arrive before recv transport is ready
  const pendingConsumesRef = useRef<PendingConsume[]>([]);

  const {
    setLocalStream,
    setScreenStream,
    setMicEnabled,
    setCamEnabled,
    setScreenSharing,
    updatePeerStream,
  } = useWebinarStore();

  // ── Consume remote stream (internal) ────────────────────────────────────

  const doConsume = useCallback(
    async (
      producerId: string,
      producerSocketId: string,
      kind: "audio" | "video",
      appData?: ProducerAppData
    ) => {
      if (!recvTransportRef.current) {
        console.warn("[mediasoup] doConsume called but no recv transport — this should not happen");
        return;
      }
      const socket = socketRef.current;
      if (!socket) {
        console.warn("[mediasoup] doConsume called but no socket");
        return;
      }

      // Skip if already consuming this producer
      if (consumersRef.current[producerId]) {
        console.log("[mediasoup] Already consuming producer:", producerId);
        return;
      }

      try {
        console.log("[mediasoup] Consuming producer:", producerId, kind, "from peer:", producerSocketId);
        const { consumer, stream } = await consumeStream(
          socket,
          webinarId,
          recvTransportRef.current,
          producerId
        );
        consumersRef.current[producerId] = consumer;

        // Route to correct stream slot based on appData type
        const type =
          appData?.type || (consumer.appData as ProducerAppData)?.type;
        const slot: keyof PeerStreams =
          type === "screen"
            ? "screen"
            : type === "screenAudio"
              ? "screenAudio"
              : (kind as keyof PeerStreams);

        console.log("[mediasoup] Updating peer stream:", producerSocketId, "slot:", slot, "track.readyState:", consumer.track.readyState);
        updatePeerStream(producerSocketId, stream, slot);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[mediasoup] consume error for producer", producerId, ":", message);
      }
    },
    [socketRef, webinarId, updatePeerStream]
  );

  // ── Drain pending consume queue ─────────────────────────────────────────

  const drainPendingConsumes = useCallback(() => {
    if (!recvTransportRef.current) return;
    const pending = pendingConsumesRef.current;
    if (pending.length === 0) return;
    console.log("[mediasoup] Draining", pending.length, "pending consume requests");
    pendingConsumesRef.current = [];
    pending.forEach((p) => doConsume(p.producerId, p.producerSocketId, p.kind, p.appData));
  }, [doConsume]);

  // ── Init device ─────────────────────────────────────────────────────────

  const initDevice = useCallback(
    async (rtpCapabilities: RtpCapabilities) => {
      const socket = socketRef.current;
      if (!socket) throw new Error("Socket not connected");
      await loadDevice(rtpCapabilities);

      recvTransportRef.current = await createRecvTransport(socket, webinarId);
      console.log("[mediasoup] Recv transport created:", recvTransportRef.current.id);

      const role = useWebinarStore.getState().role;
      if (role === "host" || role === "panelist") {
        sendTransportRef.current = await createSendTransport(socket, webinarId);
        console.log("[mediasoup] Send transport created:", sendTransportRef.current.id);
      }

      // Drain any consume requests that arrived during init
      drainPendingConsumes();
    },
    [socketRef, webinarId, drainPendingConsumes]
  );

  // ── Ensure send transport (for late-promoted panelists) ─────────────────

  const ensureSendTransport = useCallback(async () => {
    if (sendTransportRef.current) return;
    if (sendTransportPendingRef.current) return sendTransportPendingRef.current;

    const socket = socketRef.current;
    if (!socket) throw new Error("Not connected");

    sendTransportPendingRef.current = createSendTransport(socket, webinarId)
      .then((t) => {
        sendTransportRef.current = t;
        sendTransportPendingRef.current = null;
      })
      .catch((err) => {
        sendTransportPendingRef.current = null;
        throw err;
      });

    return sendTransportPendingRef.current;
  }, [socketRef, webinarId]);

  // ── Start camera + mic ──────────────────────────────────────────────────

  const startMedia = useCallback(async () => {
    const existing = useWebinarStore.getState().localStream;
    if (existing) existing.getTracks().forEach((t) => t.stop());

    await ensureSendTransport();

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1920, min: 640 },
        height: { ideal: 1080, min: 480 },
        frameRate: { ideal: 30, min: 15 },
        facingMode: "user",
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 2,
      },
    });
    setLocalStream(stream);

    const vt = stream.getVideoTracks()[0];
    const at = stream.getAudioTracks()[0];

    if (vt && sendTransportRef.current) {
      const vp = await sendTransportRef.current.produce({
        track: vt,
        encodings: [
          {
            rid: "r0",
            maxBitrate: 300_000,
            scaleResolutionDownBy: 4,
            scalabilityMode: "S1T3",
          },
          {
            rid: "r1",
            maxBitrate: 800_000,
            scaleResolutionDownBy: 2,
            scalabilityMode: "S1T3",
          },
          {
            rid: "r2",
            maxBitrate: 2_500_000,
            scaleResolutionDownBy: 1,
            scalabilityMode: "S1T3",
          },
        ],
        codecOptions: {
          videoGoogleStartBitrate: 1000,
          videoGoogleMaxBitrate: 2500,
          videoGoogleMinBitrate: 100,
        },
        appData: { type: "camera" },
      });
      producersRef.current.video = vp;
      setCamEnabled(true);

      vt.onended = () => {
        vp.close();
        delete producersRef.current.video;
        setCamEnabled(false);
      };
    }

    if (at && sendTransportRef.current) {
      const ap = await sendTransportRef.current.produce({
        track: at,
        appData: { type: "audio" },
      });
      producersRef.current.audio = ap;
      setMicEnabled(true);
      socketRef.current?.emit("webinar:micState", {
        webinarId,
        muted: false,
      });
    }

    return stream;
  }, [
    ensureSendTransport,
    setLocalStream,
    setCamEnabled,
    setMicEnabled,
    socketRef,
    webinarId,
  ]);

  // ── Toggle mic ──────────────────────────────────────────────────────────

  const toggleMic = useCallback(() => {
    const p = producersRef.current.audio;
    if (!p) return;
    if (p.paused) {
      p.resume();
      setMicEnabled(true);
    } else {
      p.pause();
      setMicEnabled(false);
    }
    socketRef.current?.emit("webinar:micState", {
      webinarId,
      muted: p.paused,
    });
  }, [socketRef, webinarId, setMicEnabled]);

  // ── Force mute (called by host) ────────────────────────────────────────

  const forceMute = useCallback(() => {
    const p = producersRef.current.audio;
    if (p && !p.paused) {
      p.pause();
      setMicEnabled(false);
    }
    socketRef.current?.emit("webinar:micState", {
      webinarId,
      muted: true,
    });
  }, [socketRef, webinarId, setMicEnabled]);

  // ── Toggle camera ───────────────────────────────────────────────────────

  const toggleCam = useCallback(() => {
    const p = producersRef.current.video;
    if (!p) return;
    if (p.paused) {
      p.resume();
      setCamEnabled(true);
    } else {
      p.pause();
      setCamEnabled(false);
    }
    // Mediasoup pauses the producer rather than ending it, so the
    // receiver's `mute` event isn't always reliable across networks.
    // Broadcast the explicit on/off so other tiles can swap to the
    // avatar overlay without waiting on a WebRTC signal that may never
    // arrive (the cause of the "frozen camera frame" bug).
    socketRef.current?.emit("webinar:cameraState", {
      webinarId,
      enabled: !p.paused,
    });
  }, [socketRef, webinarId, setCamEnabled]);

  // ── Share screen ────────────────────────────────────────────────────────

  const shareScreen = useCallback(async () => {
    await ensureSendTransport();

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      },
      audio: true,
    });

    setScreenStream(stream);
    setScreenSharing(true);

    const vt = stream.getVideoTracks()[0];
    if (vt && sendTransportRef.current) {
      if ("contentHint" in vt) {
        vt.contentHint = "detail";
      }

      const sp = await sendTransportRef.current.produce({
        track: vt,
        encodings: [
          {
            maxBitrate: 5_000_000,
            maxFramerate: 30,
            scaleResolutionDownBy: 1,
          },
        ],
        codecOptions: {
          videoGoogleStartBitrate: 2000,
          videoGoogleMaxBitrate: 5000,
          videoGoogleMinBitrate: 500,
        },
        appData: { type: "screen" },
      });
      producersRef.current.screen = sp;
      vt.onended = () => stopScreenShare();
    }

    const at = stream.getAudioTracks()[0];
    if (at && sendTransportRef.current) {
      const sap = await sendTransportRef.current.produce({
        track: at,
        appData: { type: "screenAudio" },
      });
      producersRef.current.screenAudio = sap;
    }

    return stream;
  }, [ensureSendTransport, setScreenStream, setScreenSharing]);

  // ── Stop screen share ───────────────────────────────────────────────────

  const stopScreenShare = useCallback(() => {
    const socket = socketRef.current;
    (["screen", "screenAudio"] as const).forEach((key) => {
      const p = producersRef.current[key];
      if (p && !p.closed) {
        socket?.emit("webinar:closeProducer", {
          webinarId,
          producerId: p.id,
        });
        try {
          p.close();
        } catch {
          /* ignore */
        }
        delete producersRef.current[key];
      }
    });
    const { screenStream: ss } = useWebinarStore.getState();
    ss?.getTracks().forEach((t) => t.stop());
    setScreenStream(null);
    setScreenSharing(false);
  }, [socketRef, webinarId, setScreenStream, setScreenSharing]);

  // ── Public consume (queues if transport not ready) ──────────────────────

  const consume = useCallback(
    async (
      producerId: string,
      producerSocketId: string,
      kind: "audio" | "video",
      appData?: ProducerAppData
    ) => {
      if (!recvTransportRef.current) {
        // Queue for later — will be drained after initDevice completes
        console.log("[mediasoup] Recv transport not ready, queuing consume for producer:", producerId);
        pendingConsumesRef.current.push({ producerId, producerSocketId, kind, appData });
        return;
      }
      await doConsume(producerId, producerSocketId, kind, appData);
    },
    [doConsume]
  );

  // ── Cleanup send-side only (demotion: keep recv transport + consumers) ─

  const cleanupSendOnly = useCallback(() => {
    const socket = socketRef.current;
    // Close all producers and notify server
    Object.entries(producersRef.current).forEach(([, p]) => {
      if (p && !p.closed) {
        socket?.emit("webinar:closeProducer", { webinarId, producerId: p.id });
        try { p.close(); } catch { /* ignore */ }
      }
    });
    producersRef.current = {};
    try { sendTransportRef.current?.close(); } catch { /* ignore */ }
    sendTransportRef.current = null;
    sendTransportPendingRef.current = null;
    // recv transport, consumers and pendingConsumes intentionally NOT touched
  }, [socketRef, webinarId]);

  // ── Refresh consumers (defensive: re-consume producers we're missing) ──
  // Called after demotion to guarantee the attendee still receives all
  // currently-active producer streams even if a consumer dropped silently.
  const refreshConsumers = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !recvTransportRef.current) return;
    socket.emit(
      "webinar:getProducers",
      { webinarId },
      (producers: Array<{ producerId: string; producerSocketId: string; kind: "audio" | "video"; appData?: ProducerAppData }>) => {
        (producers || []).forEach(({ producerId, producerSocketId, kind, appData }) => {
          // Skip own producers and already-active consumers
          if (producerSocketId === socket.id) return;
          const existing = consumersRef.current[producerId];
          if (existing && !existing.closed) return;
          if (existing?.closed) delete consumersRef.current[producerId];
          doConsume(producerId, producerSocketId, kind, appData);
        });
      }
    );
  }, [socketRef, webinarId, doConsume]);

  // ── Cleanup ─────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    const socket = socketRef.current;

    Object.entries(producersRef.current).forEach(([, p]) => {
      if (p && !p.closed) {
        socket?.emit("webinar:closeProducer", {
          webinarId,
          producerId: p.id,
        });
        try {
          p.close();
        } catch {
          /* ignore */
        }
      }
    });

    Object.values(consumersRef.current).forEach((c) => {
      try {
        c.close();
      } catch {
        /* ignore */
      }
    });

    try {
      sendTransportRef.current?.close();
    } catch {
      /* ignore */
    }
    try {
      recvTransportRef.current?.close();
    } catch {
      /* ignore */
    }

    producersRef.current = {};
    consumersRef.current = {};
    pendingConsumesRef.current = [];
    sendTransportRef.current = null;
    sendTransportPendingRef.current = null;
    recvTransportRef.current = null;
  }, [socketRef, webinarId]);

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
  };
}
