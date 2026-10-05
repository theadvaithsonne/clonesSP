// lib/socket-service.ts
import { io, Socket } from 'socket.io-client';
import Cookies from 'js-cookie';

class ChatSocketService {
  public socket: Socket | null = null;
  public connected = false;
  public connecting = false;
  public error: string | null = null;

  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private reconnecting = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastDisconnectTime: number | null = null;
  private readonly SOCKET_URL = "https://uatapi.garage.app";

  connect = () => {
    // Only prevent if already connected or actively connecting (not if just reconnecting)
    if (this.socket && (this.connected || this.connecting)) {
      return;
    }

    let token: string | null = null;
    if (typeof window !== 'undefined') {
      token = localStorage.getItem('auth-token') || Cookies.get('auth-token') || null;
    }

    if (!token) {
      this.error = 'No authentication token found';
      this.notifyListeners('auth_error', 'No token');
      return;
    }

    this.connecting = true;
    this.reconnecting = false;
    this.error = null;

    // Close any existing socket
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    this.socket = io(`${this.SOCKET_URL}/chat`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true,

      // Enable smart auto-reconnect
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
    });

    // === Socket Events ===
    this.socket.on('connect', () => {
      this.connected = true;
      this.connecting = false;
      this.reconnecting = false;
      this.error = null;
      this.lastDisconnectTime = null;
      this.notifyListeners('connected');
      this.notifyListeners('reconnected'); // Custom event
    });

    this.socket.on('disconnect', (reason) => {
      const wasConnected = this.connected;
      this.connected = false;
      this.connecting = false;

      if (reason === 'io client disconnect') {
        this.reconnecting = false;
        this.lastDisconnectTime = null;
      } else {
        this.reconnecting = true;
        this.lastDisconnectTime = Date.now();
      }

      this.notifyListeners('disconnected', reason);

      // Only notify reconnecting if it wasn't intentional
      if (wasConnected && reason !== 'io client disconnect') {
        this.notifyListeners('reconnecting', reason);
      }
    });

    this.socket.on('connect_error', (err) => {
      this.error = err.message || 'Connection failed';
      this.connecting = false;
      this.reconnecting = true;
      this.notifyListeners('connect_error', err);
    });

    // Handle reconnection attempts
    this.socket.on('reconnect_attempt', (attemptNumber) => {
      this.reconnecting = true;
      this.notifyListeners('reconnect_attempt', attemptNumber);
    });

    // Handle successful reconnection
    this.socket.on('reconnect', (attemptNumber) => {
      this.reconnecting = false;
      this.notifyListeners('reconnect', attemptNumber);
    });

    // Handle reconnection failure - force manual reconnect
    this.socket.on('reconnect_failed', () => {
      this.reconnecting = false;
      this.notifyListeners('reconnect_failed');
      // Force a new connection attempt after a delay
      setTimeout(() => {
        if (!this.connected && !this.connecting) {
          this.connect();
        }
      }, 2000);
    });

    this.socket.on('error', (data: { message: string }) => {
      this.error = data.message;
      this.notifyListeners('error', data);
    });

    // Forward all events to listeners
    this.socket.onAny((event, ...args) => {
      this.notifyListeners(event, ...args);
    });

    // Start health check to ensure reconnection continues
    this.startHealthCheck();
  };

  disconnect = () => {
    this.stopHealthCheck();
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
    this.connecting = false;
    this.reconnecting = false;
  };

  private startHealthCheck = () => {
    this.stopHealthCheck();
    // Check every 15 seconds if we should be reconnecting
    this.healthCheckInterval = setInterval(() => {
      if (!this.connected && !this.connecting && this.socket && this.lastDisconnectTime) {
        // If we've been disconnected for more than 30 seconds, force a reconnect
        const timeSinceDisconnect = Date.now() - this.lastDisconnectTime;
        if (timeSinceDisconnect > 30000) {
          // Check if Socket.IO is actually trying to reconnect
          const manager = (this.socket as any).io;
          const isSocketReconnecting = manager?.reconnecting || false;
          
          if (!isSocketReconnecting) {
            // Socket.IO stopped trying to reconnect, force a new connection
            console.log('[Socket] Health check: Socket.IO stopped reconnecting after 30s, forcing reconnect');
            this.reconnecting = false; // Reset flag to allow reconnection
            this.lastDisconnectTime = null; // Reset to prevent immediate retry
            this.connect();
          }
        }
      }
    }, 15000);
  };

  private stopHealthCheck = () => {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  };

  // Reconnect manually (e.g. after token refresh)
  reconnect = () => {
    this.disconnect();
    setTimeout(() => this.connect(), 100);
  };

  on = (event: string, handler: (...args: any[]) => void) => {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    // Re-attach to socket if already connected
    if (this.socket && (this.connected || this.connecting)) {
      this.socket.on(event, handler);
    }
  };

  off = (event: string, handler?: (...args: any[]) => void) => {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) return;

    if (handler) {
      eventListeners.delete(handler);
      this.socket?.off(event, handler);
    } else {
      eventListeners.clear();
      this.socket?.off(event);
    }

    if (eventListeners.size === 0) {
      this.listeners.delete(event);
    }
  };

  emit = (event: string, data?: any) => {
    if (this.socket && this.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn(`[Socket] Cannot emit '${event}': not connected`);
    }
  };

  private notifyListeners = (event: string, ...args: any[]) => {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (err) {
          console.error(`Error in listener for ${event}:`, err);
        }
      });
    }
  };

  // Helper: Is currently trying to reconnect?
  get isReconnecting() {
    return this.reconnecting;
  }
}

// Singleton
export const socketService = new ChatSocketService();

// Auto-connect on import (client-side only)
if (typeof window !== 'undefined') {
  // Delay slightly to avoid race with auth
  setTimeout(() => socketService.connect(), 0);
}