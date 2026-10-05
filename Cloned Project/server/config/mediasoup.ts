export interface MediasoupConfig {
  worker: {
    rtcMinPort: number;
    rtcMaxPort: number;
    logLevel: string;
    logTags: string[];
  };
  router: {
    mediaCodecs: Array<{
      kind: "audio" | "video";
      mimeType: string;
      clockRate: number;
      channels?: number;
      parameters?: Record<string, string | number>;
    }>;
  };
  webRtcTransport: {
    listenIps: Array<{ ip: string; announcedIp?: string }>;
    initialAvailableOutgoingBitrate: number;
    minimumAvailableOutgoingBitrate: number;
    maxSctpMessageSize: number;
    maxIncomingBitrate: number;
  };
}

export const mediasoupConfig: MediasoupConfig = {
  worker: {
    rtcMinPort: parseInt(process.env.MEDIASOUP_RTC_MIN_PORT || "10000", 10),
    rtcMaxPort: parseInt(process.env.MEDIASOUP_RTC_MAX_PORT || "10999", 10),
    logLevel: "warn",
    logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
  },
  router: {
    mediaCodecs: [
      {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
        parameters: {
          "x-google-start-bitrate": 1000,
        },
      },
      {
        kind: "video",
        mimeType: "video/VP9",
        clockRate: 90000,
        parameters: {
          "profile-id": 2,
          "x-google-start-bitrate": 1000,
        },
      },
      {
        kind: "video",
        mimeType: "video/h264",
        clockRate: 90000,
        parameters: {
          "packetization-mode": 1,
          "profile-level-id": "4d0032",
          "level-asymmetry-allowed": 1,
          "x-google-start-bitrate": 1000,
        },
      },
    ],
  },
  webRtcTransport: {
    listenIps: [
      {
        ip: process.env.MEDIASOUP_LISTEN_IP || "0.0.0.0",
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || "127.0.0.1",
      },
    ],
    initialAvailableOutgoingBitrate: 5_000_000, // 5 Mbps start
    minimumAvailableOutgoingBitrate: 800_000,   // 800 kbps floor
    maxSctpMessageSize: 262144,
    maxIncomingBitrate: 15_000_000,             // 15 Mbps — support HD screen share + camera
  },
};
