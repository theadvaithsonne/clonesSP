"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { encodeLocation } from "@/lib/chat-markers";
import { cn } from "@/lib/utils";

interface LocationShareButtonProps {
  // Called with the encoded marker string; caller is responsible for sending.
  onShare: (encoded: string) => void;
  className?: string;
}

export function LocationShareButton({ onShare, className }: LocationShareButtonProps) {
  const [busy, setBusy] = useState(false);

  const share = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported in this browser");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        const { latitude, longitude } = pos.coords;
        const encoded = encodeLocation({
          lat: Number(latitude.toFixed(6)),
          lng: Number(longitude.toFixed(6)),
          label: "My current location",
        });
        onShare(encoded);
      },
      (err) => {
        setBusy(false);
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied"
            : err.code === err.POSITION_UNAVAILABLE
            ? "Location unavailable"
            : err.code === err.TIMEOUT
            ? "Location request timed out"
            : "Unable to fetch location";
        toast.error(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60_000 }
    );
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={share}
      disabled={busy}
      className={cn(
        "h-7 w-7 p-0 text-[#c7c7da] hover:text-white hover:bg-[#1a1a22] border border-transparent hover:border-[#363649] rounded-md",
        className
      )}
      title="Share your location"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
    </Button>
  );
}
