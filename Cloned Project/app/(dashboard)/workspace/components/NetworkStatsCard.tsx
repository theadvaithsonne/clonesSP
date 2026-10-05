"use client";

import { memo, useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { api, API_URL } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { Building2, Radio, ExternalLink, X, VolumeX, Volume2, Users } from "lucide-react";
import { Room, RoomEvent, Track } from "livekit-client";
import { useWebinarLivePreview } from "@/hooks/useWebinarLivePreview";

const DEFAULT_BRAND = "#eab308";

interface NetworkStats {
  businessNetwork: number;
  customers: number;
  affiliates: number;
  stakeholders: number;
}

/** Hex → rgba helper */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Darken a hex color by mixing with black */
function darkenHex(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.substring(0, 2), 16) * (1 - amount));
  const g = Math.round(parseInt(h.substring(2, 4), 16) * (1 - amount));
  const b = Math.round(parseInt(h.substring(4, 6), 16) * (1 - amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/* ── Animated counter ─────────────────────────────────────── */
function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const end = value;
    const startTime = performance.now();
    const duration = 1400;

    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(end * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

/* ── Decorative arc ring ──────────────────────────────────── */
function ArcRing({ size = 96, stroke = 2.5, progress = 0.72, color }: {
  size?: number;
  stroke?: number;
  progress?: number;
  color: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-white/[0.04]" />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="url(#arc-grad)" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - progress) }}
        transition={{ duration: 1.6, ease: "easeOut", delay: 0.25 }}
      />
      <defs>
        <linearGradient id="arc-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={darkenHex(color, 0.3)} stopOpacity={0.4} />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Floating particles ───────────────────────────────────── */
function Particles({ color }: { color: string }) {
  return (
    <>
      {[
        { x: "18%", y: "22%", delay: 0, size: 3 },
        { x: "78%", y: "30%", delay: 1.2, size: 2 },
        { x: "62%", y: "72%", delay: 0.6, size: 2.5 },
        { x: "35%", y: "80%", delay: 1.8, size: 2 },
        { x: "88%", y: "60%", delay: 0.4, size: 1.5 },
      ].map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: p.x, top: p.y, width: p.size, height: p.size,
            backgroundColor: hexToRgba(color, 0.2),
          }}
          animate={{ opacity: [0.15, 0.5, 0.15], scale: [1, 1.6, 1] }}
          transition={{ duration: 3.5, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
        />
      ))}
    </>
  );
}

/* ── Network graph ────────────────────────────────────────── */
const HUB = { x: 100, y: 50 };

const ENDPOINTS = [
  { x: 40, y: -10, r: 2, delay: 0.08 },
  { x: 90, y: -10, r: 2.5, delay: 0.14 },
  { x: 145, y: -10, r: 2, delay: 0.2 },
  { x: 200, y: -10, r: 2.5, delay: 0.11 },
  { x: 210, y: 12, r: 2, delay: 0.16 },
  { x: 210, y: 38, r: 2.5, delay: 0.22 },
  { x: 210, y: 62, r: 2.5, delay: 0.24 },
  { x: 210, y: 88, r: 2, delay: 0.28 },
  { x: 200, y: 110, r: 2.5, delay: 0.13 },
  { x: 145, y: 110, r: 2, delay: 0.26 },
  { x: 90, y: 110, r: 2.5, delay: 0.18 },
  { x: 40, y: 110, r: 2, delay: 0.3 },
];

const PARTICLE_TARGETS = [0, 3, 5, 7, 9, 11];

function NetworkGraph({ color }: { color: string }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 200 100" fill="none" className="opacity-55">
      <defs>
        <radialGradient id="hub-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity={0.45} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
        <linearGradient id="line-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0.08} />
        </linearGradient>
      </defs>

      {ENDPOINTS.map((ep, i) => (
        <motion.line
          key={`l-${i}`} x1={HUB.x} y1={HUB.y} x2={ep.x} y2={ep.y}
          stroke="url(#line-fade)" strokeWidth={0.7}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.3 + i * 0.045, ease: "easeOut" }}
        />
      ))}

      {PARTICLE_TARGETS.map((ti, i) => {
        const ep = ENDPOINTS[ti];
        return (
          <motion.circle
            key={`p-${i}`} r={1.4} fill={color}
            initial={{ cx: HUB.x, cy: HUB.y, opacity: 0 }}
            animate={{ cx: [HUB.x, ep.x], cy: [HUB.y, ep.y], opacity: [0, 0.75, 0] }}
            transition={{ duration: 2.2 + i * 0.25, repeat: Infinity, delay: 1 + i * 0.45, ease: "easeInOut" }}
          />
        );
      })}

      {ENDPOINTS.map((ep, i) => (
        <motion.circle
          key={`n-${i}`} cx={ep.x} cy={ep.y} r={ep.r} fill={color} fillOpacity={0.3}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.5 + ep.delay, ease: "backOut" }}
        />
      ))}

      <motion.circle cx={HUB.x} cy={HUB.y} r={10} fill="url(#hub-glow)"
        animate={{ opacity: [0.35, 0.6, 0.35] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.circle cx={HUB.x} cy={HUB.y} r={3} fill={color} fillOpacity={0.85}
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ duration: 0.4, delay: 0.15, ease: "backOut" }}
      />
      <motion.circle cx={HUB.x} cy={HUB.y} r={3} fill="none" stroke={color} strokeWidth={0.5}
        animate={{ r: [3, 18], opacity: [0.3, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeOut" }}
      />
      <motion.circle cx={HUB.x} cy={HUB.y} r={3} fill="none" stroke={color} strokeWidth={0.3}
        animate={{ r: [3, 18], opacity: [0.2, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeOut", delay: 1.5 }}
      />
    </svg>
  );
}

/* ── Live preview video inside card ──────────────────────── */
function CardLivePreview({ workshopId, muted }: { workshopId: string; muted: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const roomRef = useRef<Room | null>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        const res = await fetch(`${API_URL}/workshop-preview/audience-token`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workshopId }),
        });
        const data = await res.json();
        if (!data.success || cancelled) return;

        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        const update = () => {
          if (cancelled) return;
          let vTrack: MediaStreamTrack | null = null;
          const aTracks: MediaStreamTrack[] = [];
          room.remoteParticipants.forEach((p) => {
            if (!vTrack) {
              const s = p.getTrackPublication(Track.Source.ScreenShare)?.track?.mediaStreamTrack;
              const c = p.getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack;
              vTrack = s || c || null;
            }
            const mic = p.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack;
            const sa = p.getTrackPublication(Track.Source.ScreenShareAudio)?.track?.mediaStreamTrack;
            if (mic) aTracks.push(mic);
            if (sa) aTracks.push(sa);
          });
          if (videoRef.current) videoRef.current.srcObject = vTrack ? new MediaStream([vTrack]) : null;
          setHasVideo(!!vTrack);
          if (audioRef.current) audioRef.current.srcObject = aTracks.length ? new MediaStream(aTracks) : null;
        };

        room.on(RoomEvent.TrackSubscribed, update);
        room.on(RoomEvent.TrackUnsubscribed, update);
        room.on(RoomEvent.ParticipantDisconnected, update);

        await room.connect(data.serverUrl, data.token);
        if (!cancelled) update();
      } catch {}
    }

    connect();
    return () => {
      cancelled = true;
      if (roomRef.current) {
        try { roomRef.current.disconnect(true); } catch {}
        roomRef.current = null;
      }
    };
  }, [workshopId]);

  // muted attribute on <audio> lets browser autoplay it silently from the start.
  // Toggling .muted via ref is all that's needed — no .play() call required.
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  return (
    <>
      <video ref={videoRef} autoPlay muted playsInline
        className={`absolute inset-0 w-full h-full object-cover ${hasVideo ? "block" : "hidden"}`}
      />
      <audio ref={audioRef} autoPlay muted />
    </>
  );
}

/* ── Main component ───────────────────────────────────────── */
export const NetworkStatsCard = memo(({ orgId }: { orgId: string }) => {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [orgIcon, setOrgIcon] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState<string>(DEFAULT_BRAND);
  const [loading, setLoading] = useState(true);
  const { webinar, markJoined, refetch } = useWebinarLivePreview();
  const [cardDismissed, setCardDismissed] = useState(false);
  useEffect(() => { setCardDismissed(false); }, [webinar?.workshopId]);
  const isLive = !!webinar && !cardDismissed;
  const [isMuted, setIsMuted] = useState(true);

  // Emit preview-watcher presence so the host's participant list sees us.
  // After emitting, re-fetch after a short delay so the viewer count in the
  // card reflects the newly registered preview watcher without waiting 30 s.
  useEffect(() => {
    if (!isLive || !webinar?.workshopId) return;
    const sock = getSocket();
    if (!sock) return;
    const wid = webinar.workshopId;
    sock.emit("webinar:previewWatch", { webinarId: wid });
    const timer = setTimeout(() => { refetch(); }, 400);
    return () => {
      clearTimeout(timer);
      sock.emit("webinar:previewLeave", { webinarId: wid });
    };
  }, [isLive, webinar?.workshopId, refetch]);

  useEffect(() => {
    if (!orgId) return;

    const fetchData = async () => {
      try {
        const [statsRes, meRes, brandingRes] = await Promise.all([
          api<{ success: boolean; stats: NetworkStats }>(
            `/team/network-stats?orgId=${orgId}`
          ),
          api<{
            user: {
              organizations: Array<{ id: string; name: string; icon?: string }>;
            };
          }>("/auth/me").catch(() => null),
          api<{ branding?: { primaryColor?: string } }>(
            `/org/${orgId}/branding`
          ).catch(() => null),
        ]);

        if (statsRes.success) setStats(statsRes.stats);

        const currentOrg = meRes?.user?.organizations?.find(
          (o) => o.id === orgId
        );
        if (currentOrg?.icon) setOrgIcon(currentOrg.icon);

        const fetched = brandingRes?.branding?.primaryColor;
        if (fetched) setBrandColor(fetched);
      } catch (error) {
        console.error("Failed to fetch network stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orgId]);

  const c = brandColor; // shorthand
  const networkCount = stats?.businessNetwork ?? 0;

  if (loading) {
    return (
      <div className="w-full mb-6">
        <div className="h-[120px] rounded-2xl bg-white/[0.02] animate-pulse border border-white/[0.04]" />
      </div>
    );
  }

  return (
    <div className="w-full mb-6">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl backdrop-blur-xl"
        style={{
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: hexToRgba(c, 0.12),
          backgroundColor: "rgba(14,14,18,0.85)",
        }}
      >
        {/* ── background layers ────────────────────────── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(135deg, ${hexToRgba(c, 0.08)} 0%, transparent 50%, ${hexToRgba(darkenHex(c, 0.4), 0.06)} 100%)`,
          }}
        />
        <div
          className="absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl pointer-events-none"
          style={{ backgroundColor: hexToRgba(c, 0.04) }}
        />
        <div
          className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full blur-3xl pointer-events-none"
          style={{ backgroundColor: hexToRgba(c, 0.03) }}
        />

        {/* subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <Particles color={c} />

        {/* ── content ──────────────────────────────────── */}
        <div className="relative flex items-center gap-6 px-6 py-5">
          {/* Ring + HQ logo */}
          <div className="relative shrink-0 w-[96px] h-[96px] flex items-center justify-center">
            <ArcRing size={96} stroke={2.5} progress={0.72} color={c} />

            <div
              className="absolute inset-[14px] rounded-full"
              style={{
                background: `radial-gradient(circle, ${hexToRgba(c, 0.08)} 0%, transparent 70%)`,
              }}
            />

            {/* HQ logo or fallback */}
            <div
              className="relative z-10 w-[44px] h-[44px] rounded-2xl overflow-hidden flex items-center justify-center"
              style={{
                backgroundColor: hexToRgba(c, 0.1),
                border: `1px solid ${hexToRgba(c, 0.15)}`,
                boxShadow: `0 0 20px ${hexToRgba(c, 0.08)}`,
              }}
            >
              {orgIcon ? (
                <img src={orgIcon} alt="HQ" className="w-full h-full object-cover" />
              ) : (
                <Building2 size={20} style={{ color: c }} />
              )}
            </div>
          </div>

          {/* Text block */}
          <div className="min-w-0 flex-1">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-2"
              style={{ color: hexToRgba(c, 0.4) }}
            >
              Business Network
            </p>
            <div className="flex items-baseline gap-3">
              <p className="text-5xl font-bold text-white tracking-tight leading-none">
                <AnimatedNumber value={networkCount} />
              </p>
              <span
                className="text-[14px] font-medium"
                style={{ color: hexToRgba(c, 0.3), fontWeight: 700 }}
              >
                Connections
              </span>
            </div>
          </div>

          {/* Network graph OR live preview */}
          <div className="hidden md:block relative shrink-0 w-[220px] h-[110px] -my-5 -mr-6 overflow-hidden">
            {isLive ? (
              <div className="relative w-full h-full bg-black group">
                <CardLivePreview workshopId={webinar.workshopId} muted={isMuted} />

                {/* Join click layer — sits between video and buttons */}
                <div
                  className="absolute inset-0 z-[11] cursor-pointer"
                  onClick={() => {
                    window.open(`/webinar/${webinar.workshopId}?role=attendee`, "_blank", "noopener,noreferrer");
                    markJoined(webinar.workshopId);
                    setCardDismissed(true);
                  }}
                />

                {/* Hover hint — decorative only */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 z-[11] pointer-events-none">
                  <ExternalLink className="w-4 h-4 text-white" />
                  <span className="text-white text-xs font-medium">Join</span>
                </div>

                {/* Controls — above the join layer, no stopPropagation needed */}
                <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded z-[12]">
                  <Radio className="w-2 h-2 animate-pulse" />
                  LIVE
                </div>
                <button
                  onClick={() => setCardDismissed(true)}
                  className="absolute top-1.5 right-1.5 z-[12] bg-black/60 rounded p-0.5 text-white/70 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="absolute bottom-1.5 right-1.5 z-[12] flex items-center gap-1">
                  <div className="flex items-center gap-0.5 bg-black/70 rounded px-1.5 py-0.5 text-white/60 text-[9px] font-medium">
                    <Users className="w-2.5 h-2.5" />
                    <span>{webinar.viewerCount}</span>
                  </div>
                  <button
                    onClick={() => setIsMuted(m => !m)}
                    className="bg-black/70 rounded-full p-1 text-white/80 hover:text-white"
                  >
                    {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            ) : (
              <NetworkGraph color={c} />
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
});

NetworkStatsCard.displayName = "NetworkStatsCard";
