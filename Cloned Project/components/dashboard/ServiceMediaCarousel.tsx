"use client";

import { useEffect, useRef, useState } from "react";
import { Briefcase, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/** Byte count as a short human string — KB under a megabyte, else MB. */
export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Pull the video id out of any common YouTube URL shape. */
export function youtubeId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  );
  return match ? match[1] : null;
}

export function youtubeThumb(url?: string): string | null {
  const id = youtubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

export interface MediaItem {
  kind: "image" | "video" | "youtube";
  src: string;
}

/** Images, uploaded videos and a YouTube demo, in one swipeable frame. */
export function buildServiceMedia(service: {
  images?: string[];
  videos?: string[];
  youtubeUrl?: string;
  coverImage?: string;
}): MediaItem[] {
  const images = service.images?.length
    ? service.images
    : service.coverImage
      ? [service.coverImage]
      : [];

  return [
    ...images.map((src) => ({ kind: "image" as const, src })),
    ...(service.videos || []).map((src) => ({ kind: "video" as const, src })),
    ...(youtubeId(service.youtubeUrl)
      ? [{ kind: "youtube" as const, src: service.youtubeUrl as string }]
      : []),
  ];
}

export function ServiceMediaCarousel({
  items,
  fallbackIcon,
  fallbackIconBg,
  className,
}: {
  items: MediaItem[];
  fallbackIcon?: string;
  fallbackIconBg?: string;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [ytPlaying, setYtPlaying] = useState(false);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const touchStartX = useRef<number | null>(null);

  const count = items.length;

  // Only the visible slide plays. Muted, because browsers block audible autoplay.
  useEffect(() => {
    videoRefs.current.forEach((video, i) => {
      if (!video) return;
      if (i === index) {
        video.muted = true;
        video.play().catch(() => {});
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
    if (items[index]?.kind !== "youtube") setYtPlaying(false);
  }, [index, items]);

  const go = (next: number) => {
    if (count === 0) return;
    setIndex(((next % count) + count) % count);
  };

  if (count === 0) {
    return (
      <div
        className={cn(
          "flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border border-[#262626] bg-[#1A1A1A]",
          className,
        )}
        style={fallbackIcon ? { backgroundColor: fallbackIconBg || "#1A1A1A" } : undefined}
      >
        {fallbackIcon ? (
          <span className="text-7xl">{fallbackIcon}</span>
        ) : (
          <Briefcase className="h-16 w-16 text-[#4a4b5f]" />
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative aspect-video w-full select-none overflow-hidden rounded-2xl border border-[#262626] bg-[#1A1A1A]",
        className,
      )}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const delta = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(delta) > 40) go(index + (delta < 0 ? 1 : -1));
        touchStartX.current = null;
      }}
    >
      <div
        className="flex h-full w-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {items.map((item, i) => (
          <div key={`${item.src}-${i}`} className="h-full w-full shrink-0">
            {item.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.src} alt="" className="h-full w-full object-cover" />
            ) : item.kind === "video" ? (
              <video
                ref={(el) => {
                  videoRefs.current[i] = el;
                }}
                src={item.src}
                className="h-full w-full object-cover"
                muted
                loop
                playsInline
                controls
              />
            ) : ytPlaying && i === index ? (
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId(item.src)}?autoplay=1&rel=0`}
                title="Service demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            ) : (
              <button
                type="button"
                onClick={() => setYtPlaying(true)}
                className="relative h-full w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={youtubeThumb(item.src) || ""}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground">
                    <Play className="ml-0.5 h-6 w-6 fill-brand-foreground" />
                  </span>
                </span>
              </button>
            )}
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
            {items.map((item, i) => (
              <button
                key={`dot-${item.src}-${i}`}
                type="button"
                onClick={() => go(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-5 bg-brand" : "w-1.5 bg-white/40 hover:bg-white/70",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
