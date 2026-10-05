"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Trash2, Send, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceRecorderProps {
  onRecordingComplete: (file: File) => void;
  onSend?: (file: File) => void;
  className?: string;
}

export function VoiceRecorder({
  onRecordingComplete,
  onSend,
  className,
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Warn user before leaving page while recording
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRecording || audioBlob) {
        e.preventDefault();
        e.returnValue = "You have an unsaved voice recording. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isRecording, audioBlob]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4",
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType,
        });
        setAudioBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      // Start timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Unable to access microphone. Please check your permissions.");
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
        // Resume timer
        timerIntervalRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
        // Pause timer
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);

      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  const cancelRecording = () => {
    if (isRecording) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    }

    // Reset state
    setIsRecording(false);
    setIsPaused(false);
    setRecordingTime(0);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    audioChunksRef.current = [];
  };

  const handleSend = () => {
    if (audioBlob) {
      const mimeType = audioBlob.type;
      const extension = mimeType.includes("webm")
        ? "webm"
        : mimeType.includes("mp4")
        ? "mp4"
        : "webm";

      console.log(`Creating voice note file: ${mimeType}, extension: ${extension}`);

      const file = new File([audioBlob], `voice-note-${Date.now()}.${extension}`, {
        type: mimeType,
      });

      console.log(`Voice note file created:`, {
        name: file.name,
        type: file.type,
        size: file.size,
      });

      if (onSend) {
        onSend(file);
      } else {
        onRecordingComplete(file);
      }

      // Reset after sending
      cancelRecording();
    }
  };

  const togglePlayback = () => {
    if (!audioUrl) return;

    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new Audio(audioUrl);
      audioPlayerRef.current.onended = () => {
        setIsPlaying(false);
      };
    }

    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // If not recording and no audio recorded, show mic button
  if (!isRecording && !audioBlob) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={startRecording}
        className={cn(
          "h-7 w-7 p-0 text-[#c7c7da] hover:text-white hover:bg-[#1a1a22] border border-transparent hover:border-[#363649] rounded-md",
          className
        )}
        title="Record voice note"
      >
        <Mic className="h-3.5 w-3.5" />
      </Button>
    );
  }

  // Recording UI
  if (isRecording) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-[#1a1a22] border border-[#2a2a35] rounded-md">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            isPaused ? "bg-yellow-500" : "bg-red-500 animate-pulse"
          )} />
          <span className="text-sm text-white font-mono">
            {formatTime(recordingTime)}
          </span>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={pauseRecording}
            className="h-7 w-7 p-0 text-[#c7c7da] hover:text-white hover:bg-white/10"
            title={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? (
              <Play className="h-3.5 w-3.5" />
            ) : (
              <Pause className="h-3.5 w-3.5" />
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={cancelRecording}
            className="h-7 w-7 p-0 text-[#c7c7da] hover:text-red-400 hover:bg-red-500/10"
            title="Cancel"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={stopRecording}
            className="h-7 w-7 p-0 text-[#c7c7da] hover:text-white hover:bg-white/10"
            title="Stop"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </Button>
        </div>
      </div>
    );
  }

  // Preview UI (after recording stopped)
  if (audioBlob && audioUrl) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-[#1a1a22] border border-[#2a2a35] rounded-md">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={togglePlayback}
          className="h-7 w-7 p-0 text-[#c7c7da] hover:text-white hover:bg-white/10"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
        </Button>

        <div className="flex-1">
          <div className="text-xs text-white">Voice Note</div>
          <div className="text-[10px] text-[#9fa0b8]">
            {formatTime(recordingTime)}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={cancelRecording}
            className="h-7 w-7 p-0 text-[#c7c7da] hover:text-red-400 hover:bg-red-500/10"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSend}
            className="h-7 w-7 p-0 text-[#c7c7da] hover:text-green-400 hover:bg-green-500/10"
            title="Send"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
