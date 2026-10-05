// Garage 2.0-frontend/lib/webrtc-context.tsx

"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { connectSocket } from "./socket";
import { getUserIdFromToken } from "./auth";
 

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    // Free TURN servers for better connectivity with remote users
    { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
    // Backup TURN servers
    { urls: "turn:freeturn.tel:3478", username: "free", credential: "free" },
    { urls: "turn:freeturn.tel:3478?transport=tcp", username: "free", credential: "free" },
  ],
};

type CallType = 'audio' | 'video';

type IncomingCall = {
  from: string;
  offer: RTCSessionDescriptionInit;
  callType: CallType;
};

type WebRTCContextType = {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  inCall: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  incomingCall: IncomingCall | null;
  callPartnerId: string | null;
  callType: CallType | null;
  startCall: (partnerId: string, callType: CallType) => void;
  endCall: () => void;
  answerCall: () => void;
  declineCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
};

const WebRTCContext = createContext<WebRTCContextType | null>(null);

export const useWebRTC = () => {
  const context = useContext(WebRTCContext);
  if (!context) {
    throw new Error("useWebRTC must be used within a WebRTCProvider");
  }
  return context;
};

export const WebRTCProvider = ({ children }: { children: React.ReactNode }) => {
  const me = getUserIdFromToken();

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [inCall, setInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [callPartnerId, setCallPartnerId] = useState<string | null>(null);
  const [callType, setCallType] = useState<CallType | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const remoteStreamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    console.log("WebRTC: Cleaning up peer connection and streams.");
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setInCall(false);
    setIncomingCall(null);
    setCallPartnerId(null);
    setCallType(null);
  }, [localStream]);

  const endCall = useCallback(() => {
    const socket = connectSocket();
    if (callPartnerId && callType) {
      const eventPrefix = callType === 'audio' ? 'audio' : 'video';
      console.log(`WebRTC: Emitting ${eventPrefix}:call-ended to ${callPartnerId}`);
      socket.emit(`${eventPrefix}:call-ended`, { to: callPartnerId });
    }
    // Emit status change to available when ending a call
    socket.emit("workspace:status-change", { status: "available" });
    cleanup();
  }, [callPartnerId, callType, cleanup]);

  // ===================================================================
  // THE FIX IS HERE: Using a functional update for setRemoteStream
  // ===================================================================
  const createPeerConnection = useCallback((partnerId: string, callType: CallType) => {
    console.log("WebRTC: Creating new RTCPeerConnection.");
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`WebRTC: Sending ICE candidate to ${partnerId}`);
        const eventPrefix = callType === 'audio' ? 'audio' : 'video';
        connectSocket().emit(`${eventPrefix}:ice-candidate`, {
          to: partnerId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`WebRTC: Connection state changed to ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        console.log("WebRTC: Connection failed or closed, cleaning up");
        if (remoteStreamRef.current) {
          remoteStreamRef.current.getTracks().forEach((track) => track.stop());
          remoteStreamRef.current = null;
        }
        cleanup();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`WebRTC: ICE connection state changed to ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed') {
        console.error('WebRTC: ICE connection failed - this usually indicates network/firewall issues');
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log(`WebRTC: ICE gathering state changed to ${pc.iceGatheringState}`);
    };

    pc.ontrack = (event) => {
      console.log("WebRTC: Received remote track event.", event.track.kind, event.track.label, event.streams);
      
      // Create or get a merged stream for all tracks
      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
      }
      
      const mergedStream = remoteStreamRef.current;
      const track = event.track;
      
      // Check if track already exists in the stream (by kind and id)
      const existingTrackOfSameKind = mergedStream.getTracks().find(
        t => t.kind === track.kind
      );
      
      if (existingTrackOfSameKind && existingTrackOfSameKind.id !== track.id) {
        // Replace existing track of same kind
        mergedStream.removeTrack(existingTrackOfSameKind);
      }
      
      if (!mergedStream.getTracks().find(t => t.id === track.id)) {
        // Add the new track to the merged stream
        mergedStream.addTrack(track);
        console.log(`WebRTC: Added ${track.kind} track to merged stream. Total tracks:`, mergedStream.getTracks().map(t => `${t.kind}:${t.id.slice(0, 8)}`));
        
        // Create a new MediaStream object to trigger React re-render
        setRemoteStream(new MediaStream(mergedStream.getTracks()));
      }
      
      // Handle track ended
      track.onended = () => {
        console.log(`WebRTC: Track ${track.kind} ended`);
        mergedStream.removeTrack(track);
        if (mergedStream.getTracks().length === 0) {
          remoteStreamRef.current = null;
          setRemoteStream(null);
        } else {
          setRemoteStream(new MediaStream(mergedStream.getTracks()));
        }
      };
      
      // Handle track mute/unmute
      track.onmute = () => {
        console.log(`WebRTC: Track ${track.kind} muted`);
        setRemoteStream(new MediaStream(mergedStream.getTracks()));
      };
      
      track.onunmute = () => {
        console.log(`WebRTC: Track ${track.kind} unmuted`);
        setRemoteStream(new MediaStream(mergedStream.getTracks()));
      };
    };

    return pc;
  }, [cleanup]); // Include cleanup in dependencies
  // ===================================================================
  // END OF FIX
  // ===================================================================

  const startCall = useCallback(
    async (partnerId: string, callType: CallType) => {
      try {
        console.log(`WebRTC: Starting ${callType} call to ${partnerId}`);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callType === 'video',
          audio: true,
        });
        setLocalStream(stream);
        setCallPartnerId(partnerId);
        setCallType(callType);
        setInCall(true);

        // Emit status change to busy when starting a call
        connectSocket().emit("workspace:status-change", { status: "busy" });

        const pc = createPeerConnection(partnerId, callType);
        peerConnection.current = pc;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const eventPrefix = callType === 'audio' ? 'audio' : 'video';
        console.log(`WebRTC: Emitting ${eventPrefix}:call-user to ${partnerId}`);
        connectSocket().emit(`${eventPrefix}:call-user`, { to: partnerId, offer, callType });
      } catch (error) {
        console.error("WebRTC: Error starting call:", error);
        cleanup();
      }
    },
    [createPeerConnection, cleanup]
  );

  const answerCall = useCallback(async () => {
    if (!incomingCall) return;
    console.log(`WebRTC: Answering ${incomingCall.callType} call from ${incomingCall.from}`);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: incomingCall.callType === 'video',
        audio: true,
      });
      setLocalStream(stream);

      setCallPartnerId(incomingCall.from);
      setCallType(incomingCall.callType);
      setInCall(true);
      // Emit status change to busy when answering a call
      connectSocket().emit("workspace:status-change", { status: "busy" });
      const callerId = incomingCall.from;
      const callType = incomingCall.callType;
      setIncomingCall(null);

      const pc = createPeerConnection(callerId, callType);
      peerConnection.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(
        new RTCSessionDescription(incomingCall.offer)
      );
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const eventPrefix = callType === 'audio' ? 'audio' : 'video';
      console.log(`WebRTC: Emitting ${eventPrefix}:call-answered to ${callerId}`);
      connectSocket().emit(`${eventPrefix}:call-answered`, {
        to: callerId,
        answer,
      });

    } catch (error) {
      console.error("WebRTC: Error answering call:", error);
      cleanup();
    }
  }, [incomingCall, createPeerConnection, cleanup]);

  const declineCall = useCallback(() => {
    if (incomingCall) {
      console.log(`WebRTC: Declining ${incomingCall.callType} call from ${incomingCall.from}`);
      const eventPrefix = incomingCall.callType === 'audio' ? 'audio' : 'video';
      connectSocket().emit(`${eventPrefix}:call-declined`, { to: incomingCall.from });
      setIncomingCall(null);
    }
  }, [incomingCall]);

  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        console.log(
          `WebRTC: Audio ${audioTrack.enabled ? "unmuted" : "muted"}.`
        );
      }
    }
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
        console.log(
          `WebRTC: Video ${videoTrack.enabled ? "enabled" : "disabled"}.`
        );
      }
    }
  }, [localStream]);

  useEffect(() => {
    const socket = connectSocket();

    const handleIncomingCall = (data: IncomingCall) => {
      // Be resilient if backend didn't include callType (older clients)
      const normalizedCallType: 'audio' | 'video' = (data as any)?.callType === 'audio' ? 'audio' : 'video';
      if (inCall) {
        console.log("WebRTC: Ignoring incoming call, already in a call.");
        const eventPrefix = normalizedCallType === 'audio' ? 'audio' : 'video';
        socket.emit(`${eventPrefix}:call-declined`, { to: data.from });
        return;
      }
      console.log(`WebRTC: Received ${normalizedCallType}:incoming-call from ${data.from}`);
      setIncomingCall({ ...data, callType: normalizedCallType });
    };

    const handleCallAccepted = async ({ answer }: { answer: any }) => {
      if (peerConnection.current) {
        console.log(
          "WebRTC: Received call-accepted, setting remote description."
        );
        await peerConnection.current.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
      }
    };

    const handleIceCandidate = (data: { candidate: any }) => {
      if (peerConnection.current && data.candidate) {
        console.log("WebRTC: Received and adding ICE candidate.");
        peerConnection.current.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
      }
    };

    const handleCallEnded = () => {
      console.log("WebRTC: Received call-ended signal.");
      // Emit status change to available when call ends
      socket.emit("workspace:status-change", { status: "available" });
      cleanup();
    };
    const handleCallDeclined = () => {
      console.log("WebRTC: Received call-declined signal.");
      // Emit status change to available when call is declined
      socket.emit("workspace:status-change", { status: "available" });
      cleanup();
    };

    // Listen for both audio and video call events
    socket.on("audio:incoming-call", handleIncomingCall);
    socket.on("video:incoming-call", handleIncomingCall);
    socket.on("audio:call-accepted", handleCallAccepted);
    socket.on("video:call-accepted", handleCallAccepted);
    socket.on("audio:ice-candidate", handleIceCandidate);
    socket.on("video:ice-candidate", handleIceCandidate);
    socket.on("audio:call-ended", handleCallEnded);
    socket.on("video:call-ended", handleCallEnded);
    socket.on("audio:call-declined", handleCallDeclined);
    socket.on("video:call-declined", handleCallDeclined);

    return () => {
      socket.off("audio:incoming-call", handleIncomingCall);
      socket.off("video:incoming-call", handleIncomingCall);
      socket.off("audio:call-accepted", handleCallAccepted);
      socket.off("video:call-accepted", handleCallAccepted);
      socket.off("audio:ice-candidate", handleIceCandidate);
      socket.off("video:ice-candidate", handleIceCandidate);
      socket.off("audio:call-ended", handleCallEnded);
      socket.off("video:call-ended", handleCallEnded);
      socket.off("audio:call-declined", handleCallDeclined);
      socket.off("video:call-declined", handleCallDeclined);
    };
  }, [inCall, cleanup]);

  return (
    <WebRTCContext.Provider
      value={{
        localStream,
        remoteStream,
        inCall,
        isMuted,
        isVideoOff,
        incomingCall,
        callPartnerId,
        callType,
        startCall,
        endCall,
        answerCall,
        declineCall,
        toggleMute,
        toggleVideo,
      }}
    >
      {children}
    </WebRTCContext.Provider>
  );
};
