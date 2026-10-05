"use client";

// Evergreen (pre-recorded, scheduled) webinar player.
//
// Renders INSTEAD of the live SFU room when a webinar has evergreen enabled —
// WebinarRoomClient branches to this before it would ever join mediasoup, so
// the live path stays byte-identical for every normal webinar.
//
// The whole illusion rests on one rule: position comes from the SERVER, never
// from this component. `positionSec` is computed as (now - sessionStart) on the
// backend, so two people who open the page ten minutes apart land on the same
// second of the video. See /public/webinar/:id/evergreen-state and
// docs/superpowers/specs/2026-09-07-evergreen-webinars-design.md.
//
// The chrome deliberately mirrors the live room (same shell, header card,
// #webinar-stage and right sidebar) so an attendee cannot tell the two apart.
// It is a copy rather than a shared import on purpose: the live room's header
// components read the mediasoup-backed webinar store (peers, socket status,
// role), none of which exists here, and reusing them would mean threading
// evergreen special-cases through the live path.

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, MessageSquare, Share2, X } from "lucide-react";
import { toast } from "sonner";
import FullscreenButton from "./FullscreenButton";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** How often we re-anchor to the server clock. */
const RESYNC_MS = 30_000;
/** How often playback is compared against the target position. */
const CONTROL_MS = 1_000;
/** Inside this, leave playback alone — correcting costs more than the skew. */
const IN_SYNC_SEC = 0.4;
/** Beyond this, trimming the rate would take too long — seek instead. */
const HARD_SEEK_SEC = 3;
/** Speed/slow by 3% to converge. Enough to close a second of drift in ~33s,
 *  small enough that neither the pitch shift nor the motion is noticeable. */
const RATE_TRIM = 0.03;

type Tab = "Chat" | "People";

interface ChatLine {
  atSec: number;
  name: string;
  message: string;
}

interface EvergreenState {
  enabled: boolean;
  status?: "upcoming" | "live" | "ended" | "unconfigured";
  serverNow?: number;
  sessionStart?: string;
  sessionEnd?: string;
  positionSec?: number;
  durationSec?: number;
  joinWindowClosed?: boolean;
  nextSessionAt?: string | null;
  videoUrl?: string;
  simulatedChat?: ChatLine[];
  simulatedViewers?: { enabled: boolean; peak?: number };
  /** Video repeats for the whole scheduled slot (the default). */
  loop?: boolean;
  /** Seconds since the session began — keeps counting across repeats. */
  elapsedSec?: number;
  message?: string;
}

/** How far BEHIND the target this player is, signed: positive = behind (speed
 *  up), negative = ahead (ease off). Measured the short way round a looping
 *  timeline, so 0:01 against 2:18 of a 2:19 video reads as 2s, not 137s —
 *  without that every wrap looks like a full-duration drift. */
function signedGap(target: number, current: number, dur: number, loop: boolean): number {
  let d = target - current;
  if (loop && dur > 0) {
    d = ((d % dur) + dur) % dur;
    if (d > dur / 2) d -= dur;
  }
  return d;
}

function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** Seeking before metadata has loaded is silently dropped, which is how a
 *  late joiner ends up watching from 0:00 instead of the live edge. */
function seekTo(v: HTMLVideoElement, t: number) {
  if (v.readyState >= 1) {
    v.currentTime = t;
    return;
  }
  const once = () => {
    v.currentTime = t;
    v.removeEventListener("loadedmetadata", once);
  };
  v.addEventListener("loadedmetadata", once);
}

/** Deterministic from the server's elapsed clock, so every viewer sees the
 *  same number rather than each browser inventing its own. */
function viewerCount(elapsed: number, peak: number): number {
  if (peak <= 0) return 0;
  // Ramp over the first five minutes, then drift within a few percent.
  const ramp = Math.min(1, elapsed / 300);
  const wobble = Math.sin(elapsed / 47) * 0.03 + Math.sin(elapsed / 13) * 0.015;
  return Math.max(1, Math.round(peak * ramp * (1 + wobble)));
}

function Centered({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-2 bg-[#282828] px-6 text-center">
      <p className="text-[18px] font-semibold text-white">{title}</p>
      {detail && <p className="text-[13px] text-white/50">{detail}</p>}
    </div>
  );
}

export default function EvergreenRoom({
  webinarId,
  title,
  sessionDate,
}: {
  webinarId: string;
  title?: string;
  /** Optional per-session link (YYYY-MM-DD), passed straight through. */
  sessionDate?: string;
}) {
  const [state, setState] = useState<EvergreenState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [position, setPosition] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("Chat");
  const [copied, setCopied] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  // The broadcast position as a CONTINUOUS function of time rather than a
  // 30-second-old snapshot: (position, wall-clock instant it was true). Every
  // device computes the same target from it, which is what actually makes two
  // phones show the same frame.
  const anchorRef = useRef<{ pos: number; at: number; dur: number; loop: boolean } | null>(null);
  // Where the broadcast is, advanced locally between resyncs. A ref so the
  // 1s tick can read and update it without re-subscribing every second.
  const liveEdgeRef = useRef(0);

  /** Where the video should be *right now*, from the anchor. */
  const targetNow = useCallback((): number | null => {
    const a = anchorRef.current;
    if (!a) return null;
    let t = a.pos + (Date.now() - a.at) / 1000;
    if (a.loop && a.dur > 0) t = ((t % a.dur) + a.dur) % a.dur;
    return t;
  }, []);

  const fetchState = useCallback(async (): Promise<EvergreenState | null> => {
    try {
      const qs = sessionDate ? `?sessionDate=${encodeURIComponent(sessionDate)}` : "";
      const sentAt = Date.now();
      const res = await fetch(`${API_URL}/public/webinar/${webinarId}/evergreen-state${qs}`);
      const data: EvergreenState = await res.json();
      const gotAt = Date.now();
      setState(data);
      setError(null);
      if (typeof data.positionSec === "number") {
        // The response describes where the video was when the server answered,
        // which is already half a round-trip old by the time it lands. Without
        // this every device sits behind by its own latency — a 400ms link and
        // a 40ms link would never agree.
        const oneWaySec = (gotAt - sentAt) / 2000;
        anchorRef.current = {
          pos: data.positionSec + oneWaySec,
          at: gotAt,
          dur: data.durationSec ?? 0,
          loop: !!data.loop,
        };
        liveEdgeRef.current = data.positionSec;
      }
      if (typeof data.elapsedSec === "number") setElapsed(data.elapsedSec);
      return data;
    } catch {
      setError("Couldn't reach the session. Retrying…");
      return null;
    }
  }, [webinarId, sessionDate]);

  useEffect(() => {
    fetchState();
    const id = setInterval(fetchState, RESYNC_MS);
    return () => clearInterval(id);
  }, [fetchState]);

  // The control loop. Every second it compares actual playback against the
  // target and closes the difference the cheapest way available:
  //
  //   < 0.4s   leave it — correcting is more visible than the skew
  //   < 3s     trim playbackRate 3% and let it converge, no stall
  //   >= 3s    seek, because trimming would take minutes
  //
  // Trimming rather than seeking is what allows tight sync at all: the old
  // code only had "seek", so the tolerance had to be loose (5s) to avoid
  // constant rebuffering, and two devices could legitimately sit 10s apart.
  useEffect(() => {
    if (state?.status !== "live") return;
    const dur = state.durationSec ?? 0;
    const looping = !!state.loop;
    const id = setInterval(() => {
      const v = videoRef.current;
      const target = targetNow();
      if (target !== null) {
        liveEdgeRef.current = target;
        setElapsed((e) => e + CONTROL_MS / 1000);
      }
      setPosition(v ? v.currentTime : liveEdgeRef.current);
      if (!v || !started) return;

      // A seek landing on the heels of play() can leave the element paused
      // (the play promise is rejected as "interrupted"), and nothing else
      // would ever start it again — the stage sits on one frame while this
      // clock keeps counting. Cheap to re-assert every second.
      if (v.paused && !v.ended) v.play().catch(() => {});

      // Never correct into a seek or a rebuffer already in progress; that
      // just queues another stall on top of the one happening.
      if (target === null || v.seeking || v.readyState < 3) return;

      const behind = signedGap(target, v.currentTime, dur, looping);
      const off = Math.abs(behind);
      if (off >= HARD_SEEK_SEC) {
        v.playbackRate = 1;
        seekTo(v, target);
      } else if (off > IN_SYNC_SEC) {
        v.playbackRate = behind > 0 ? 1 + RATE_TRIM : 1 - RATE_TRIM;
      } else if (v.playbackRate !== 1) {
        v.playbackRate = 1;
      }
    }, CONTROL_MS);
    return () => clearInterval(id);
  }, [state?.status, state?.loop, state?.durationSec, started, targetNow]);

  // Entry gesture. play() must be called SYNCHRONOUSLY here — awaiting the
  // state refresh first spends the user activation and the browser then
  // refuses to start an unmuted video, which is what left the stage black.
  // Seeking to the live edge happens after, once metadata exists.
  const join = () => {
    const v = videoRef.current;
    setStarted(true);
    if (!v) return;
    v.play()
      .catch(() => {
        // Autoplay policy still said no (common on iOS). Muted playback is
        // always allowed, so start there and offer to unmute.
        v.muted = true;
        setMuted(true);
        return v.play().catch(() => {});
      })
      .then(() => {
        // Re-anchor before seeking: the state in hand may be up to 30s old,
        // and landing on a stale position is exactly the desync being fixed.
        fetchState().then(() => {
          const target = targetNow();
          if (videoRef.current && target !== null) seekTo(videoRef.current, target);
        });
      });
  };

  const copyLink = () => {
    navigator.clipboard
      .writeText(`${window.location.origin}/webinar/${webinarId}`)
      .then(() => {
        setCopied(true);
        toast.success("Invite link copied!");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error("Couldn't copy the link"));
  };

  if (error && !state) return <Centered title="Reconnecting…" detail={error} />;
  if (!state) return <Centered title="Loading session…" />;

  if (!state.enabled) {
    // Should never render — the caller only mounts this for evergreen webinars.
    return <Centered title="This webinar isn't set up for scheduled playback." />;
  }
  if (state.status === "unconfigured") {
    return <Centered title="This session isn't ready yet" detail={state.message} />;
  }
  if (state.status === "upcoming") {
    const startsAt = state.sessionStart ? new Date(state.sessionStart) : null;
    return (
      <Centered
        title="This session hasn't started yet"
        detail={startsAt ? `Starts at ${startsAt.toLocaleString()}` : undefined}
      />
    );
  }
  if (state.status === "ended") {
    const next = state.nextSessionAt ? new Date(state.nextSessionAt) : null;
    return (
      <Centered
        title="This session has ended"
        detail={next ? `Next session: ${next.toLocaleString()}` : "Check back for the next session."}
      />
    );
  }

  const chat = (state.simulatedChat || []).filter((m) => m.atSec <= position);
  const peak = state.simulatedViewers?.enabled ? state.simulatedViewers.peak || 0 : 0;
  const viewers = viewerCount(elapsed, peak);
  const heading = title || "Live Stream";
  const initial = heading.trim().charAt(0).toUpperCase() || "?";

  // Same geometry as the live room's header pills, so they share a baseline.
  const TAG =
    "inline-flex h-5 items-center gap-1 rounded-full px-2 text-[10px] font-bold leading-none tracking-wide flex-shrink-0 border";
  const GLASS =
    "flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-xl backdrop-saturate-150 transition-all active:scale-95 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]";

  return (
    <div className="h-screen w-screen bg-[#282828] flex overflow-hidden">
      {/* ── Left column: scoped header + video stage ── */}
      <div className="flex-1 h-full flex flex-col min-w-0 overflow-hidden">
        <div className="px-3 pt-3 pb-2 shrink-0">
          <div className="min-h-14 rounded-2xl border border-white/10 bg-[#282828]/95 backdrop-blur-xl shadow-[0_8px_24px_-12px_rgba(0,0,0,0.9)] flex items-center px-4 py-2 gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-gradient-to-br from-white/25 to-white/5 border border-white/15 text-white text-sm font-semibold flex-shrink-0">
                {initial}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-white text-sm font-semibold leading-5 truncate max-w-[160px] sm:max-w-[280px]">
                    {heading}
                  </span>
                  <span className={`${TAG} bg-red-600/20 border-red-500/40 text-red-300`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    LIVE
                  </span>
                  <span
                    className={`${TAG} bg-white/[0.06] border-white/10 text-zinc-300 tabular-nums font-semibold`}
                    title="Session duration"
                  >
                    {fmtClock(elapsed)}
                  </span>
                </div>
                <span className="block text-[11px] text-zinc-400 truncate">
                  {peak > 0 ? `${viewers.toLocaleString()} watching` : "Live now"}
                </span>
              </div>
            </div>

            <div className="flex-1" />

            <button
              onClick={copyLink}
              title={copied ? "Invite link copied" : "Copy invite link"}
              aria-label={copied ? "Invite link copied" : "Share"}
              className={`${GLASS} ${
                copied
                  ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-300"
                  : "border-white/15 bg-white/10 text-white hover:bg-white/20 hover:border-white/25"
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            </button>

            {!sidebarOpen && (
              <button
                onClick={() => {
                  setActiveTab("Chat");
                  setSidebarOpen(true);
                }}
                title="Show chat"
                aria-label="Toggle Chat"
                className={`${GLASS} border-white/15 bg-white/10 text-white hover:bg-white/20 hover:border-white/25`}
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Video stage — same id the FullscreenButton scopes itself to. */}
        <div id="webinar-stage" className="flex-1 h-full relative overflow-hidden bg-[#181818]">
          {/* Always mounted and laid out. Hiding it until the join gesture
              (display:none) stopped the browser loading it at all, so the
              first play() had nothing buffered to start. */}
          <video
            ref={videoRef}
            src={state.videoUrl}
            className="absolute inset-0 h-full w-full object-contain"
            playsInline
            preload="auto"
            controls={false}
            loop={!!state.loop}
            onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
            // No seek clamp here. It existed to stop a viewer scrubbing ahead
            // of the broadcast, but `controls` is off and fullscreen is scoped
            // to the stage rather than the element, so there is no way to
            // scrub — every seek that reaches this element is one we issued
            // ourselves, and clamping them only fought the drift correction.
            onEnded={(e) => {
              // `loop` handles the normal wrap; this covers the browsers that
              // still fire `ended` on a looping element.
              const v = e.currentTarget;
              if (state.loop) {
                v.currentTime = 0;
                v.play().catch(() => {});
              }
            }}
          />

          {!started && (
            <button
              type="button"
              onClick={join}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/70 text-white"
            >
              <span className="rounded-full bg-brand px-6 py-2.5 text-[14px] font-semibold text-brand-foreground">
                Join session
              </span>
              <span className="text-[12px] text-white/60">Live now — you&apos;ll join in progress</span>
            </button>
          )}

          {started && muted && (
            <button
              type="button"
              onClick={() => {
                const v = videoRef.current;
                if (!v) return;
                v.muted = false;
                setMuted(false);
                v.play().catch(() => {});
              }}
              className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-brand px-4 py-2 text-[13px] font-semibold text-brand-foreground shadow-lg"
            >
              Tap to unmute
            </button>
          )}

          {started && (
            <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full bg-black/60 px-2.5 py-1">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-white">Live</span>
            </div>
          )}

          <FullscreenButton />
        </div>
      </div>

      {/* ── Right sidebar — same shell as the live room's ── */}
      {sidebarOpen && (
        <div className="w-80 sm:w-96 h-screen flex flex-col border-l border-white/10 bg-[#282828] shrink-0">
          <div className="flex border-b border-white/10 bg-[#282828] shrink-0">
            {(["Chat", "People"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                role="tab"
                aria-selected={activeTab === tab}
                className={`flex-1 min-w-0 truncate border-b-2 px-2 py-2.5 text-xs font-semibold relative transition-colors ${
                  activeTab === tab
                    ? "border-white text-white"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {tab === "People" && peak > 0 ? `People (${viewers.toLocaleString()})` : tab}
              </button>
            ))}
            <button
              onClick={() => setSidebarOpen(false)}
              className="px-2.5 text-zinc-500 hover:text-white transition-colors shrink-0"
              title="Close sidebar"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {activeTab === "Chat" ? (
              <div className="h-full space-y-3 overflow-y-auto p-4">
                {chat.length === 0 ? (
                  <p className="text-[12px] text-white/40">No messages yet.</p>
                ) : (
                  chat.map((m, i) => (
                    <div key={`${m.atSec}-${i}`} className="text-[13px] leading-snug">
                      <span className="font-semibold text-brand">{m.name}</span>
                      <span className="ml-2 text-white/80">{m.message}</span>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="h-full overflow-y-auto p-4">
                <p className="text-[13px] text-white/80">
                  {peak > 0
                    ? `${viewers.toLocaleString()} people watching`
                    : "Attendee list isn't shown for this session."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
