// roam-frontend/components/dashboard/AudioCallOverlay.tsx

"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useWebRTC } from "@/lib/webrtc-context";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, PhoneOff, User } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AudioCallOverlay() {
  const {
    inCall,
    localStream,
    remoteStream,
    endCall,
    isMuted,
    toggleMute,
    callType,
  } = useWebRTC();

  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Handle remote audio
  useEffect(() => {
    const audioNode = remoteAudioRef.current;
    if (audioNode && remoteStream) {
      // Extract audio tracks from the remote stream
      const audioTracks = remoteStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const audioStream = new MediaStream(audioTracks);
        audioNode.srcObject = audioStream;
        audioNode.play().catch((error) => {
          console.error("Remote audio play() failed:", error);
        });
      }
    }
  }, [remoteStream]);

  if (!inCall || callType !== 'audio') {
    return null;
  }

  const content = (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
      {/* Audio Call Interface */}
      <div className="bg-gray-900/95 backdrop-blur-md rounded-2xl p-8 max-w-md w-full mx-4 border border-gray-700/50">
        {/* Call Status */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="h-12 w-12 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Audio Call</h2>
          <p className="text-gray-300">Connected</p>
        </div>

        {/* Audio Element (hidden) */}
        <audio ref={remoteAudioRef} autoPlay playsInline />

        {/* Controls */}
        <div className="flex justify-center items-center gap-6">
          <Button
            onClick={toggleMute}
            size="icon"
            className={cn(
              "h-16 w-16 rounded-full transition-colors",
              isMuted
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-gray-700/80 text-white hover:bg-gray-600"
            )}
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <MicOff className="h-7 w-7" />
            ) : (
              <Mic className="h-7 w-7" />
            )}
          </Button>
          
          <Button
            onClick={endCall}
            size="icon"
            className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-700 text-white"
            aria-label="End Call"
          >
            <PhoneOff className="h-7 w-7" />
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
