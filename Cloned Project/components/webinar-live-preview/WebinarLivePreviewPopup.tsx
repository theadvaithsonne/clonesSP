"use client";

import { memo, useEffect, useRef, useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Volume2, VolumeX, Radio, ExternalLink } from "lucide-react";
import { useWebinarLivePreview } from "@/hooks/useWebinarLivePreview";
import { useMediasoupAudience } from "@/app/(dashboard)/workspace/hooks/useMediasoupAudience";

// ── Video preview element ─────────────────────────────────────────────────────
const PreviewVideo = memo(({ track }: { track: MediaStreamTrack | null }) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!track) { el.srcObject = null; return; }
    const stream = new MediaStream([track]);
    el.srcObject = stream;
    el.play().catch(() => {});
    return () => { el.srcObject = null; };
  }, [track]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className="w-full h-full object-cover bg-[#111116]"
    />
  );
});
PreviewVideo.displayName = "PreviewVideo";

// ── Main popup ────────────────────────────────────────────────────────────────
// No props needed — orgId is resolved internally by the hook from auth storage.
export const WebinarLivePreviewPopup = memo(() => {
  const { webinar, shouldShow, dismiss, markJoined } = useWebinarLivePreview();
  const audience = useMediasoupAudience();
  const { join, leave, isJoined, isJoining, isMuted, setMuted, screenShareTrack, cameraTrack } = audience;

  const [isConnecting, setIsConnecting] = useState(false);
  const connectedIdRef = useRef<string | null>(null);

  // Auto-connect as audience (pre-guest) when a live webinar is detected
  useEffect(() => {
    if (!webinar || !shouldShow || isJoined || isJoining || isConnecting) return;
    if (connectedIdRef.current === webinar.workshopId) return;

    setIsConnecting(true);
    join(webinar.workshopId)
      .then(() => { connectedIdRef.current = webinar.workshopId; })
      .catch((e) => console.error("[WebinarPreviewPopup] join error:", e))
      .finally(() => setIsConnecting(false));
  }, [webinar?.workshopId, shouldShow, isJoined, isJoining, isConnecting, join]);

  // Leave when webinar ends or popup should hide.
  // Also covers the case where user dismisses while join is still in-flight (isConnecting).
  useEffect(() => {
    if (!shouldShow && (isJoined || isConnecting)) {
      leave();
      connectedIdRef.current = null;
    }
  }, [shouldShow, isJoined, isConnecting, leave]);

  // Cleanup on unmount
  const leaveRef = useRef(leave);
  leaveRef.current = leave;
  useEffect(() => () => { if (connectedIdRef.current) leaveRef.current(); }, []);

  // ── Join webinar in new tab ─────────────────────────────────────────────────
  const handleJoin = useCallback(() => {
    if (!webinar) return;
    // Leave audience first to avoid duplicate peer in room
    leave().catch(() => {});
    connectedIdRef.current = null;
    // Open webinar in new tab (same pattern as WorkshopsPage)
    window.open(`/webinar/${webinar.workshopId}`, "_blank");
    // Record that this user joined so other dashboard tabs hide the popup
    markJoined(webinar.workshopId);
  }, [webinar, leave, markJoined]);

  const displayTrack = screenShareTrack || cameraTrack;

  return (
    <AnimatePresence>
      {shouldShow && webinar && (
        <motion.div
          key={webinar.workshopId}
          className="fixed bottom-6 right-6 z-[9990] w-72 rounded-xl overflow-hidden shadow-2xl shadow-black/50"
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-[#1a1a20] border-b border-red-500/30">
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-red-500 animate-pulse" />
              <span className="text-xs font-semibold text-red-400 uppercase tracking-wide">
                Live Now
              </span>
            </div>
            <button
              onClick={dismiss}
              className="text-gray-400 hover:text-white transition-colors p-0.5 rounded"
              aria-label="Close preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Video area — click to join */}
          <div
            className="relative aspect-video bg-[#111116] cursor-pointer group"
            onClick={handleJoin}
          >
            {(isConnecting || isJoining) ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <div className="w-7 h-7 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                <span className="text-gray-400 text-[11px]">Connecting…</span>
              </div>
            ) : displayTrack ? (
              <PreviewVideo track={displayTrack} />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                  <span className="text-white text-xl font-bold">
                    {webinar.hostName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-gray-300 text-xs font-medium">{webinar.hostName}</span>
                <span className="text-gray-500 text-[11px]">Waiting for video…</span>
              </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
              <ExternalLink className="w-6 h-6 text-white" />
              <span className="text-white text-xs font-medium">Click to join</span>
            </div>

            {/* Bottom gradient */}
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-[#111116]">
            <div className="flex items-center gap-2 min-w-0">
              {webinar.hostProfilePicture ? (
                <img
                  src={webinar.hostProfilePicture}
                  alt={webinar.hostName}
                  className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-semibold">
                    {webinar.hostName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-white text-xs font-medium truncate leading-tight">
                  {webinar.title}
                </p>
                <p className="text-gray-400 text-[11px] truncate">{webinar.hostName}</p>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setMuted(!isMuted);
              }}
              className={`p-1.5 rounded-full transition-colors flex-shrink-0 ${
                isMuted
                  ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                  : "bg-red-500/20 hover:bg-red-500/30 text-red-400"
              }`}
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
WebinarLivePreviewPopup.displayName = "WebinarLivePreviewPopup";
