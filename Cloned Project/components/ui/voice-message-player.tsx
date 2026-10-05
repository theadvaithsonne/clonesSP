"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceMessagePlayerProps {
  src: string;
  isOwnMessage?: boolean;
}

export function VoiceMessagePlayer({
  src,
  isOwnMessage = false,
}: VoiceMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [waveformBars] = useState(() =>
    // Generate random waveform bars (simulated)
    Array.from({ length: 40 }, () => Math.random() * 0.7 + 0.3)
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, []);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || duration === 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || time === 0) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 min-w-[200px] max-w-[280px]">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        onClick={togglePlayPause}
        className={cn(
          "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all",
          isOwnMessage
            ? "bg-white/20 hover:bg-white/30 text-white"
            : "bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400"
        )}
      >
        {isPlaying ? (
          <Pause className="w-5 h-5" />
        ) : (
          <Play className="w-5 h-5 ml-0.5" />
        )}
      </button>

      {/* Waveform and Progress */}
      <div className="flex-1 flex flex-col gap-1">
        {/* Waveform */}
        <div
          className="flex items-center gap-[2px] h-8 cursor-pointer"
          onClick={handleWaveformClick}
        >
          {waveformBars.map((height, index) => {
            const barProgress = (index / waveformBars.length) * 100;
            const isActive = barProgress <= progress;

            return (
              <div
                key={index}
                className={cn(
                  "w-[3px] rounded-full transition-colors duration-150",
                  isActive
                    ? isOwnMessage
                      ? "bg-white"
                      : "bg-indigo-400"
                    : isOwnMessage
                    ? "bg-white/30"
                    : "bg-white/20"
                )}
                style={{
                  height: `${height * 100}%`,
                }}
              />
            );
          })}
        </div>

        {/* Time Display */}
        <div
          className={cn(
            "text-[10px] font-medium",
            isOwnMessage ? "text-white/70" : "text-white/50"
          )}
        >
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
    </div>
  );
}
