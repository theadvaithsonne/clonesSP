"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Monitor, Square, Trash2, Send, Pause, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScreenRecording, RecordingTarget } from "@/lib/screen-recording-context";

interface ScreenRecorderProps {
  onRecordingComplete: (file: File) => void;
  onSend?: (file: File) => void;
  className?: string;
  // Target info for the global recording (if not provided, uses local recording)
  target?: RecordingTarget;
}

export function ScreenRecorder({
  onRecordingComplete,
  onSend,
  className,
  target,
}: ScreenRecorderProps) {
  const {
    state,
    startRecording: globalStartRecording,
    stopRecording: globalStopRecording,
    pauseRecording: globalPauseRecording,
    resumeRecording: globalResumeRecording,
    cancelRecording: globalCancelRecording,
    getQueuedRecording,
    clearQueuedRecording,
  } = useScreenRecording();

  // Local state for fallback mode (when no target is provided)
  const [localIsRecording, setLocalIsRecording] = useState(false);
  const [localIsPaused, setLocalIsPaused] = useState(false);
  const [localRecordingTime, setLocalRecordingTime] = useState(0);
  const [localVideoBlob, setLocalVideoBlob] = useState<Blob | null>(null);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const localMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const localVideoChunksRef = useRef<Blob[]>([]);
  const localTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localDisplayStreamRef = useRef<MediaStream | null>(null); // Original display stream
  const localAudioStreamRef = useRef<MediaStream | null>(null); // Microphone stream

  // Determine if we're using global or local mode
  const useGlobalMode = !!target;

  // Check if this chat has a queued recording (only in global mode)
  const queuedRecording = target
    ? getQueuedRecording(target.type, target.id)
    : null;

  // Check if currently recording for this specific chat/post (global mode)
  const isRecordingForThisTarget =
    useGlobalMode &&
    state.isRecording &&
    state.target?.type === target?.type &&
    state.target?.id === target?.id;

  // Check if recording for a different chat/post (global mode)
  const isRecordingForDifferentTarget =
    useGlobalMode &&
    state.isRecording &&
    (state.target?.type !== target?.type || state.target?.id !== target?.id);

  // Cleanup local recording on unmount
  useEffect(() => {
    return () => {
      if (localTimerIntervalRef.current) {
        clearInterval(localTimerIntervalRef.current);
      }
      // Stop all streams on unmount
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (localDisplayStreamRef.current) {
        localDisplayStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (localAudioStreamRef.current) {
        localAudioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (localVideoUrl) {
        URL.revokeObjectURL(localVideoUrl);
      }
    };
  }, [localVideoUrl]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Local recording functions (fallback when no target)
  const startLocalRecording = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" },
        audio: true,
      });

      // Store original display stream so we can stop screen sharing later
      localDisplayStreamRef.current = displayStream;

      let audioStream: MediaStream | null = null;
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        localAudioStreamRef.current = audioStream;
      } catch {
        console.log("Microphone not available, recording screen audio only");
      }

      let combinedStream: MediaStream;
      if (audioStream) {
        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();

        const displayAudioTracks = displayStream.getAudioTracks();
        if (displayAudioTracks.length > 0) {
          const displayAudioSource = audioContext.createMediaStreamSource(
            new MediaStream(displayAudioTracks)
          );
          displayAudioSource.connect(destination);
        }

        const micSource = audioContext.createMediaStreamSource(audioStream);
        micSource.connect(destination);

        combinedStream = new MediaStream([
          ...displayStream.getVideoTracks(),
          ...destination.stream.getAudioTracks(),
        ]);
      } else {
        combinedStream = displayStream;
      }

      localStreamRef.current = combinedStream;

      displayStream.getVideoTracks()[0].onended = () => {
        if (localIsRecording) {
          stopLocalRecording();
        }
      };

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
        ? "video/webm;codecs=vp8"
        : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "video/mp4";

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 2500000,
      });

      localMediaRecorderRef.current = mediaRecorder;
      localVideoChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          localVideoChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const videoBlob = new Blob(localVideoChunksRef.current, {
          type: mediaRecorder.mimeType,
        });
        setLocalVideoBlob(videoBlob);
        const url = URL.createObjectURL(videoBlob);
        setLocalVideoUrl(url);

        // Stop all streams
        cleanupLocalStreams();
      };

      mediaRecorder.start(1000);
      setLocalIsRecording(true);
      setLocalIsPaused(false);
      setLocalRecordingTime(0);

      localTimerIntervalRef.current = setInterval(() => {
        setLocalRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error starting screen recording:", error);
    }
  };

  // Helper to stop all local streams
  const cleanupLocalStreams = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (localDisplayStreamRef.current) {
      localDisplayStreamRef.current.getTracks().forEach((track) => track.stop());
      localDisplayStreamRef.current = null;
    }
    if (localAudioStreamRef.current) {
      localAudioStreamRef.current.getTracks().forEach((track) => track.stop());
      localAudioStreamRef.current = null;
    }
  };

  const pauseLocalRecording = () => {
    if (localMediaRecorderRef.current && localIsRecording) {
      if (localIsPaused) {
        localMediaRecorderRef.current.resume();
        setLocalIsPaused(false);
        localTimerIntervalRef.current = setInterval(() => {
          setLocalRecordingTime((prev) => prev + 1);
        }, 1000);
      } else {
        localMediaRecorderRef.current.pause();
        setLocalIsPaused(true);
        if (localTimerIntervalRef.current) {
          clearInterval(localTimerIntervalRef.current);
        }
      }
    }
  };

  const stopLocalRecording = useCallback(() => {
    if (localMediaRecorderRef.current && localMediaRecorderRef.current.state !== "inactive") {
      localMediaRecorderRef.current.stop();
      setLocalIsRecording(false);
      setLocalIsPaused(false);

      if (localTimerIntervalRef.current) {
        clearInterval(localTimerIntervalRef.current);
      }
    }
  }, []);

  const cancelLocalRecording = () => {
    // Stop media recorder if active
    if (localMediaRecorderRef.current && localMediaRecorderRef.current.state !== "inactive") {
      localMediaRecorderRef.current.stop();
    }

    // Clear timer
    if (localTimerIntervalRef.current) {
      clearInterval(localTimerIntervalRef.current);
      localTimerIntervalRef.current = null;
    }

    // Stop all streams (including screen share)
    cleanupLocalStreams();

    // Reset state
    setLocalIsRecording(false);
    setLocalIsPaused(false);
    setLocalRecordingTime(0);
    setLocalVideoBlob(null);
    if (localVideoUrl) {
      URL.revokeObjectURL(localVideoUrl);
      setLocalVideoUrl(null);
    }
    localVideoChunksRef.current = [];
    localMediaRecorderRef.current = null;
  };

  // Handler functions that switch between global and local mode
  const handleStartRecording = async () => {
    if (useGlobalMode && target) {
      await globalStartRecording(target);
    } else {
      await startLocalRecording();
    }
  };

  const handlePauseRecording = () => {
    if (useGlobalMode) {
      state.isPaused ? globalResumeRecording() : globalPauseRecording();
    } else {
      pauseLocalRecording();
    }
  };

  const handleStopRecording = () => {
    if (useGlobalMode) {
      globalStopRecording();
    } else {
      stopLocalRecording();
    }
  };

  const handleCancelRecording = () => {
    if (useGlobalMode) {
      globalCancelRecording();
    } else {
      cancelLocalRecording();
    }
  };

  const handleSend = async () => {
    const blob = useGlobalMode ? queuedRecording?.blob : localVideoBlob;
    if (blob && !isSending) {
      setIsSending(true);

      try {
        const mimeType = blob.type;
        const extension = mimeType.includes("webm") ? "webm" : "mp4";

        const file = new File(
          [blob],
          `screen-recording-${Date.now()}.${extension}`,
          { type: mimeType }
        );

        if (onSend) {
          await onSend(file);
        } else {
          onRecordingComplete(file);
        }

        // Clear the recording after sending
        if (useGlobalMode) {
          clearQueuedRecording();
        } else {
          cancelLocalRecording();
        }
      } catch (error) {
        console.error("Error sending screen recording:", error);
      } finally {
        setIsSending(false);
      }
    }
  };

  const handleCancel = () => {
    if (useGlobalMode) {
      clearQueuedRecording();
    } else {
      cancelLocalRecording();
    }
  };

  // Determine current state based on mode
  const isRecording = useGlobalMode ? isRecordingForThisTarget : localIsRecording;
  const isPaused = useGlobalMode ? state.isPaused : localIsPaused;
  const recordingTime = useGlobalMode ? state.recordingTime : localRecordingTime;
  const videoBlob = useGlobalMode ? queuedRecording?.blob : localVideoBlob;
  const videoUrl = useGlobalMode ? queuedRecording?.url : localVideoUrl;
  const hasQueuedVideo = useGlobalMode ? !!queuedRecording : !!localVideoBlob;

  // Track if we've already auto-sent to prevent double sending
  const hasAutoSentRef = useRef(false);

  // Auto-send for posts: when there's a queued recording for a post, automatically send it
  useEffect(() => {
    if (target?.type === "post" && hasQueuedVideo && videoBlob && !isSending && !hasAutoSentRef.current) {
      hasAutoSentRef.current = true;
      // Create file and call onSend directly to avoid stale closure issues
      const mimeType = videoBlob.type;
      const extension = mimeType.includes("webm") ? "webm" : "mp4";
      const file = new File(
        [videoBlob],
        `screen-recording-${Date.now()}.${extension}`,
        { type: mimeType }
      );

      if (onSend) {
        onSend(file);
      } else {
        onRecordingComplete(file);
      }

      // Clear the recording after sending
      if (useGlobalMode) {
        clearQueuedRecording();
      }
    }
    // Reset the flag when there's no queued video
    if (!hasQueuedVideo) {
      hasAutoSentRef.current = false;
    }
  }, [target?.type, hasQueuedVideo, videoBlob, isSending, onSend, onRecordingComplete, useGlobalMode, clearQueuedRecording]);

  // If recording for a different chat/post (global mode only), show disabled button
  if (isRecordingForDifferentTarget) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled
        className={cn(
          "h-7 w-7 p-0 text-yellow-500/50 cursor-not-allowed",
          className
        )}
        title="Recording in progress for another chat"
      >
        <Monitor className="h-3.5 w-3.5" />
      </Button>
    );
  }

  // If there's a queued/completed recording, show preview
  if (hasQueuedVideo && videoUrl && videoBlob) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 bg-[#1a1a22] border border-[#2a2a35] rounded-md">
        {/* Small video thumbnail */}
        <div className="relative w-10 h-10 rounded overflow-hidden bg-black flex-shrink-0">
          <video
            src={videoUrl}
            className="w-full h-full object-cover"
            muted
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Play className="h-3 w-3 text-white" />
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col min-w-0">
          <span className="text-xs text-white truncate">Screen Recording</span>
          <span className="text-[10px] text-[#9fa0b8]">
            {formatFileSize(videoBlob.size)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 ml-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="h-6 w-6 p-0 text-[#c7c7da] hover:text-red-400 hover:bg-red-500/10"
            title="Delete"
            disabled={isSending}
          >
            <Trash2 className="h-3 w-3" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSend}
            className="h-6 w-6 p-0 text-green-400 hover:text-green-300 hover:bg-green-500/10"
            title="Send"
            disabled={isSending}
          >
            {isSending ? (
              <div className="h-3 w-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>
    );
  }

  // If recording, show recording controls
  if (isRecording) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/30 rounded-md">
        <div
          className={cn(
            "w-1.5 h-1.5 rounded-full flex-shrink-0",
            isPaused ? "bg-yellow-500" : "bg-red-500 animate-pulse"
          )}
        />
        <span className="text-xs text-red-400 font-mono whitespace-nowrap">
          {formatTime(recordingTime)}
        </span>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handlePauseRecording}
          className="h-5 w-5 p-0 text-[#c7c7da] hover:text-white hover:bg-white/10"
          title={isPaused ? "Resume" : "Pause"}
        >
          {isPaused ? (
            <Play className="h-3 w-3" />
          ) : (
            <Pause className="h-3 w-3" />
          )}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleStopRecording}
          className="h-5 w-5 p-0 text-white hover:text-white hover:bg-white/10"
          title="Stop & Preview"
        >
          <Square className="h-3 w-3 fill-current" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCancelRecording}
          className="h-5 w-5 p-0 text-[#c7c7da] hover:text-red-400 hover:bg-red-500/10"
          title="Cancel"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // Default: show start recording button
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleStartRecording}
      className={cn(
        "h-7 w-7 p-0 text-[#c7c7da] hover:text-white hover:bg-[#1a1a22] border border-transparent hover:border-[#363649] rounded-md",
        className
      )}
      title="Record screen"
    >
      <Monitor className="h-3.5 w-3.5" />
    </Button>
  );
}
