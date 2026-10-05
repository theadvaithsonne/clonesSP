import { io, Socket } from 'socket.io-client';
import Cookies from 'js-cookie';

interface SocketService {
  socket: Socket | null;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler: (...args: any[]) => void) => void;
  emit: (event: string, data?: any) => void;
}

class ChatSocketService implements SocketService {
  public socket: Socket | null = null;
  public connected: boolean = false;
  public connecting: boolean = false;
  public error: string | null = null;

  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private reconnectTimeout: NodeJS.Timeout | null = null;

  private SOCKET_URL = "https://uatapi.garage.app";

  public connect = () => {
    // Don't create multiple connections
    if (this.socket && (this.connected || this.connecting)) {
      console.log('🔌 Socket already connected or connecting, skipping');
      return;
    }

    // Get auth token
    let token: string | null = null;

    if (typeof window !== "undefined") {
      token = localStorage.getItem("auth-token");
    }

    if (!token) {
      token = localStorage.getItem("garage_tok") || null;
    }

    console.log('🔌 Socket.IO connection attempt:');
    console.log('  - SOCKET_URL:', this.SOCKET_URL);
    console.log('  - Token found:', token ? 'YES' : 'NO');

    if (!token) {
      this.error = 'No authentication token found';
      console.error('❌ No authentication token found for Socket.IO connection');
      return;
    }

    this.connecting = true;
    this.error = null;

    console.log('🔌 Creating Socket.IO connection to:', `${this.SOCKET_URL}/chat`);

    // Disconnect existing socket if any
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(`${this.SOCKET_URL}/chat`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      timeout: 5000,
      reconnection: false, // We'll handle reconnection manually
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket.IO connected successfully');
      this.connected = true;
      this.connecting = false;
      this.error = null;
      this.notifyListeners('connected', null);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket.IO disconnected, reason:', reason);
      this.connected = false;
      this.connecting = false;
      this.notifyListeners('disconnected', reason);

      // Auto-reconnect after 3 seconds unless manually disconnected
      if (reason !== 'io client disconnect' && !this.reconnectTimeout) {
        console.log('🔄 Auto-reconnecting in 3 seconds...');
        this.reconnectTimeout = setTimeout(() => {
          this.reconnectTimeout = null;
          this.connect();
        }, 3000);
      }
    });

    this.socket.on('connect_error', (err) => {
      console.error('❌ Socket.IO connection error:', err);
      this.connecting = false;
      this.error = err.message || 'Connection failed';
      this.notifyListeners('connect_error', err);
    });

    this.socket.on('error', (data: { message: string }) => {
      console.error('❌ Socket.IO error:', data);
      this.error = data.message;
      this.notifyListeners('error', data);
    });

    // Forward all events to listeners
    this.socket.onAny((event, ...args) => {
      this.notifyListeners(event, ...args);
    });
  };

  public disconnect = () => {
    console.log('🔌 Manually disconnecting Socket.IO');

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.connected = false;
    this.connecting = false;
  };

  public on = (event: string, handler: (...args: any[]) => void) => {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    // Also listen directly on socket if available
    if (this.socket) {
      this.socket.on(event, handler);
    }
  };

  public off = (event: string, handler: (...args: any[]) => void) => {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(handler);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }

    // Also remove from socket if available
    if (this.socket) {
      this.socket.off(event, handler);
    }
  };

  public emit = (event: string, data?: any) => {
    if (this.socket && this.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('⚠️ Cannot emit event, socket not connected:', event);
    }
  };

  private notifyListeners = (event: string, ...args: any[]) => {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  };
}

// Create singleton instance
export const socketService = new ChatSocketService();

// Auto-connect on module load (client-side only)
if (typeof window !== 'undefined') {
  socketService.connect();
}