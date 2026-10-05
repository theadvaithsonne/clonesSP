// lib/content-tracker.ts
// Client-side engagement tracker for content pages.
// Accumulates metrics in memory and sends periodic heartbeats to the backend.
// Uses navigator.sendBeacon() on page exit to ensure the final update is never lost.

import { API_URL } from "./api";

// ── Types ──────────────────────────────────────────────────────────

export type ContentType = "video" | "drop" | "article" | "recording" | "testimonial";

export interface TrackerConfig {
  contentId: string;
  contentType: ContentType;
  orgId: string;
  contentTitle: string;
  affiliateId?: string | null;
  userId?: string | null;
  guestId?: string | null;
  duration?: number; // total content duration in seconds (for video types)
}

interface Interactions {
  plays: number;
  pauses: number;
  seeks: number;
  replays: number;
  mutes: number;
  unmutes: number;
  fullscreens: number;
  linkClicks: number;
}

interface SessionState {
  sessionId: string;
  totalWatchTime: number;
  totalReadTime: number;
  watchedRanges: [number, number][];
  completionPercent: number;
  maxPlaybackRate: number;
  scrollDepthMax: number;
  interactions: Interactions;
  isComplete: boolean;
  lastPlayStart: number | null; // timestamp when play started
  lastReadStart: number | null; // timestamp when reading started
}

// ── Helpers ────────────────────────────────────────────────────────

function generateSessionId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${ts}_${rand}`;
}

function detectDeviceType(): "mobile" | "tablet" | "desktop" | "unknown" {
  if (typeof window === "undefined") return "unknown";
  const w = window.innerWidth;
  if (w < 768) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

// Merge overlapping ranges for accurate watched-time calculation
function mergeRanges(ranges: [number, number][]): [number, number][] {
  if (ranges.length <= 1) return ranges;
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i][0] <= last[1]) {
      last[1] = Math.max(last[1], sorted[i][1]);
    } else {
      merged.push(sorted[i]);
    }
  }
  return merged;
}

// ── ContentTracker Class ───────────────────────────────────────────

export class ContentTracker {
  private config: TrackerConfig;
  private state: SessionState;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private currentRangeStart: number | null = null; // video position when play started
  private destroyed = false;

  static HEARTBEAT_MS = 30_000; // 30 seconds

  constructor(config: TrackerConfig) {
    this.config = config;
    this.state = {
      sessionId: generateSessionId(),
      totalWatchTime: 0,
      totalReadTime: 0,
      watchedRanges: [],
      completionPercent: 0,
      maxPlaybackRate: 1,
      scrollDepthMax: 0,
      interactions: {
        plays: 0, pauses: 0, seeks: 0, replays: 0,
        mutes: 0, unmutes: 0, fullscreens: 0, linkClicks: 0,
      },
      isComplete: false,
      lastPlayStart: null,
      lastReadStart: null,
    };

    // Start heartbeat
    this.heartbeatInterval = setInterval(() => this.flush(), ContentTracker.HEARTBEAT_MS);

    // Send final beacon on page exit
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", this.handleUnload);
      document.addEventListener("visibilitychange", this.handleVisibility);
    }
  }

  // ── Video/Drop/Recording events ──────────────────────────────

  onPlay(currentTime: number) {
    this.state.interactions.plays++;
    this.state.lastPlayStart = Date.now();
    this.currentRangeStart = currentTime;
  }

  onPause(currentTime: number) {
    this.state.interactions.pauses++;
    this.accumulateWatchTime(currentTime);
  }

  onSeek(_from: number, to: number) {
    this.state.interactions.seeks++;
    // If currently playing, close old range and start new
    if (this.state.lastPlayStart !== null && this.currentRangeStart !== null) {
      // Don't accumulate the seek gap — just record what was watched before seek
      const elapsed = (Date.now() - this.state.lastPlayStart) / 1000;
      const rangeEnd = this.currentRangeStart + elapsed;
      if (elapsed > 0.5) {
        this.state.watchedRanges.push([
          Math.round(this.currentRangeStart),
          Math.round(rangeEnd),
        ]);
        this.state.totalWatchTime += elapsed;
      }
      this.state.lastPlayStart = Date.now();
      this.currentRangeStart = to;
    }
  }

  onReplay() { this.state.interactions.replays++; }
  onMute() { this.state.interactions.mutes++; }
  onUnmute() { this.state.interactions.unmutes++; }
  onFullscreen() { this.state.interactions.fullscreens++; }

  onPlaybackRateChange(rate: number) {
    this.state.maxPlaybackRate = Math.max(this.state.maxPlaybackRate, rate);
  }

  onTimeUpdate(currentTime: number) {
    // Update completion based on duration
    if (this.config.duration && this.config.duration > 0) {
      const pct = Math.min(100, Math.round((currentTime / this.config.duration) * 100));
      this.state.completionPercent = Math.max(this.state.completionPercent, pct);
      if (pct >= 95) this.state.isComplete = true;
    }
  }

  onEnded() {
    this.state.isComplete = true;
    this.state.completionPercent = 100;
    // Close any open range
    if (this.config.duration) {
      this.accumulateWatchTime(this.config.duration);
    }
  }

  // ── Article events ───────────────────────────────────────────

  startReading() {
    this.state.lastReadStart = Date.now();
  }

  stopReading() {
    if (this.state.lastReadStart) {
      const elapsed = (Date.now() - this.state.lastReadStart) / 1000;
      this.state.totalReadTime += elapsed;
      this.state.lastReadStart = null;
    }
  }

  onScroll(depthPercent: number) {
    this.state.scrollDepthMax = Math.max(this.state.scrollDepthMax, Math.round(depthPercent));
    this.state.completionPercent = this.state.scrollDepthMax;
    if (depthPercent >= 95) this.state.isComplete = true;
  }

  onLinkClick() { this.state.interactions.linkClicks++; }

  // ── Internal ─────────────────────────────────────────────────

  private accumulateWatchTime(currentTime: number) {
    if (this.state.lastPlayStart !== null && this.currentRangeStart !== null) {
      const elapsed = (Date.now() - this.state.lastPlayStart) / 1000;
      if (elapsed > 0.5) {
        const rangeEnd = this.currentRangeStart + elapsed;
        this.state.watchedRanges.push([
          Math.round(this.currentRangeStart),
          Math.round(rangeEnd),
        ]);
        this.state.totalWatchTime += elapsed;
      }
      this.state.lastPlayStart = null;
      this.currentRangeStart = null;
    }
  }

  private buildPayload() {
    // If currently playing, accumulate time without closing the range
    let watchTime = this.state.totalWatchTime;
    let ranges = [...this.state.watchedRanges];
    if (this.state.lastPlayStart !== null && this.currentRangeStart !== null) {
      const elapsed = (Date.now() - this.state.lastPlayStart) / 1000;
      watchTime += elapsed;
      ranges.push([
        Math.round(this.currentRangeStart),
        Math.round(this.currentRangeStart + elapsed),
      ]);
    }

    // If currently reading, accumulate time
    let readTime = this.state.totalReadTime;
    if (this.state.lastReadStart) {
      readTime += (Date.now() - this.state.lastReadStart) / 1000;
    }

    return {
      sessionId: this.state.sessionId,
      contentId: this.config.contentId,
      contentType: this.config.contentType,
      orgId: this.config.orgId,
      affiliateId: this.config.affiliateId || null,
      userId: this.config.userId || null,
      guestId: this.config.guestId || null,
      totalWatchTime: Math.round(watchTime),
      watchedRanges: mergeRanges(ranges),
      completionPercent: this.state.completionPercent,
      maxPlaybackRate: this.state.maxPlaybackRate,
      totalReadTime: Math.round(readTime),
      scrollDepthMax: this.state.scrollDepthMax,
      interactions: { ...this.state.interactions },
      deviceType: detectDeviceType(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : "",
      referrerUrl: typeof document !== "undefined" ? document.referrer.slice(0, 2000) : "",
      contentTitle: this.config.contentTitle.slice(0, 300),
      isComplete: this.state.isComplete,
    };
  }

  /** Send accumulated data to the backend */
  flush() {
    if (this.destroyed) return;
    const payload = this.buildPayload();
    // Fire-and-forget fetch
    fetch(`${API_URL}/content-engagement/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {}); // Silently ignore errors
  }

  /** Cleanup: remove listeners, clear interval, send final beacon */
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Final flush via sendBeacon (survives page unload)
    this.sendBeacon();

    if (typeof window !== "undefined") {
      window.removeEventListener("beforeunload", this.handleUnload);
      document.removeEventListener("visibilitychange", this.handleVisibility);
    }
  }

  private sendBeacon() {
    const payload = this.buildPayload();
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(
        `${API_URL}/content-engagement/ingest`,
        new Blob([JSON.stringify(payload)], { type: "application/json" })
      );
    } else {
      // Fallback: fire-and-forget fetch
      fetch(`${API_URL}/content-engagement/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  }

  private handleUnload = () => {
    this.sendBeacon();
  };

  private handleVisibility = () => {
    if (document.hidden) {
      // Tab became hidden — flush
      this.flush();
    }
  };
}
