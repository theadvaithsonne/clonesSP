// Garage 2.0-frontend/lib/socket.ts

import { io, Socket } from "socket.io-client";
import { getToken, isAuthenticated } from "./auth";

let socket: Socket | null = null;
let guestSocket: Socket | null = null;

// Socket.IO reads a URL path as a namespace, not a mount point. The combined
// server serves the API under <origin>/backend but Socket.IO at
// <origin>/socket.io, so connect to the bare origin of NEXT_PUBLIC_API_URL.
// With a path-less URL (a standalone backend) this is the URL unchanged.
function socketOrigin(): string {
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  try {
    const base = typeof window !== "undefined" ? window.location.href : undefined;
    return new URL(api, base).origin;
  } catch {
    return api;
  }
}

export function getSocket() {
  if (socket) return socket;
  socket = io(socketOrigin(), {
    autoConnect: false,
  });
  return socket;
}

export function connectSocket() {
  // If socket exists and is connected or actively connecting, return it
  // socket.active is true when socket is connected OR trying to connect
  if (socket?.active) {
    return socket!;
  }

  // If socket exists but is fully disconnected, reconnect it
  // This preserves event listeners registered elsewhere (e.g., useDaily)
  if (socket) {
    console.log("[CLIENT] Socket exists but disconnected, reconnecting...");
    // Update auth token in case it changed
    socket.auth = { token: getToken() };
    socket.connect();
    return socket!;
  }

  // Only create a new socket if one doesn't exist at all
  socket = io(socketOrigin(), {
    autoConnect: false,
    // REMOVED the line: transports: ["polling"],
    path: "/socket.io",
  });
  socket.auth = { token: getToken() };
  socket.on("connect", () => console.log("[CLIENT] connected", socket!.id));
  socket.on("connect_error", (e) =>
    console.error("[CLIENT] connect_error", e.message)
  );
  socket.connect();
  return socket!;
}

// Guest socket connection using guest JWT token
export function connectGuestSocket(guestToken: string): Socket {
  if (guestSocket?.connected) return guestSocket;

  guestSocket = io(socketOrigin(), {
    autoConnect: false,
    path: "/socket.io",
  });
  guestSocket.auth = { token: guestToken };
  guestSocket.on("connect", () => console.log("[GUEST CLIENT] connected", guestSocket!.id));
  guestSocket.on("connect_error", (e) =>
    console.error("[GUEST CLIENT] connect_error", e.message)
  );
  guestSocket.connect();
  return guestSocket;
}

export function disconnectGuestSocket() {
  if (guestSocket) {
    guestSocket.disconnect();
    guestSocket = null;
  }
}

export function getGuestSocket(): Socket | null {
  return guestSocket;
}

// ── Dedicated Webinar socket (WebSocket-only, separate from workspace) ─────

let webinarSocket: Socket | null = null;

export function connectWebinarSocket(guestToken?: string): Socket {
  // Reuse if already connected
  if (webinarSocket?.connected) return webinarSocket;

  // Disconnect stale socket
  if (webinarSocket) {
    webinarSocket.removeAllListeners();
    webinarSocket.disconnect();
    webinarSocket = null;
  }

  // Fall back to the stored session ONLY while it is still valid. getToken()
  // returns whatever is in localStorage, so an expired token used to be sent
  // here and the server rejected the handshake with "Invalid token" — then
  // reconnected forever on the same dead token. No token at all fails fast
  // and legibly ("Missing auth") instead.
  const authToken = guestToken || (isAuthenticated() ? getToken() : null);

  webinarSocket = io(socketOrigin(), {
    auth: { token: authToken },
    transports: ["websocket"], // WebSocket only — required for ack callbacks
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    path: "/socket.io",
  });

  webinarSocket.on("connect", () => console.log("[WEBINAR SOCKET] connected", webinarSocket!.id));
  webinarSocket.on("connect_error", (e) => console.error("[WEBINAR SOCKET] connect_error", e.message));
  webinarSocket.connect();
  return webinarSocket;
}

export function disconnectWebinarSocket() {
  if (webinarSocket) {
    webinarSocket.removeAllListeners();
    if (webinarSocket.connected) webinarSocket.disconnect();
    webinarSocket = null;
  }
}

export function getWebinarSocket(): Socket | null {
  return webinarSocket;
}
