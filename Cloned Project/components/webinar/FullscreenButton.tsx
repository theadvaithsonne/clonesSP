"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";

/** The video stage element fullscreen is scoped to. */
const STAGE_ID = "webinar-stage";

/** Safari still ships the prefixed Fullscreen API. */
type WebkitFullscreen = {
  webkitRequestFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitFullscreenElement?: Element | null;
};

/**
 * Fullscreen scoped to the live stream stage rather than the document, so
 * only the video area expands — the browser shell and the surrounding page
 * chrome stay out of it. Rendered *inside* `#webinar-stage` as a floating
 * top-right overlay, so it stays reachable once fullscreen is on (a header
 * button would be hidden by it) and needs no hover over the control bar.
 */
export default function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => {
      const doc = document as Document & WebkitFullscreen;
      setIsFullscreen(!!(document.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    sync();
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const toggle = async () => {
    const stage = document.getElementById(STAGE_ID);
    if (!stage) return;
    const doc = document as Document & WebkitFullscreen;
    const el = stage as HTMLElement & WebkitFullscreen;
    try {
      if (!document.fullscreenElement && !doc.webkitFullscreenElement) {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
          el.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        }
      }
    } catch (err) {
      toast.error(
        "Couldn't toggle fullscreen: " +
          (err instanceof Error ? err.message : "blocked"),
      );
    }
  };

  return (
    <button
      onClick={() => void toggle()}
      className="absolute top-3 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/60 p-2 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-sm backdrop-saturate-150 transition-all hover:bg-black/80 hover:border-white/25 active:scale-95"
      title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
      aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
    >
      {isFullscreen ? (
        <Minimize2 className="h-4 w-4" />
      ) : (
        <Maximize2 className="h-4 w-4" />
      )}
    </button>
  );
}
