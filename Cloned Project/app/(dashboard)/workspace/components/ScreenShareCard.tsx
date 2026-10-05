"use client";

import { memo, useMemo, useRef, useEffect } from "react";
import { PeerState } from "../types";
import { buildSingleTrackStream } from "../utils";
import { motion } from "framer-motion";
import { ScreenShare, Maximize2 } from "lucide-react";

export const ScreenShareCard = memo(
  ({
    peer,
    screenTrack,
    onWatch,
  }: {
    peer: PeerState;
    screenTrack: MediaStreamTrack;
    onWatch: () => void;
  }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const previewStream = useMemo(
      () => buildSingleTrackStream(screenTrack),
      [screenTrack]
    );

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      if (previewStream) {
        if (video.srcObject !== previewStream) {
          video.srcObject = previewStream;
        }
        video.muted = true;
        void video.play().catch(() => {});
      } else if (video.srcObject) {
        video.srcObject = null;
      }

      return () => {
        if (video.srcObject === previewStream) {
          video.srcObject = null;
        }
      };
    }, [previewStream]);

    useEffect(() => {
      const handleEnded = () => {
        const video = videoRef.current;
        if (video && video.srcObject === previewStream) {
          video.srcObject = null;
        }
      };

      screenTrack.addEventListener("ended", handleEnded);
      return () => {
        screenTrack.removeEventListener("ended", handleEnded);
      };
    }, [screenTrack, previewStream]);

    if (!previewStream) {
      return null;
    }

    return (
      <motion.button
        type="button"
        className="relative w-full overflow-hidden rounded-lg border border-blue-500/40 bg-black/60 shadow-lg backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 group"
        onClick={(event) => {
          event.stopPropagation();
          onWatch();
        }}
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-24 w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-black/70 pointer-events-none" />
        <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] uppercase tracking-wide text-blue-200">
          <ScreenShare className="h-3 w-3" />
          <span>Screen</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1 text-xs text-white truncate">
          {peer.name || peer.email}
        </div>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <Maximize2 className="h-5 w-5 text-white" />
        </div>
      </motion.button>
    );
  }
);
ScreenShareCard.displayName = "ScreenShareCard";
