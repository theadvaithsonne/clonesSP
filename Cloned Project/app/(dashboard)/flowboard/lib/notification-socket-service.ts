// lib/notification-socket-service.ts
import { io, Socket } from 'socket.io-client';
import Cookies from 'js-cookie';

class NotificationSocketService {
  public socket: Socket | null = null;
  public connected = false;
  public connecting = false;
  public error: string | null = null;
  public socketId: string | null = null;

  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  public reconnecting = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private lastDisconnectTime: number | null = null;
  private userId: string | null = null;
  private readonly SOCKET_URL = "https://uatapi.garage.app";

  // Optionally accept userId directly from profile API result (_id)
  connect = (userIdFromProfile?: string) => {
    // Allow reconnection even if socket exists (will be cleaned up below)
    // Only prevent if already connected and not reconnecting
    if (this.socket && this.connected && !this.reconnecting) {
      return;
    }

    let token: string | null = null;

    if (typeof window !== 'undefined') {
      // Prefer localStorage (matches chat socket) and fall back to cookie
      token = localStorage.getItem('auth-token') || Cookies.get('auth-token') || null;
    }

    // Cache userId from explicit param so reconnects can reuse it
    if (userIdFromProfile) {
      this.userId = userIdFromProfile;
    }

    if (!token) {
      this.error = 'No authentication token found';
      console.warn('[Notification Socket] Cannot connect: No authentication token found');
      this.notifyListeners('auth_error', 'No token');
      return;
    }

    this.connecting = true;
    this.reconnecting = false;
    this.error = null;

    // Fully disconnect and clean up old socket to establish fresh connection
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    // Clear any pending manual reconnect
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    console.log('[Notification Socket] Connecting...', { userId: this.userId, url: this.SOCKET_URL });

    this.socket = io(`${this.SOCKET_URL}/notifications`, {
      path: '/flowboard/socket/',
      auth: { token },
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true,
      query: {
        userId: this.userId ?? undefined,
        // user's userId passed directly from profile API result (_id)
      },

      // Enable smart auto-reconnect
      reconnection: false, // We handle reconnection manually
    });

    // === Socket Events ===

    // Example custom event from server: "your-id"
    // This will fire any time the server emits "your-id" to this socket
    this.socket.on('your-id', (payload: any) => {
      console.log('🔔 Notification socket event "your-id" received:', payload);
      this.socketId = payload; // Store the socket ID
      this.notifyListeners('your-id', payload);
    });

    this.socket.on('connect', () => {
      console.log('✅ Notification Socket.IO connected successfully');
      this.connected = true;
      this.connecting = false;
      this.reconnecting = false;
      this.error = null;
      this.lastDisconnectTime = null;
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      this.notifyListeners('connected');
      this.notifyListeners('reconnected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Notification Socket disconnected:', reason);
      const wasConnected = this.connected;
      this.connected = false;
      this.connecting = false;
      this.socketId = null;

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

      // Fallback manual reconnect in case socket.io stops retrying
      if (reason !== 'io client disconnect') {
        this.scheduleReconnect();
      }
    });

    this.socket.on("board:created", (payload) => {
      console.log("[BoardSocket] board:created received", payload);
    });

    this.socket.on('connect_error', (err) => {
      console.error('❌ Notification Socket.IO connection error:', err);
      this.error = err.message || 'Connection failed';
      this.connecting = false;
      this.reconnecting = true;
      this.notifyListeners('connect_error', err);
      this.scheduleReconnect();
    });

    // Handle reconnection attempts (internal socket.io events, mostly unused with reconnection: false)
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
      this.scheduleReconnect(2000);
    });

    this.socket.on('error', (data: { message: string }) => {
      console.error('❌ Notification Socket.IO error:', data);
      this.error = data.message;
      this.notifyListeners('error', data);
    });

    // Forward all events to listeners
    this.socket.onAny((event, ...args) => {
      this.notifyListeners(event, ...args);
    });
  };

  disconnect = () => {
    console.log('🔌 Manually disconnecting Notification Socket.IO');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.connected = false;
    this.connecting = false;
    this.reconnecting = false;
    this.socketId = null;
    this.lastDisconnectTime = null;
  };

  private notifyListeners = (event: string, ...args: any[]) => {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in listener for event '${event}':`, error);
        }
      });
    }
  };

  public on = (event: string, handler: (...args: any[]) => void) => {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  };

  public off = (event: string, handler?: (...args: any[]) => void) => {
    if (handler) {
      this.listeners.get(event)?.delete(handler);
    } else {
      this.listeners.delete(event);
    }
  };

  public emit = (event: string, data?: any) => {
    if (this.socket && this.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn(`[Notification Socket] Cannot emit '${event}': not connected`);
    }
  };

  private scheduleReconnect = (delayMs: number = 3000) => {
    if (this.reconnectTimeout || this.connecting || this.connected) {
      console.log('[Notification Socket] Reconnect check: already connecting/connected or pending.', { connecting: this.connecting, connected: this.connected });
      return;
    }

    console.log(`[Notification Socket] Scheduling reconnect in ${delayMs}ms...`);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (!this.connected && !this.connecting) {
        // Fully disconnect and clean up old socket before establishing new connection
        if (this.socket) {
          this.socket.removeAllListeners();
          this.socket.disconnect();
          this.socket = null;
        }
        // Establish a fresh new connection
        console.log('[Notification Socket] Establishing new connection for reconnection...');
        this.connect(this.userId || undefined);
      }
    }, delayMs);
  };
}

export const notificationSocketService = new NotificationSocketService();

