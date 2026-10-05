import { Device, types } from "mediasoup-client";
import type { Socket } from "socket.io-client";

type Transport = types.Transport;
type Consumer = types.Consumer;
type RtpCapabilities = types.RtpCapabilities;

// ── Device singleton ────────────────────────────────────────────────────────

let device: Device | null = null;

export function getDevice(): Device | null {
  return device;
}

export async function loadDevice(
  rtpCapabilities: RtpCapabilities
): Promise<Device> {
  device = new Device();
  await device.load({ routerRtpCapabilities: rtpCapabilities });
  return device;
}

export function resetDevice(): void {
  device = null;
}

// ── Transport helpers ───────────────────────────────────────────────────────

interface TransportResponse {
  success: boolean;
  error?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any;
}

interface ConnectResponse {
  success: boolean;
  error?: string;
}

interface ProduceResponse {
  success: boolean;
  error?: string;
  producerId: string;
}

/**
 * Create a send (producing) transport via the server.
 */
export async function createSendTransport(
  socket: Socket,
  webinarId: string
): Promise<Transport> {
  return new Promise((resolve, reject) => {
    socket.emit(
      "webinar:createWebRtcTransport",
      { webinarId, consuming: false },
      async (response: TransportResponse) => {
        if (!response.success) return reject(new Error(response.error));
        if (!device) return reject(new Error("Device not loaded"));

        const transport = device.createSendTransport(response.params);

        transport.on("connect", ({ dtlsParameters }, callback, errback) => {
          socket.emit(
            "webinar:connectTransport",
            { webinarId, transportId: transport.id, dtlsParameters },
            (res: ConnectResponse) => {
              if (res.success) callback();
              else errback(new Error(res.error));
            }
          );
        });

        transport.on(
          "produce",
          ({ kind, rtpParameters, appData }, callback, errback) => {
            socket.emit(
              "webinar:produce",
              {
                webinarId,
                transportId: transport.id,
                kind,
                rtpParameters,
                appData,
              },
              (res: ProduceResponse) => {
                if (res.success) callback({ id: res.producerId });
                else errback(new Error(res.error));
              }
            );
          }
        );

        resolve(transport);
      }
    );
  });
}

/**
 * Create a receive (consuming) transport via the server.
 */
export async function createRecvTransport(
  socket: Socket,
  webinarId: string
): Promise<Transport> {
  return new Promise((resolve, reject) => {
    socket.emit(
      "webinar:createWebRtcTransport",
      { webinarId, consuming: true },
      async (response: TransportResponse) => {
        if (!response.success) return reject(new Error(response.error));
        if (!device) return reject(new Error("Device not loaded"));

        const transport = device.createRecvTransport(response.params);

        transport.on("connect", ({ dtlsParameters }, callback, errback) => {
          console.log("[mediasoup] Recv transport DTLS connecting...");
          socket.emit(
            "webinar:connectTransport",
            { webinarId, transportId: transport.id, dtlsParameters },
            (res: ConnectResponse) => {
              if (res.success) {
                console.log("[mediasoup] Recv transport DTLS connected OK");
                callback();
              } else {
                console.error("[mediasoup] Recv transport DTLS connect FAILED:", res.error);
                errback(new Error(res.error));
              }
            }
          );
        });

        // Monitor ICE/DTLS state for diagnostics
        transport.on("connectionstatechange", (state: string) => {
          console.log("[mediasoup] Recv transport connection state:", state);
        });
        transport.on("icegatheringstatechange", (state: string) => {
          console.log("[mediasoup] Recv transport ICE gathering state:", state);
        });

        resolve(transport);
      }
    );
  });
}

// ── Consumer helper ─────────────────────────────────────────────────────────

interface ConsumeResponse {
  success: boolean;
  error?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any;
}

export interface ConsumeResult {
  consumer: Consumer;
  stream: MediaStream;
}

/**
 * Consume a remote producer.
 * Matches the reference garageWebinar pattern exactly:
 * consume → fire-and-forget resume → return stream immediately
 */
export async function consumeStream(
  socket: Socket,
  webinarId: string,
  recvTransport: Transport,
  producerId: string
): Promise<ConsumeResult> {
  return new Promise((resolve, reject) => {
    if (!device) return reject(new Error("Device not loaded"));

    console.log("[mediasoup] Emitting webinar:consume for producer:", producerId);
    socket.emit(
      "webinar:consume",
      {
        webinarId,
        transportId: recvTransport.id,
        producerId,
        rtpCapabilities: device.rtpCapabilities,
      },
      async (response: ConsumeResponse) => {
        console.log("[mediasoup] consume response:", response.success, response.error || "");
        if (!response.success) return reject(new Error(response.error));

        try {
          const consumer = await recvTransport.consume(response.params);
          console.log("[mediasoup] Consumer created:", consumer.id, consumer.kind,
            "paused:", consumer.paused,
            "track.readyState:", consumer.track.readyState,
            "track.muted:", consumer.track.muted,
            "track.enabled:", consumer.track.enabled);

          // Resume the consumer server-side — fire and forget
          // (matches the working reference garageWebinar pattern)
          socket.emit(
            "webinar:resumeConsumer",
            { webinarId, consumerId: consumer.id },
            (ack: any) => {
              console.log("[mediasoup] resumeConsumer ack:", consumer.id, ack);
            }
          );

          const stream = new MediaStream([consumer.track]);
          resolve({ consumer, stream });
        } catch (err) {
          console.error("[mediasoup] recvTransport.consume() threw:", err);
          reject(err);
        }
      }
    );
  });
}
