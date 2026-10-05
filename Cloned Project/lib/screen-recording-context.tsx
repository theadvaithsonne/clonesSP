"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";

// Types for the recording target (which chat/post to send to)
export type RecordingTarget = {
  type: "dm" | "group" | "post";
  id: string;
  name?: string; // Display name for the indicator
};

// Recording state
export type RecordingState = {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  target: RecordingTarget | null;
  videoBlob: Blob | null;
  videoUrl: string | null;
};

// Context value type
type ScreenRecordingContextType = {
  // State
  state: RecordingState;

  // Actions
  startRecording: (target: RecordingTarget) => Promise<boolean>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => void;

  // Get the queued recording for a specific chat/post
  getQueuedRecording: (type: "dm" | "group" | "post", id: string) => { blob: Blob; url: string } | null;
  clearQueuedRecording: () => void;

  // Check if there's a queued recording for a specific chat/post
  hasQueuedRecordingFor: (type: "dm" | "group" | "post", id: string) => boolean;
};

const ScreenRecordingContext = createContext<ScreenRecordingContextType | null>(null);

export function ScreenRecordingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    recordingTime: 0,
    target: null,
    videoBlob: null,
    videoUrl: null,
  });

  // Refs for recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null); // Original display stream (screen share)
  const audioStreamRef = useRef<MediaStream | null>(null);

  // Cleanup function - stops all streams and clears refs
  const cleanup = useCallback(() => {
    console.log("[ScreenRecording] Cleanup - stopping all streams");

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Stop the combined stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        console.log("[ScreenRecording] Stopping combined track:", track.kind, track.label);
        track.stop();
      });
      streamRef.current = null;
    }

    // Stop the original display stream (this is what actually stops screen sharing)
    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach((track) => {
        console.log("[ScreenRecording] Stopping display track:", track.kind, track.label);
        track.stop();
      });
      displayStreamRef.current = null;
    }

    // Stop microphone stream
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => {
        console.log("[ScreenRecording] Stopping audio track:", track.kind, track.label);
        track.stop();
      });
      audioStreamRef.current = null;
    }

    // Clear media recorder ref
    mediaRecorderRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      if (state.videoUrl) {
        URL.revokeObjectURL(state.videoUrl);
      }
    };
  }, []);

  // Warn user before leaving page while recording
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.isRecording || state.videoBlob) {
        // Standard way to trigger the browser's confirmation dialog
        e.preventDefault();
        // For older browsers
        e.returnValue = "You have an unsaved recording. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [state.isRecording, state.videoBlob]);

  const startRecording = useCallback(async (target: RecordingTarget): Promise<boolean> => {
    // If already recording, don't start another
    if (state.isRecording) {
      console.log("[ScreenRecording] Already recording, ignoring start request");
      return false;
    }

    try {
      // Request screen capture with audio
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor",
        },
        audio: true,
      });

      // Store the original display stream so we can stop screen sharing later
      displayStreamRef.current = displayStream;

      // Try to get microphone audio to mix with screen audio
      let audioStream: MediaStream | null = null;
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        audioStreamRef.current = audioStream;
      } catch {
        console.log("[ScreenRecording] Microphone not available, recording screen audio only");
      }

      // Combine streams if we have microphone audio
      let combinedStream: MediaStream;
      if (audioStream) {
        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();

        // Add display audio if available
        const displayAudioTracks = displayStream.getAudioTracks();
        if (displayAudioTracks.length > 0) {
          const displayAudioSource = audioContext.createMediaStreamSource(
            new MediaStream(displayAudioTracks)
          );
          displayAudioSource.connect(destination);
        }

        // Add microphone audio
        const micSource = audioContext.createMediaStreamSource(audioStream);
        micSource.connect(destination);

        // Combine video from display with mixed audio
        combinedStream = new MediaStream([
          ...displayStream.getVideoTracks(),
          ...destination.stream.getAudioTracks(),
        ]);
      } else {
        combinedStream = displayStream;
      }

      streamRef.current = combinedStream;

      // Handle when user stops sharing via browser UI
      displayStream.getVideoTracks()[0].onended = () => {
        console.log("[ScreenRecording] User stopped screen share via browser");
        stopRecording();
      };

      // Determine best supported mime type
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
        ? "video/webm;codecs=vp8"
        : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "video/mp4";

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps for good quality
      });

      mediaRecorderRef.current = mediaRecorder;
      videoChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const videoBlob = new Blob(videoChunksRef.current, {
          type: mediaRecorder.mimeType,
        });
        const url = URL.createObjectURL(videoBlob);

        // If recording for a post, save to localStorage for persistence
        if (target.type === "post") {
          try {
            const arrayBuffer = await videoBlob.arrayBuffer();
            const base64 = btoa(
              new Uint8Array(arrayBuffer).reduce(
                (data, byte) => data + String.fromCharCode(byte),
                ""
              )
            );
            localStorage.setItem(
              "pendingPostScreenRecording",
              JSON.stringify({
                base64,
                mimeType: videoBlob.type,
                targetType: target.type,
                targetId: target.id,
                targetName: target.name,
              })
            );
            console.log("[ScreenRecording] Saved post recording to localStorage");
          } catch (e) {
            console.error("[ScreenRecording] Failed to save to localStorage:", e);
          }
        }

        // Update state with the completed recording
        setState((prev) => ({
          ...prev,
          isRecording: false,
          isPaused: false,
          videoBlob,
          videoUrl: url,
          // Keep the target so we know where to send it
        }));

        // Stop all tracks
        cleanup();
      };

      mediaRecorder.start(1000); // Collect data every second

      // Update state
      setState({
        isRecording: true,
        isPaused: false,
        recordingTime: 0,
        target,
        videoBlob: null,
        videoUrl: null,
      });

      // Start timer
      timerIntervalRef.current = setInterval(() => {
        setState((prev) => ({
          ...prev,
          recordingTime: prev.recordingTime + 1,
        }));
      }, 1000);

      console.log("[ScreenRecording] Recording started for", target);
      return true;
    } catch (error) {
      console.error("[ScreenRecording] Error starting recording:", error);
      cleanup();
      return false;
    }
  }, [state.isRecording, cleanup]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      console.log("[ScreenRecording] Stopping recording");
      mediaRecorderRef.current.stop();

      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording && !state.isPaused) {
      mediaRecorderRef.current.pause();
      setState((prev) => ({ ...prev, isPaused: true }));

      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  }, [state.isRecording, state.isPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording && state.isPaused) {
      mediaRecorderRef.current.resume();
      setState((prev) => ({ ...prev, isPaused: false }));

      // Resume timer
      timerIntervalRef.current = setInterval(() => {
        setState((prev) => ({
          ...prev,
          recordingTime: prev.recordingTime + 1,
        }));
      }, 1000);
    }
  }, [state.isRecording, state.isPaused]);

  const cancelRecording = useCallback(() => {
    console.log("[ScreenRecording] Cancelling recording");

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    cleanup();

    // Revoke old URL if exists
    if (state.videoUrl) {
      URL.revokeObjectURL(state.videoUrl);
    }

    // Clear localStorage for post recordings
    if (state.target?.type === "post") {
      localStorage.removeItem("pendingPostScreenRecording");
    }

    // Reset state completely
    setState({
      isRecording: false,
      isPaused: false,
      recordingTime: 0,
      target: null,
      videoBlob: null,
      videoUrl: null,
    });

    videoChunksRef.current = [];
  }, [cleanup, state.videoUrl, state.target]);

  const getQueuedRecording = useCallback((type: "dm" | "group" | "post", id: string) => {
    if (
      state.videoBlob &&
      state.videoUrl &&
      state.target?.type === type &&
      state.target?.id === id
    ) {
      return { blob: state.videoBlob, url: state.videoUrl };
    }
    return null;
  }, [state.videoBlob, state.videoUrl, state.target]);

  const hasQueuedRecordingFor = useCallback((type: "dm" | "group" | "post", id: string) => {
    return (
      !state.isRecording &&
      state.videoBlob !== null &&
      state.target?.type === type &&
      state.target?.id === id
    );
  }, [state.isRecording, state.videoBlob, state.target]);

  const clearQueuedRecording = useCallback(() => {
    if (state.videoUrl) {
      URL.revokeObjectURL(state.videoUrl);
    }
    // Clear localStorage for post recordings
    if (state.target?.type === "post") {
      localStorage.removeItem("pendingPostScreenRecording");
      console.log("[ScreenRecording] Cleared post recording from localStorage");
    }
    setState({
      isRecording: false,
      isPaused: false,
      recordingTime: 0,
      target: null,
      videoBlob: null,
      videoUrl: null,
    });
  }, [state.videoUrl, state.target]);

  return (
    <ScreenRecordingContext.Provider
      value={{
        state,
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        cancelRecording,
        getQueuedRecording,
        hasQueuedRecordingFor,
        clearQueuedRecording,
      }}
    >
      {children}
    </ScreenRecordingContext.Provider>
  );
}

export function useScreenRecording() {
  const context = useContext(ScreenRecordingContext);
  if (!context) {
    throw new Error("useScreenRecording must be used within a ScreenRecordingProvider");
  }
  return context;
}
