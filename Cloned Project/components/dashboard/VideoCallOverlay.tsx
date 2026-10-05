// roam-frontend/components/dashboard/VideoCallOverlay.tsx

"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useWebRTC } from "@/lib/webrtc-context";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";

export default function VideoCallOverlay() {
  const {
    inCall,
    localStream,
    remoteStream,
    endCall,
    isMuted,
    toggleMute,
    isVideoOff,
    toggleVideo,
    callType,
  } = useWebRTC();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const videoNode = localVideoRef.current;
    if (videoNode && localStream) {
      videoNode.srcObject = localStream;
      videoNode.play().catch((error) => {
        console.error("Local video play() failed:", error);
      });
    }
  }, [localStream]);

  useEffect(() => {
    const videoNode = remoteVideoRef.current;
    if (videoNode && remoteStream) {
      videoNode.srcObject = remoteStream;
      videoNode.play().catch((error) => {
        console.error("Remote video play() failed:", error);
      });
    }
  }, [remoteStream]);

  // Handle remote audio separately
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

  // ** ROBUST PICTURE-IN-PICTURE IMPLEMENTATION **
  useEffect(() => {
    const videoNode = remoteVideoRef.current;
    if (!videoNode || !remoteStream) return;

    const doc = document as Document & {
      pictureInPictureElement?: Element | null;
      exitPictureInPicture?: () => Promise<void>;
      pictureInPictureEnabled?: boolean;
    };
    
    const requestPiP = async () => {
      if (!doc.pictureInPictureEnabled) {
        console.warn("PiP is not enabled in this browser.");
        return;
      }
      if (doc.pictureInPictureElement) return; // Already in PiP
      try {
        await videoNode.requestPictureInPicture();
      } catch (error) {
        console.error("Failed to enter Picture-in-Picture mode:", error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // We call requestPiP which now has internal checks
        requestPiP();
      }
    };
    
    // This is the key: only try to enable PiP after the video is ready.
    const handleMetadataLoaded = () => {
      videoNode.disablePictureInPicture = false;
    };

    videoNode.addEventListener('loadedmetadata', handleMetadataLoaded);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      videoNode.removeEventListener('loadedmetadata', handleMetadataLoaded);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (doc.pictureInPictureElement === videoNode) {
        doc.exitPictureInPicture?.().catch(() => undefined);
      }
    };
  }, [remoteStream]);

  if (!inCall || callType !== 'video') {
    return null;
  }

  // Avoid rendering on the server
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  const content = (
    <div className="fixed inset-0 bg-black z-[1000] flex flex-col animate-in fade-in">
      <div className="flex-1 relative overflow-hidden min-h-0">
        {/* Remote Video (Main View) */}
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            playsInline
            autoPlay
            className="absolute top-0 left-0 h-full w-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-white text-lg animate-pulse flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-dashed border-gray-500 rounded-full animate-spin"></div>
              Connecting to peer...
            </div>
          </div>
        )}

        {/* Local Video (Picture-in-Picture) */}
        {localStream && (
          <video
            ref={localVideoRef}
            playsInline
            autoPlay
            muted
            className="absolute z-10 bottom-4 right-4 w-40 md:w-60 h-auto rounded-lg border-2 border-purple-600/70 shadow-2xl transform scale-x-[-1] transition-all duration-300"
          />
        )}

        {/* Remote Audio (Hidden) */}
        {remoteStream && (
          <audio
            ref={remoteAudioRef}
            autoPlay
            playsInline
            className="sr-only"
          />
        )}
      </div>

      {/* Controls */}
      <div className="flex justify-center items-center gap-4 py-4 bg-black/50 backdrop-blur-sm z-20">
        <Button
          onClick={toggleMute}
          size="icon"
          className={cn(
            "h-14 w-14 rounded-full transition-colors",
            isMuted
              ? "bg-white text-black hover:bg-gray-200"
              : "bg-gray-700/80 text-white hover:bg-gray-600"
          )}
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <MicOff className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </Button>
        <Button
          onClick={toggleVideo}
          size="icon"
          className={cn(
            "h-14 w-14 rounded-full transition-colors",
            isVideoOff
              ? "bg-white text-black hover:bg-gray-200"
              : "bg-gray-700/80 text-white hover:bg-gray-600"
          )}
          aria-label={isVideoOff ? "Turn Video On" : "Turn Video Off"}
        >
          {isVideoOff ? (
            <VideoOff className="h-6 w-6" />
          ) : (
            <Video className="h-6 w-6" />
          )}
        </Button>
        <Button
          onClick={endCall}
          size="icon"
          className="h-14 w-14 rounded-full bg-red-600 hover:bg-red-700 text-white"
          aria-label="End Call"
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}