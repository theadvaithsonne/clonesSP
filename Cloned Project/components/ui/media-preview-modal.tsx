"use client";

import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X, Download, ExternalLink } from "lucide-react";

interface MediaPreviewModalProps {
  media: {
    url: string;
    type: string;
    name: string;
  } | null;
  onClose: () => void;
}

export function MediaPreviewModal({ media, onClose }: MediaPreviewModalProps) {
  if (!media || typeof document === "undefined") return null;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement("a");
    link.href = media.url;
    link.download = media.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(media.url, "_blank");
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              size="sm"
              variant="ghost"
              className="h-10 w-10 p-0 text-white hover:bg-white/10 rounded-full"
            >
              <X className="h-6 w-6" />
            </Button>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {media.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleDownload}
              size="sm"
              variant="ghost"
              className="h-10 w-10 p-0 text-white hover:bg-white/10 rounded-full"
              title="Download"
            >
              <Download className="h-5 w-5" />
            </Button>
            <Button
              onClick={handleOpenInNewTab}
              size="sm"
              variant="ghost"
              className="h-10 w-10 p-0 text-white hover:bg-white/10 rounded-full"
              title="Open in new tab"
            >
              <ExternalLink className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Media content */}
      <div
        className="w-full h-full flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {media.type.startsWith("image/") ? (
          <img
            src={media.url}
            alt={media.name}
            className="max-w-full max-h-full object-contain"
          />
        ) : media.type.startsWith("video/") ? (
          <video
            src={media.url}
            controls
            autoPlay
            className="max-w-full max-h-full"
          />
        ) : null}
      </div>
    </div>,
    document.body
  );
}
