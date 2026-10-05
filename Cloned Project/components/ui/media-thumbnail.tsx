"use client";

import { useState, useRef, useEffect } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaThumbnailProps {
  src: string;
  type: string;
  alt?: string;
  className?: string;
  onClick?: () => void;
}

export function MediaThumbnail({
  src,
  type,
  alt = "Media",
  className,
  onClick,
}: MediaThumbnailProps) {
  const isImage = type?.startsWith("image/");
  const isVideo = type?.startsWith("video/");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (isVideo && videoRef.current) {
      const video = videoRef.current;

      const handleLoadedData = () => {
        setVideoLoaded(true);
        window.dispatchEvent(new CustomEvent("chat-image-loaded"));
      };

      const handleError = () => {
        setVideoError(true);
      };

      video.addEventListener("loadeddata", handleLoadedData);
      video.addEventListener("error", handleError);

      return () => {
        video.removeEventListener("loadeddata", handleLoadedData);
        video.removeEventListener("error", handleError);
      };
    }
  }, [isVideo]);

  if (isImage) {
    const hasHeightOrAspect = className?.includes("h-") || className?.includes("aspect-");

    return (
      <div
        className={cn(
          "relative overflow-hidden rounded cursor-pointer group bg-[#16161f] transition-all duration-300",
          !imageLoaded && !hasHeightOrAspect && "min-h-[160px]",
          className
        )}
        onClick={onClick}
      >
        {/* Pulsing skeleton overlay */}
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#16161f] border border-[#2a2a35]/40 rounded z-10 animate-pulse">
            <svg
              className="w-8 h-8 text-white/10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        <img
          src={src}
          alt={alt}
          onLoad={() => {
            setImageLoaded(true);
            window.dispatchEvent(new CustomEvent("chat-image-loaded"));
          }}
          className={cn(
            "w-full h-full object-cover transition-all duration-300 group-hover:scale-105",
            imageLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"
          )}
        />
        {/* Hover overlay */}
        {imageLoaded && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 z-20" />
        )}
      </div>
    );
  }

  if (isVideo) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded cursor-pointer group bg-black/50",
          className
        )}
        onClick={onClick}
      >
        {/* Video thumbnail - shows first frame */}
        <video
          ref={videoRef}
          src={src}
          className={cn(
            "w-full h-full object-cover transition-transform duration-200 group-hover:scale-105",
            !videoLoaded && !videoError && "opacity-0"
          )}
          muted
          preload="metadata"
          playsInline
          // Seek to 0.1s to get a frame (some videos have black first frame)
          onLoadedMetadata={(e) => {
            const video = e.currentTarget;
            video.currentTime = 0.1;
          }}
        />

        {/* Loading/Error fallback */}
        {(!videoLoaded || videoError) && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a22]">
            <Play className="h-8 w-8 text-white/50" />
          </div>
        )}

        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm transition-transform duration-200 group-hover:scale-110">
            <Play className="h-5 w-5 text-white ml-0.5" fill="white" />
          </div>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 pointer-events-none" />
      </div>
    );
  }

  return null;
}
