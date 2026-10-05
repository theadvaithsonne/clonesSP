# `server/config/mediasoup.ts`

> Static configuration for the mediasoup SFU used by webinars: worker UDP port range, router codecs and WebRTC transport bitrates.

**Kind:** backend config · **Lines:** 84

## Purpose
The webinar media server runs on mediasoup (a selective forwarding unit). `server/services/mediasoup.ts` creates workers, routers and WebRTC transports from this object, so all tunables for that layer live in one place.

## How it works
- **Worker:** `rtcMinPort` / `rtcMaxPort` from `MEDIASOUP_RTC_MIN_PORT` / `MEDIASOUP_RTC_MAX_PORT` (defaults 10000-10999). These ports must be open (UDP/TCP) on the host firewall for media to flow. `logLevel: "warn"` with tags info, ice, dtls, rtp, srtp, rtcp.
- **Router codecs:** Opus audio (48 kHz, stereo); video VP8, VP9 (profile-id 2) and H.264 (packetization-mode 1, profile-level-id `4d0032`, level-asymmetry allowed), each with `x-google-start-bitrate: 1000`.
- **WebRTC transport:** listens on `MEDIASOUP_LISTEN_IP` (default `0.0.0.0`) and announces `MEDIASOUP_ANNOUNCED_IP` (default `127.0.0.1`). Bitrates: start at 5 Mbps outgoing, floor 800 kbps, max incoming 15 Mbps (enough for HD screen share plus camera); SCTP max message size 262144.

## Exports
- `interface MediasoupConfig` - shape of the config (worker, router, webRtcTransport).
- `mediasoupConfig: MediasoupConfig` - the values above.

## Interfaces
- **Environment variables:** `MEDIASOUP_RTC_MIN_PORT`, `MEDIASOUP_RTC_MAX_PORT` - RTC port range; `MEDIASOUP_LISTEN_IP` - bind address; `MEDIASOUP_ANNOUNCED_IP` - public IP given to clients in ICE candidates.

## Dependencies
None (env is read directly from `process.env`, not through `config/env.ts`).

## Used by
- `server/services/mediasoup.ts` - passes `worker` to worker creation, `router.mediaCodecs` to router creation, and `webRtcTransport` to transport creation (also applying `maxIncomingBitrate`).

## Notes
- The announced-IP default of `127.0.0.1` only works locally. In production `MEDIASOUP_ANNOUNCED_IP` must be the server's public IP, otherwise remote browsers cannot reach the media transport.
- Values are read once at import time; changing env requires a restart.
