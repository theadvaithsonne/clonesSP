"use client";

import React, { useRef, useState, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Loader2, RotateCcw, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomVideoPlayerProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  className?: string;
  onEnded?: () => void;
  id?: string;
  /** Playhead position in seconds. Lets a sibling (e.g. chat replay) sync. */
  onTimeUpdate?: (seconds: number) => void;
}

function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
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

function extractVimeoId(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}

export default function CustomVideoPlayer({
  src,
  poster,
  autoPlay = true,
  className,
  onEnded,
  id,
  onTimeUpdate: onTimeUpdateProp,
}: CustomVideoPlayerProps) {
  const youtubeId = extractYouTubeId(src);
  const vimeoId = extractVimeoId(src);

  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(!!src);
  const [playbackRate, setPlaybackRate] = useState(1);

  const changePlaybackRate = (rate: number) => {
    if (youtubeId) {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "setPlaybackRate", args: [rate] }),
        "*"
      );
    } else {
      const video = videoRef.current;
      if (video) video.playbackRate = rate;
    }
    setPlaybackRate(rate);
  };

  const handlePlaybackRateCycle = () => {
    let nextRate = 1;
    if (playbackRate === 1) nextRate = 1.25;
    else if (playbackRate === 1.25) nextRate = 1.5;
    else if (playbackRate === 1.5) nextRate = 2;
    else if (playbackRate === 2) nextRate = 0.75;
    else nextRate = 1;
    
    changePlaybackRate(nextRate);
  };

  // YouTube helper message senders
  const ytPlay = () => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "playVideo" }),
      "*"
    );
  };
  const ytPause = () => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "pauseVideo" }),
      "*"
    );
  };
  const ytMute = () => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "mute" }),
      "*"
    );
  };
  const ytUnmute = () => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "unmute" }),
      "*"
    );
  };
  const ytSeek = (seconds: number) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "seekTo", args: [seconds, true] }),
      "*"
    );
  };

  // Sync state with iframe for YouTube embed links
  useEffect(() => {
    if (!youtubeId) return;

    setIsLoading(true);

    const handleYTMessage = (e: MessageEvent) => {
      if (!e.origin.includes("youtube.com")) return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data.info) {
          setIsLoading(false);
          if (data.info.duration !== undefined && data.info.duration > 0) {
            setDuration(data.info.duration);
          }
          if (data.info.currentTime !== undefined) {
            setCurrentTime(data.info.currentTime);
          }
          if (data.info.playerState !== undefined) {
            // 1 = playing, 2 = paused, 0 = ended
            setIsPlaying(data.info.playerState === 1);
            if (data.info.playerState === 0 && onEnded) {
              onEnded();
            }
          }
        }
      } catch (err) {}
    };

    window.addEventListener("message", handleYTMessage);
    return () => {
      window.removeEventListener("message", handleYTMessage);
    };
  }, [youtubeId, onEnded]);

  // Periodic time polling & listening checks for YouTube
  useEffect(() => {
    if (!youtubeId) return;

    // Send listening message on mount/change
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "listening" }),
      "*"
    );

    const interval = setInterval(() => {
      // Keep sending listening in case connection was missed
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "listening" }),
        "*"
      );
      if (isPlaying) {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: "command", func: "getCurrentTime" }),
          "*"
        );
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: "command", func: "getDuration" }),
          "*"
        );
      }
    }, 500);

    return () => clearInterval(interval);
  }, [youtubeId, isPlaying]);

  const handleIframeLoad = () => {
    setIsLoading(false);
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "listening" }),
      "*"
    );
  };

  // Hide controls after 2.5 seconds of inactivity when playing
  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      return;
    }
    const handleMouseMove = () => {
      setShowControls(true);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("mousemove", handleMouseMove);
    }

    const timeout = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 2500);

    return () => {
      if (container) {
        container.removeEventListener("mousemove", handleMouseMove);
      }
      clearTimeout(timeout);
    };
  }, [isPlaying, showControls]);

  // Sync state with HTMLVideoElement
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsLoading(!!src);

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      onTimeUpdateProp?.(video.currentTime);
    };
    const onDurationChange = () => setDuration(video.duration);
    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => setIsLoading(false);
    const onLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
    };
    const onError = () => {
      console.error("Video element failed to load source:", video.error);
      setIsLoading(false);
    };

    const startPlay = async () => {
      try {
        await video.play();
      } catch (err) {
        // Autoplay blocked by browser policy, try muted
        video.muted = true;
        setIsMuted(true);
        try {
          await video.play();
        } catch (e) {
          console.warn("Muted autoplay blocked too:", e);
        }
      }
    };

    // Sync initial state if the video is already loaded or playing
    setIsPlaying(!video.paused);
    setCurrentTime(video.currentTime);
    if (!isNaN(video.duration) && video.duration > 0) {
      setDuration(video.duration);
    }

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("error", onError);

    if (autoPlay) {
      if (video.readyState >= 3) {
        startPlay();
      } else {
        video.addEventListener("canplay", startPlay, { once: true });
      }
    }

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("error", onError);
      video.removeEventListener("canplay", startPlay);
    };
  }, [src, autoPlay]);

  const togglePlay = () => {
    if (youtubeId) {
      if (isPlaying) {
        ytPause();
        setIsPlaying(false);
      } else {
        ytPlay();
        setIsPlaying(true);
      }
    } else {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  };

  const toggleMute = () => {
    if (youtubeId) {
      if (isMuted) {
        ytUnmute();
        setIsMuted(false);
      } else {
        ytMute();
        setIsMuted(true);
      }
    } else {
      const video = videoRef.current;
      if (!video) return;
      video.muted = !video.muted;
      setIsMuted(video.muted);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSkipForward = () => {
    const targetTime = Math.min(duration || Infinity, currentTime + 5);
    if (youtubeId) {
      ytSeek(targetTime);
      setCurrentTime(targetTime);
    } else {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const handleSkipBackward = () => {
    const targetTime = Math.max(0, currentTime - 5);
    if (youtubeId) {
      ytSeek(targetTime);
      setCurrentTime(targetTime);
    } else {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (youtubeId) {
      ytSeek(newTime);
      setCurrentTime(newTime);
    } else {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(console.error);
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(console.error);
    }
  };

  // Keep track of fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full h-full flex flex-col bg-[#0a0a0d] overflow-hidden select-none",
        className
      )}
    >
      {/* Video Content Area */}
      <div
        onClick={togglePlay}
        className="flex-1 relative w-full overflow-hidden flex items-center justify-center cursor-pointer"
      >
        {youtubeId ? (
          <iframe
            ref={iframeRef}
            src={`https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&controls=0&rel=0&autoplay=${autoPlay ? 1 : 0}&mute=${isMuted ? 1 : 0}`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            onLoad={handleIframeLoad}
            className="w-full h-full border-none pointer-events-none"
          />
        ) : vimeoId ? (
          <iframe
            src={`https://player.vimeo.com/video/${vimeoId}?autoplay=${autoPlay ? 1 : 0}&controls=1`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            onLoad={handleIframeLoad}
            className="w-full h-full border-none"
          />
        ) : (
          <video
            ref={videoRef}
            key={src}
            id={id}
            src={src}
            poster={poster}
            className="w-full h-full object-contain"
            playsInline
            preload="auto"
          />
        )}

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
            <Loader2 className="w-10 h-10 text-brand animate-spin" />
          </div>
        )}
      </div>

      {/* Custom Controls Bar (Outside below video content) */}
      <div
        className="w-full p-4 bg-[#0e0e12] border-t border-[#2a2a35]/60 flex items-center gap-4 select-none shrink-0"
      >
        {/* Skip Backward 5s */}
        <button
          onClick={handleSkipBackward}
          className="text-white hover:text-brand transition-colors shrink-0 flex items-center justify-center gap-0.5 p-1 rounded hover:bg-white/10"
          title="Skip backward 5 seconds (-5s)"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="text-[10px] font-bold">5s</span>
        </button>

        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          className="text-white hover:text-brand transition-colors shrink-0 p-1"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 fill-none" />
          ) : (
            <Play className="w-5 h-5 fill-none" />
          )}
        </button>

        {/* Skip Forward 5s */}
        <button
          onClick={handleSkipForward}
          className="text-white hover:text-brand transition-colors shrink-0 flex items-center justify-center gap-0.5 p-1 rounded hover:bg-white/10"
          title="Skip forward 5 seconds (+5s)"
        >
          <RotateCw className="w-4 h-4" />
          <span className="text-[10px] font-bold">5s</span>
        </button>

        {/* Progress Bar Line */}
        <div className="relative flex-1 flex items-center group/progress h-5 cursor-pointer min-w-0">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleProgressChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
          />
          {/* Track background */}
          <div className="w-full h-1 bg-white/20 rounded-full group-hover/progress:h-1.5 transition-all" />
          {/* Played progress */}
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-brand rounded-full pointer-events-none group-hover/progress:h-1.5 transition-all"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
          {/* White Thumb handle pill */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-3.5 rounded-full bg-white shadow-lg pointer-events-none"
            style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>

        {/* Time Layout */}
        <span className="text-xs font-medium tracking-tight text-white/80 shrink-0 select-none">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* Mute/Volume Button */}
        <button
          onClick={toggleMute}
          className="text-white hover:text-brand transition-colors shrink-0"
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </button>

        {/* Speed Selector (1x) */}
        <div className="relative shrink-0 text-white select-none">
          <button
            onClick={handlePlaybackRateCycle}
            className="text-xs font-semibold hover:text-brand transition-colors px-1 shrink-0"
          >
            {playbackRate}x
          </button>
        </div>


        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          className="text-white hover:text-brand transition-colors shrink-0"
        >
          {isFullscreen ? (
            <Minimize className="w-5 h-5" />
          ) : (
            <Maximize className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
