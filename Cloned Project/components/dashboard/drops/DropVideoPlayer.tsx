"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";

interface DropVideoPlayerProps {
  streamUrl: string;
  videoUrl?: string;
  sourceType: "upload" | "link";
  thumbnailUrl?: string;
  isActive: boolean;
  isNext: boolean;
  onViewCounted?: () => void;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function extractVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}

export default function DropVideoPlayer({
  streamUrl,
  videoUrl,
  sourceType,
  thumbnailUrl,
  isActive,
  isNext,
  onViewCounted,
}: DropVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const viewCountedRef = useRef(false);
  const watchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkUrl = videoUrl || streamUrl || "";
  const youtubeId = extractYouTubeId(checkUrl);
  const vimeoId = extractVimeoId(checkUrl);
  const isEmbed = !!(youtubeId || vimeoId);

  // ─── YouTube postMessage helpers ──────────────────────
  const ytCommand = useCallback((func: string, args?: any[]) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      JSON.stringify({ event: "command", func, args: args || [] }),
      "*"
    );
  }, []);

  // IntersectionObserver to only play when container is actually visible in viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        threshold: 0.6,
      }
    );
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, []);

  // ─── Native video play/pause lifecycle ─────────────────
  // Captures the video element at effect-creation time so cleanups
  // always operate on the correct (old) DOM node even after key-changes.
  useEffect(() => {
    if (isEmbed) return;
    const video = videoRef.current;
    if (!video) return;

    const shouldPlay = isActive && isIntersecting && !isPaused;

    if (shouldPlay) {
      video.preload = "auto";
      if (!isPaused) {
        // Helper: attempt play with muted fallback for autoplay policy
        const attemptPlay = () => {
          const p = video.play();
          if (p) p.catch(() => { video.muted = true; setIsMuted(true); video.play().catch(() => {}); });
        };

        // If the video has enough data, play immediately.
        // Otherwise wait for canplay (critical for the first drop which
        // hasn't been preloaded as isNext).
        if (video.readyState >= 3) {
          attemptPlay();
        } else {
          video.addEventListener("canplay", attemptPlay, { once: true });
        }
      }
      if (!viewCountedRef.current && onViewCounted) {
        watchTimerRef.current = setTimeout(() => { viewCountedRef.current = true; onViewCounted(); }, 3000);
      }
    } else if (isNext) {
      video.preload = "auto";
      video.pause();
    } else {
      video.preload = "metadata";
      video.pause();
      if (!isActive) {
        video.currentTime = 0;
      }
    }

    return () => {
      if (watchTimerRef.current) clearTimeout(watchTimerRef.current);
    };
  }, [isActive, isPaused, isEmbed, onViewCounted, isNext, isIntersecting]);

  // Reset loading state when this slide becomes inactive
  useEffect(() => {
    if (!isActive) {
      setIsLoading(true);
    }
  }, [isActive]);

  // ─── Embed lifecycle ──────────────────────────────────
  useEffect(() => {
    if (!isEmbed) return;

    const shouldPlay = isActive && isIntersecting && !isPaused;

    if (shouldPlay) {
      ytCommand("playVideo");
    } else {
      ytCommand("pauseVideo");
    }
  }, [isActive, isPaused, isEmbed, ytCommand, isIntersecting]);

  // Mute/unmute for embeds
  useEffect(() => {
    if (!isEmbed || !isActive || !isIntersecting) return;
    ytCommand(isMuted ? "mute" : "unMute");
  }, [isMuted, isEmbed, isActive, isIntersecting, ytCommand]);

  // Embed view tracking
  useEffect(() => {
    if (!isEmbed || !isActive || !isIntersecting) return;
    if (!viewCountedRef.current && onViewCounted) {
      const t = setTimeout(() => { viewCountedRef.current = true; onViewCounted(); }, 3000);
      return () => clearTimeout(t);
    }
  }, [isEmbed, isActive, isIntersecting, onViewCounted]);

  // Embed progress polling via YT API listener
  useEffect(() => {
    if (!isEmbed || !isActive || !isIntersecting) return;

    let startTime = Date.now();
    const estimatedDuration = 60;

    progressTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const pct = Math.min((elapsed % estimatedDuration) / estimatedDuration * 100, 100);
      setProgress(pct);
    }, 250);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      setProgress(0);
    };
  }, [isEmbed, isActive, isIntersecting]);

  // ─── Component-level cleanup (unmount only) ────────────
  // Only runs when the entire component unmounts, NOT on prop changes.
  useEffect(() => {
    return () => {
      const v = videoRef.current;
      if (v) { v.pause(); }
    };
  }, []);

  // Native progress tracking
  useEffect(() => {
    if (isEmbed) return;
    const video = videoRef.current;
    if (!video || !isActive) return;
    const h = () => { if (video.duration > 0) setProgress((video.currentTime / video.duration) * 100); };
    video.addEventListener("timeupdate", h);
    return () => video.removeEventListener("timeupdate", h);
  }, [isActive, isEmbed]);

  const togglePlay = useCallback(() => {
    if (isEmbed) {
      setIsPaused((p) => !p);
      setShowPlayIcon(true);
      setTimeout(() => setShowPlayIcon(false), 600);
      return;
    }
    const v = videoRef.current;
    if (!v || !isActive) return;
    if (v.paused) { v.play().catch(() => {}); setIsPaused(false); }
    else { v.pause(); setIsPaused(true); }
    setShowPlayIcon(true);
    setTimeout(() => setShowPlayIcon(false), 600);
  }, [isActive, isEmbed]);

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEmbed) {
      setIsMuted((m) => !m);
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  }, [isEmbed]);

  // ─── Shared overlay UI ────────────────────────────────
  const renderOverlay = () => (
    <>
      {/* Loading spinner */}
      {isLoading && isActive && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)", zIndex: 9, pointerEvents: "none" }}>
          <Loader2 className="w-10 h-10 text-brand animate-spin" />
        </div>
      )}

      {/* Play/Pause flash icon */}
      {showPlayIcon && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none", animation: "dropPlayFade 0.6s ease-out forwards", zIndex: 8 }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
            {isPaused ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            )}
          </div>
        </div>
      )}

      {/* Mute button */}
      <button onClick={toggleMute} style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.45)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(4px)", zIndex: 8 }}>
        {isMuted ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
        )}
      </button>

      {/* Yellow progress bar */}
      {isActive && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.15)", zIndex: 8 }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "var(--brand)", transition: "width 0.25s linear", borderRadius: 2 }} />
        </div>
      )}
    </>
  );

  // ─── YouTube / Vimeo Embed ────────────────────────────
  if (isEmbed) {
    let embedSrc = "";
    if (youtubeId) {
      // controls=0 hides YouTube's native red UI, we overlay our own
      embedSrc = `https://www.youtube.com/embed/${youtubeId}?autoplay=${isActive ? 1 : 0}&mute=${isMuted ? 1 : 0}&loop=1&playlist=${youtubeId}&controls=0&showinfo=0&modestbranding=1&rel=0&playsinline=1&enablejsapi=1&fs=0&iv_load_policy=3&disablekb=1`;
    } else if (vimeoId) {
      embedSrc = `https://player.vimeo.com/video/${vimeoId}?autoplay=${isActive ? 1 : 0}&muted=${isMuted ? 1 : 0}&loop=1&playsinline=1&controls=0&background=0`;
    }

    return (
      <div
        ref={containerRef}
        onClick={() => togglePlay()}
        style={{
          position: "absolute", inset: 0, background: "#000",
          cursor: "pointer", overflow: "hidden",
        }}
      >
        {(isActive || isNext) ? (
          <iframe
            ref={iframeRef}
            key={`${youtubeId || vimeoId}-${isActive}`}
            src={embedSrc}
            allow="autoplay; encrypted-media; picture-in-picture"
            onLoad={() => setIsLoading(false)}
            style={{
              position: "absolute",
              top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: "100%", height: "100%",
              minWidth: "177.78vh", minHeight: "56.25vw",
              border: "none",
              pointerEvents: "none", // Our overlay handles all clicks
            }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", backgroundImage: thumbnailUrl ? `url(${thumbnailUrl})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }} />
        )}

        {/* Our custom overlay — same look as native videos */}
        {renderOverlay()}
      </div>
    );
  }

  // ─── Native Video ─────────────────────────────────────
  return (
    <div ref={containerRef} onClick={() => togglePlay()} style={{ position: "absolute", inset: 0, background: "#000", cursor: "pointer", overflow: "hidden" }}>
      <video
        ref={videoRef}
        src={streamUrl}
        poster={thumbnailUrl}
        loop muted={isMuted} playsInline
        preload={isActive ? "auto" : isNext ? "auto" : "metadata"}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        onCanPlay={() => setIsLoading(false)}
        onSeeked={() => setIsLoading(false)}
        onLoadedData={() => setIsLoading(false)}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      {renderOverlay()}
    </div>
  );
}
