// uploads/garage-new-nextjs-v1/app/(dashboard)/workspace/hooks/useRecording.ts
// roam-frontend/app/(dashboard)/workspace/hooks/useRecording.ts

import { useCallback, useRef, useState, useEffect } from "react";
import { connectSocket } from "@/lib/socket";
import { PeerState } from "../types";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { toast } from "sonner";
import { generateAskCabinetPrompt } from "@/lib/askCabinetUtils";

// IndexedDB helper for backup recordings
const DB_NAME = "recording-backup";
const STORE_NAME = "chunks";
const DB_VERSION = 1;

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

async function saveBackupChunks(sessionId: string, chunks: Blob[], mimeType: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    // Convert blobs to array buffers for storage
    const chunkData = await Promise.all(chunks.map(chunk => chunk.arrayBuffer()));

    store.put({
      id: sessionId,
      chunks: chunkData,
      mimeType,
      timestamp: Date.now(),
    });

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn("Failed to backup recording chunks:", err);
  }
}

async function getBackupRecording(sessionId: string): Promise<{ blob: Blob; mimeType: string } | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(sessionId);
      request.onsuccess = () => {
        const data = request.result;
        db.close();
        if (data && data.chunks) {
          const blobs = data.chunks.map((buffer: ArrayBuffer) => new Blob([buffer]));
          resolve({ blob: new Blob(blobs, { type: data.mimeType }), mimeType: data.mimeType });
        } else {
          resolve(null);
        }
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn("Failed to get backup recording:", err);
    return null;
  }
}

async function clearBackupRecording(sessionId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(sessionId);
    await new Promise((resolve) => { tx.oncomplete = resolve; });
    db.close();
  } catch (err) {
    console.warn("Failed to clear backup recording:", err);
  }
}

async function getAllBackupSessions(): Promise<string[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.getAllKeys();
      request.onsuccess = () => {
        db.close();
        resolve(request.result as string[]);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn("Failed to get backup sessions:", err);
    return [];
  }
}

// Download blob as file
function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

type UpdatePeerState = (peerId: string, data: Partial<PeerState>) => void;

type UseRecordingReturn = {
  isRecording: boolean;
  toggleRecording: () => Promise<void> | void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  recordingPreviewStream: MediaStream | null;
  // New: Recording-specific camera/mic controls
  isRecordingMicOn: boolean;
  isRecordingCameraOn: boolean;
  toggleRecordingMic: () => void;
  toggleRecordingCamera: () => Promise<void>;
  recordingCameraStream: MediaStream | null;
  recordingDuration: number;
  updateCameraBubblePosition: (x: number, y: number, size: number) => void;
};

// List of preferred MIME types, from most to least desirable.
const SUPPORTED_MIME_TYPES = [
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9,opus",
  "video/webm",
];

export function useRecording(
  me: string,
  mySpaceId: string,
  localStream: MediaStream | null,
  peers: Map<string, PeerState>,
  updatePeerState: UpdatePeerState
): UseRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const finalStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const auxiliaryTracksRef = useRef<MediaStreamTrack[]>([]);
  const audioDestinationRef =
    useRef<MediaStreamAudioDestinationNode | null>(null);
  const peerAudioSourcesRef = useRef<
    Map<string, MediaStreamAudioSourceNode>
  >(new Map());
  const isStoppingRef = useRef(false);
  const [recordingPreviewStream, setRecordingPreviewStream] = useState<
    MediaStream | null
  >(null);

  // New: Recording-specific camera/mic state
  const [isRecordingMicOn, setIsRecordingMicOn] = useState(true);
  const [isRecordingCameraOn, setIsRecordingCameraOn] = useState(false);
  const [recordingCameraStream, setRecordingCameraStream] = useState<MediaStream | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingMicTrackRef = useRef<MediaStreamTrack | null>(null);
  const recordingCameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Backup system refs
  const sessionIdRef = useRef<string>("");
  const backupIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mimeTypeRef = useRef<string>("video/webm");

  // Check for unsaved recordings on mount
  useEffect(() => {
    const checkBackupRecordings = async () => {
      try {
        const sessions = await getAllBackupSessions();
        if (sessions.length > 0) {
          // Found unsaved recording(s)
          for (const sessionId of sessions) {
            const backup = await getBackupRecording(sessionId);
            if (backup && backup.blob.size > 1024) {
              toast.info("Found unsaved recording from previous session", {
                duration: 10000,
                action: {
                  label: "Download",
                  onClick: async () => {
                    const fileName = `recovered-recording-${sessionId}.webm`;
                    downloadBlob(backup.blob, fileName);
                    await clearBackupRecording(sessionId);
                    toast.success("Recording downloaded!");
                  },
                },
              });
            } else {
              // Clear invalid backup
              await clearBackupRecording(sessionId);
            }
          }
        }
      } catch (err) {
        console.warn("Failed to check backup recordings:", err);
      }
    };

    checkBackupRecordings();
  }, []);

  const cleanupRecordingMedia = useCallback(() => {
    // Clear backup interval
    if (backupIntervalRef.current) {
      clearInterval(backupIntervalRef.current);
      backupIntervalRef.current = null;
    }

    // Clear duration interval
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    setRecordingDuration(0);

    // Clear canvas animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Clean up canvas stream
    canvasStreamRef.current?.getTracks().forEach((track) => track.stop());
    canvasStreamRef.current = null;
    canvasRef.current = null;

    // Clean up recording mic
    if (recordingMicTrackRef.current) {
      recordingMicTrackRef.current.stop();
      recordingMicTrackRef.current = null;
    }

    // Clean up recording camera
    if (recordingCameraTrackRef.current) {
      recordingCameraTrackRef.current.stop();
      recordingCameraTrackRef.current = null;
    }
    setRecordingCameraStream(null);
    setIsRecordingCameraOn(false);
    setIsRecordingMicOn(true);

    recordedChunksRef.current = [];
    mediaRecorderRef.current = null;

    finalStreamRef.current?.getTracks().forEach((track) => track.stop());
    finalStreamRef.current = null;

    screenStreamRef.current?.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (err) {
        console.warn("Failed to stop screen track:", err);
      }
    });
    screenStreamRef.current = null;
    setRecordingPreviewStream(null);

    auxiliaryTracksRef.current.forEach((track) => {
      try {
        track.stop();
      } catch (err) {
        console.warn("Failed to stop auxiliary track:", err);
      }
    });
    auxiliaryTracksRef.current = [];

    // Disconnect all peer audio source nodes
    peerAudioSourcesRef.current.forEach((sourceNode) => {
      try {
        sourceNode.disconnect();
      } catch (e) {
        console.warn("[useRecording] Cleanup: failed to disconnect peer audio:", e);
      }
    });
    peerAudioSourcesRef.current.clear();
    audioDestinationRef.current = null;

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
  }, []);

  const finalizeRecordingState = useCallback(() => {
    setIsRecording(false);
    updatePeerState(me, { isRecording: false });
    connectSocket().emit("workspace:recording-state", { isRecording: false });
    isStoppingRef.current = false;
  }, [me, updatePeerState]);

  // Store camera bubble position for compositing
  const cameraBubblePositionRef = useRef({ x: 20, y: 0, size: 150 });

  // Update camera bubble position (called from component)
  const updateCameraBubblePosition = useCallback((x: number, y: number, size: number) => {
    cameraBubblePositionRef.current = { x, y, size };
  }, []);

  // Ref for camera video element used in compositing
  const cameraVideoElementRef = useRef<HTMLVideoElement | null>(null);

  // Create canvas-based compositing stream that combines screen + camera bubble
  const createCompositedStream = useCallback((
    screenTrack: MediaStreamTrack,
    initialCameraStream: MediaStream | null
  ): { stream: MediaStream; cleanup: () => void } => {
    // Create canvas for compositing
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    // Get screen dimensions from track settings
    const screenSettings = screenTrack.getSettings();
    canvas.width = screenSettings.width || 1920;
    canvas.height = screenSettings.height || 1080;

    canvasRef.current = canvas;

    // Create video elements for screen and camera
    const screenVideo = document.createElement("video");
    screenVideo.srcObject = new MediaStream([screenTrack]);
    screenVideo.muted = true;
    screenVideo.play().catch(console.error);

    // Create camera video element (will be updated dynamically)
    const cameraVideo = document.createElement("video");
    cameraVideo.muted = true;
    cameraVideoElementRef.current = cameraVideo;

    if (initialCameraStream) {
      cameraVideo.srcObject = initialCameraStream;
      cameraVideo.play().catch(console.error);
    }

    // Animation loop for compositing
    const drawFrame = () => {
      if (!canvasRef.current) return;

      // Draw screen
      ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);

      // Draw camera bubble if active (check ref for current state)
      if (recordingCameraTrackRef.current && cameraVideoElementRef.current?.srcObject) {
        const pos = cameraBubblePositionRef.current;
        const bubbleSize = pos.size;

        // Calculate position relative to canvas (screen coordinates to canvas coordinates)
        const scaleX = canvas.width / window.innerWidth;
        const scaleY = canvas.height / window.innerHeight;
        const x = pos.x * scaleX;
        const y = pos.y * scaleY;
        const scaledSize = bubbleSize * Math.min(scaleX, scaleY);

        // Draw circular camera bubble
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + scaledSize / 2, y + scaledSize / 2, scaledSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        // Draw the camera video (mirrored)
        ctx.translate(x + scaledSize, y);
        ctx.scale(-1, 1);
        ctx.drawImage(cameraVideoElementRef.current, 0, 0, scaledSize, scaledSize);

        ctx.restore();

        // Draw border around bubble
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x + scaledSize / 2, y + scaledSize / 2, scaledSize / 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      animationFrameRef.current = requestAnimationFrame(drawFrame);
    };

    drawFrame();

    // Capture canvas as stream
    const canvasStream = canvas.captureStream(30);
    canvasStreamRef.current = canvasStream;

    const cleanup = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      screenVideo.srcObject = null;
      if (cameraVideoElementRef.current) {
        cameraVideoElementRef.current.srcObject = null;
        cameraVideoElementRef.current = null;
      }
    };

    return { stream: canvasStream, cleanup };
  }, []);

  const buildMixedAudioTrack = useCallback(
    (additionalStreams: MediaStream[] = []) => {
      if (typeof window === "undefined") {
        return null;
      }

      const AudioContextCtor =
        window.AudioContext || (window as any).webkitAudioContext;

      if (!AudioContextCtor) {
        alert("Audio recording is not supported in this browser.");
        return null;
      }

      const audioContext = new AudioContextCtor();
      audioContextRef.current = audioContext;
      const destination = audioContext.createMediaStreamDestination();
      audioDestinationRef.current = destination;

      const streams: MediaStream[] = [];
      if (localStream) {
        streams.push(localStream);
      }

      additionalStreams
        .filter((stream): stream is MediaStream => Boolean(stream))
        .forEach((stream) => streams.push(stream));

      let hasAudio = false;

      streams.forEach((stream) => {
        stream
          .getAudioTracks()
          .filter((track) => track.readyState === "live" && track.enabled)
          .forEach((track) => {
            hasAudio = true;
            const sourceStream = new MediaStream([track]);
            const source = audioContext.createMediaStreamSource(sourceStream);
            source.connect(destination);
          });
      });

      if (!hasAudio) {
        audioContext.close().catch(() => undefined);
        audioContextRef.current = null;
        return null;
      }

      const [mixedTrack] = destination.stream.getAudioTracks();
      if (!mixedTrack) {
        audioContext.close().catch(() => undefined);
        audioContextRef.current = null;
        return null;
      }

      auxiliaryTracksRef.current.push(mixedTrack);
      return mixedTrack;
    },
    [localStream]
  );

  const stopRecording = useCallback(() => {
    if (isStoppingRef.current) {
      return;
    }

    isStoppingRef.current = true;

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
        return;
      } catch (err) {
        console.error("Failed to stop MediaRecorder:", err);
      }
    }

    cleanupRecordingMedia();
    finalizeRecordingState();
  }, [cleanupRecordingMedia, finalizeRecordingState]);

  const startRecording = useCallback(async () => {
    if (isRecording) {
      return;
    }

    if (!localStream) {
      alert("You need to join a call before you can record.");
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: 30,
        },
        audio: true, // Request audio as well, if user allows it's higher quality
      });

      screenStreamRef.current = displayStream;
      setRecordingPreviewStream(displayStream);

      // Acquire a fresh mic stream for recording since localStream may have
      // had its audio tracks stopped/removed (mic off by default).
      let recordingMicStream: MediaStream | null = null;
      try {
        recordingMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const micTrack = recordingMicStream.getAudioTracks()[0];
        if (micTrack) {
          recordingMicTrackRef.current = micTrack;
        }
      } catch (micErr) {
        console.warn("[useRecording] Could not acquire mic for recording, continuing without:", micErr);
      }

      const additionalStreams = [displayStream];
      if (recordingMicStream) {
        additionalStreams.push(recordingMicStream);
      }

      const mixedAudioTrack = buildMixedAudioTrack(additionalStreams);

      if (!mixedAudioTrack) {
        alert("Unable to access audio inputs for recording.");
        recordingMicStream?.getTracks().forEach((track) => track.stop());
        displayStream.getTracks().forEach((track) => track.stop());
        cleanupRecordingMedia();
        finalizeRecordingState();
        return;
      }

      mixedAudioTrack.onended = () => {
        if (!isStoppingRef.current) {
          stopRecording();
        }
      };

      const videoTracks = displayStream.getVideoTracks();
      if (videoTracks.length === 0) {
        alert("Screen share did not provide a video track.");
        displayStream.getTracks().forEach((track) => track.stop());
        cleanupRecordingMedia();
        finalizeRecordingState();
        return;
      }

      videoTracks.forEach((track) => {
        const handleEnded = () => {
          if (!isStoppingRef.current) {
            stopRecording();
          }
        };
        track.addEventListener("ended", handleEnded, { once: true });
      });

      // Create composited stream that can include camera bubble
      const screenVideoTrack = videoTracks[0];
      const { stream: compositedStream } = createCompositedStream(
        screenVideoTrack,
        recordingCameraStream
      );

      const compositedVideoTracks = compositedStream.getVideoTracks();
      const finalStream = new MediaStream([...compositedVideoTracks, mixedAudioTrack]);
      finalStreamRef.current = finalStream;

      // ** FIX: Find a supported MIME type **
      const supportedMimeType = SUPPORTED_MIME_TYPES.find((type) =>
        MediaRecorder.isTypeSupported(type)
      );

      if (!supportedMimeType) {
        alert(
          "Your browser does not support the required video recording formats."
        );
        cleanupRecordingMedia();
        finalizeRecordingState();
        return;
      }

      console.log(`Using supported MIME type: ${supportedMimeType}`);

      // Generate unique session ID for backup
      const sessionId = `${mySpaceId}-${Date.now()}`;
      sessionIdRef.current = sessionId;
      mimeTypeRef.current = supportedMimeType;

      const recorder = new MediaRecorder(finalStream, {
        mimeType: supportedMimeType,
      });

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      // Start periodic backup every 30 seconds
      backupIntervalRef.current = setInterval(async () => {
        if (recordedChunksRef.current.length > 0) {
          console.log(`[Recording Backup] Saving ${recordedChunksRef.current.length} chunks to IndexedDB...`);
          await saveBackupChunks(sessionIdRef.current, recordedChunksRef.current, mimeTypeRef.current);
        }
      }, 30000);

      recorder.onstop = async () => {
        const chunks = recordedChunksRef.current;
        const fileName = `recording-${mySpaceId}-${Date.now()}.webm`;

        if (chunks.length > 0) {
          toast.info("Saving your recording to your Private Cabinet...");
          const blob = new Blob(chunks, { type: supportedMimeType });
          const orgId = localStorage.getItem("garage_org_id");

          if (!orgId) {
            toast.error("Organization ID not found - downloading locally...");
            downloadBlob(blob, fileName);
            toast.success(`Recording saved as ${fileName}`);
            await clearBackupRecording(sessionIdRef.current);
            cleanupRecordingMedia();
            finalizeRecordingState();
            return;
          }

          const formData = new FormData();
          const meetingTitle = `Recording ${new Date().toLocaleString()}`;
          formData.append("file", blob, fileName);
          formData.append("spaceId", mySpaceId);
          formData.append("meetingTitle", meetingTitle);

          try {
            const uploadResponse = await api<any>(
              `/cabinet/files/upload?organizationId=${orgId}`,
              {
                method: "POST",
                body: formData,
              },
              getToken()!
            );
            // Try multiple possible locations for the ID
            // Mongoose documents return _id, but it might also be serialized as id
            const fileId = uploadResponse?.data?._id || 
                          uploadResponse?.data?.id || 
                          uploadResponse?.data?._id?.toString() ||
                          uploadResponse?._id ||
                          uploadResponse?.id;
            console.log("Recording uploaded, fileId:", fileId, "Full Response:", JSON.stringify(uploadResponse, null, 2));
            toast.success("Recording saved to your Private Cabinet!");

            // Clear backup after successful upload
            await clearBackupRecording(sessionIdRef.current);

            // Auto-ask: enqueue a background Ask Cabinet request with a static prompt
            // Only attempt if blob has valid content (at least 1KB to ensure it's a real recording)
            const blobSize = blob.size;
            const isValidRecording = blobSize > 1024; // At least 1KB
            
            if (isValidRecording && fileId) {
              try {
                // Extract base MIME type for prompt generation
                const baseMimeType = supportedMimeType.split(";")[0].trim();
                const AUTO_PROMPT = generateAskCabinetPrompt(fileName, baseMimeType);
                // add a placeholder item to local storage and notify sidebar
                const askId = `auto-${Date.now()}`;
                const placeholder = {
                  id: askId,
                  question: AUTO_PROMPT,
                  fileName: fileName, // Include fileName
                  fileId: fileId, // Include fileId for asking questions
                  createdAt: Date.now(),
                } as any;
                console.log("Creating placeholder with fileId:", fileId);
                try {
                  const raw = localStorage.getItem("ask-cabinet-items") || "[]";
                  const list = JSON.parse(raw);
                  list.push(placeholder);
                  localStorage.setItem(
                    "ask-cabinet-items",
                    JSON.stringify(list.slice(-200))
                  );
                } catch {}
                window.dispatchEvent(
                  new CustomEvent("ask-cabinet:new", { detail: placeholder })
                );

                // fire and forget request to ask-cabinet
                // baseMimeType already extracted above
                (async () => {
                  try {
                    // Validate chunks before creating file
                    if (chunks.length === 0) {
                      console.warn("Skipping auto-ask: recording chunks are empty");
                      return;
                    }
                    
                    // Create a File object directly from chunks with correct MIME type
                    // This ensures multer receives the file with proper content-type header
                    const file = new File(chunks, fileName, { type: baseMimeType });
                    if (file.size === 0) {
                      console.warn("Skipping auto-ask: recording file is empty");
                      return;
                    }
                    
                    const form = new FormData();
                    form.append("file", file);
                    form.append("question", AUTO_PROMPT);
                    const res = await api<{ answer: string }>("/ask-cabinet", {
                      method: "POST",
                      body: form,
                    });
                    const answerItem = {
                      id: askId,
                      question: AUTO_PROMPT,
                      fileName: fileName, // Include fileName
                      fileId: fileId, // Include fileId for asking questions
                      answer: res?.answer || "",
                      createdAt: Date.now(),
                    } as any;
                    try {
                      const raw2 = localStorage.getItem("ask-cabinet-items") || "[]";
                      const list2 = JSON.parse(raw2);
                      const idx = list2.findIndex((x: any) => x.id === askId);
                      if (idx >= 0) list2[idx] = answerItem; else list2.push(answerItem);
                      localStorage.setItem(
                        "ask-cabinet-items",
                        JSON.stringify(list2.slice(-200))
                      );
                    } catch {}
                    window.dispatchEvent(
                      new CustomEvent("ask-cabinet:new", { detail: answerItem })
                    );
                  } catch (e) {
                    // Silently ignore background ask failures per spec
                    console.error("auto-ask failed", e);
                  }
                })();
              } catch {}
            }
          } catch (err) {
            console.error("Failed to upload recording:", err);

            // AUTO-DOWNLOAD: Automatically download the recording on failure
            toast.error("Upload failed - downloading recording locally...", {
              duration: 5000,
            });

            // Trigger automatic download
            downloadBlob(blob, fileName);
            toast.success(`Recording saved as ${fileName}`, {
              duration: 5000,
            });

            // Clear backup after download
            await clearBackupRecording(sessionIdRef.current);
          }
        }

        cleanupRecordingMedia();
        finalizeRecordingState();
      };

      // Start recording and capture data every second.
      recorder.start(1000);
      setIsRecording(true);
      updatePeerState(me, { isRecording: true });
      connectSocket().emit("workspace:recording-state", { isRecording: true });
    } catch (err) {
      console.error("Error starting recording:", err);
      // Don't show an alert for "Permission denied" errors, as they are common.
      if ((err as Error).name !== "NotAllowedError") {
        alert(
          "Could not start recording. Please check your screen share permissions."
        );
      }
      cleanupRecordingMedia();
      finalizeRecordingState();
    }
  }, [
    isRecording,
    localStream,
    buildMixedAudioTrack,
    cleanupRecordingMedia,
    finalizeRecordingState,
    stopRecording,
    updatePeerState,
    me,
    mySpaceId,
  ]);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Toggle recording mic (mutes/unmutes the mic track in the recording)
  const toggleRecordingMic = useCallback(() => {
    if (!isRecording) return;

    // Toggle the mic state - this affects whether local audio is included in the mix
    setIsRecordingMicOn((prev) => {
      const newState = !prev;
      // If we have a dedicated recording mic track, enable/disable it
      if (recordingMicTrackRef.current) {
        recordingMicTrackRef.current.enabled = newState;
      }
      // Also toggle the local stream audio track for the recording
      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = newState;
        }
      }
      return newState;
    });
  }, [isRecording, localStream]);

  // Toggle recording camera (starts/stops camera for picture-in-picture bubble)
  const toggleRecordingCamera = useCallback(async () => {
    if (!isRecording) return;

    if (isRecordingCameraOn) {
      // Turn off camera
      if (recordingCameraTrackRef.current) {
        recordingCameraTrackRef.current.stop();
        recordingCameraTrackRef.current = null;
      }
      // Clear the camera video element for compositing
      if (cameraVideoElementRef.current) {
        cameraVideoElementRef.current.srcObject = null;
      }
      setRecordingCameraStream(null);
      setIsRecordingCameraOn(false);
    } else {
      // Turn on camera
      try {
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 },
          },
          audio: false, // Audio is already handled by the recording mix
        });

        const cameraTrack = cameraStream.getVideoTracks()[0];
        if (cameraTrack) {
          recordingCameraTrackRef.current = cameraTrack;
          setRecordingCameraStream(cameraStream);
          setIsRecordingCameraOn(true);

          // Update the camera video element for compositing
          if (cameraVideoElementRef.current) {
            cameraVideoElementRef.current.srcObject = cameraStream;
            cameraVideoElementRef.current.play().catch(console.error);
          }

          // Handle camera track ending
          cameraTrack.onended = () => {
            recordingCameraTrackRef.current = null;
            if (cameraVideoElementRef.current) {
              cameraVideoElementRef.current.srcObject = null;
            }
            setRecordingCameraStream(null);
            setIsRecordingCameraOn(false);
          };
        }
      } catch (err) {
        console.error("Failed to get camera for recording:", err);
        toast.error("Could not access camera for recording");
      }
    }
  }, [isRecording, isRecordingCameraOn]);

  // Start duration timer when recording starts
  useEffect(() => {
    if (isRecording) {
      setRecordingDuration(0);
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      setRecordingDuration(0);
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    };
  }, [isRecording]);

  // Dynamic peer audio sync – connects/disconnects peer audio sources
  // as peers join, leave, or change during an active recording
  useEffect(() => {
    if (
      !isRecording ||
      !audioContextRef.current ||
      !audioDestinationRef.current
    ) {
      return;
    }

    const audioContext = audioContextRef.current;
    const destination = audioDestinationRef.current;

    if (audioContext.state === "suspended") {
      audioContext.resume().catch(console.warn);
    }
    if (audioContext.state === "closed") {
      return;
    }

    // Build the set of peers that SHOULD be connected right now
    const desiredPeerIds = new Set<string>();
    peers.forEach((peer, peerId) => {
      if (peer.spaceId === mySpaceId && peer.stream) {
        const hasLiveTrack = peer.stream
          .getAudioTracks()
          .some((t) => t.readyState === "live" && t.enabled);
        if (hasLiveTrack) {
          desiredPeerIds.add(peerId);
        }
      }
    });

    // Disconnect peers that are no longer desired
    peerAudioSourcesRef.current.forEach((sourceNode, peerId) => {
      if (!desiredPeerIds.has(peerId)) {
        try {
          sourceNode.disconnect();
        } catch (e) {
          console.warn(`[useRecording] Failed to disconnect peer ${peerId}:`, e);
        }
        peerAudioSourcesRef.current.delete(peerId);
      }
    });

    // Reconnect peers whose audio tracks have changed (ended/replaced)
    peerAudioSourcesRef.current.forEach((sourceNode, peerId) => {
      if (!desiredPeerIds.has(peerId)) return;
      const sourceMediaStream = (sourceNode as any)
        .mediaStream as MediaStream | undefined;
      if (sourceMediaStream) {
        const allLive = sourceMediaStream
          .getAudioTracks()
          .every((t) => t.readyState === "live" && t.enabled);
        if (!allLive) {
          try {
            sourceNode.disconnect();
          } catch (e) {
            console.warn(
              `[useRecording] Failed to disconnect stale peer ${peerId}:`,
              e
            );
          }
          peerAudioSourcesRef.current.delete(peerId);
        }
      }
    });

    // Connect peers that are desired but not yet connected
    desiredPeerIds.forEach((peerId) => {
      if (peerAudioSourcesRef.current.has(peerId)) return;

      const peer = peers.get(peerId);
      if (!peer?.stream) return;

      const liveTracks = peer.stream
        .getAudioTracks()
        .filter((t) => t.readyState === "live" && t.enabled);
      if (liveTracks.length === 0) return;

      try {
        const sourceStream = new MediaStream(liveTracks);
        const source = audioContext.createMediaStreamSource(sourceStream);
        source.connect(destination);
        peerAudioSourcesRef.current.set(peerId, source);
      } catch (e) {
        console.warn(`[useRecording] Failed to connect peer ${peerId}:`, e);
      }
    });
  }, [isRecording, peers, mySpaceId]);

  return {
    isRecording,
    toggleRecording,
    startRecording,
    stopRecording,
    recordingPreviewStream,
    // New: Recording-specific camera/mic controls
    isRecordingMicOn,
    isRecordingCameraOn,
    toggleRecordingMic,
    toggleRecordingCamera,
    recordingCameraStream,
    recordingDuration,
    updateCameraBubblePosition,
  };
}
