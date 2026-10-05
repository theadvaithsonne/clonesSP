import { io, Socket } from "socket.io-client";


class TimeSocketService {
  public socket: Socket | null = null;
  public connected = false;
  public connecting = false;
  public reconnecting = false;
  public error: string | null = null;
  public socketId: string | null = null;

  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private userId: string | null = null;
  private boardId: string | null = null;

  // You can replace this with your env var (e.g. NEXT_PUBLIC_SOCKET_URL)
  private readonly SOCKET_URL =
    "https://uatapi.garage.app";

  connect = (userId: string, boardId: string) => {
    // Allow reconnection even if socket exists (will be cleaned up below)
    // Only prevent if already connected and not reconnecting
    if (this.socket && this.connected && !this.reconnecting) {
      return;
    }

    this.userId = userId;
    this.boardId = boardId;
    this.connecting = true;
    this.reconnecting = false;
    this.error = null;

    // Fully disconnect and clean up old socket to establish fresh connection
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // This matches your requested connection:
    // const socket_client = io.connect("ws://localhost:4790/notifications", {
    //   path: "/boards/socket/",
    //   query: { userId, boardId },
    // });
    this.socket = io(`${this.SOCKET_URL}/tasks`, {
      path: "/taskroomv2/socket/",
      transports: ["websocket", "polling"],
      timeout: 10000,
      forceNew: true,
      query: {
        userId: this.userId ?? undefined,
        taskId: this.boardId ?? undefined,
      },
      reconnection: false,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
    });

    this.socket.on("connect", () => {
      this.connected = true;
      this.connecting = false;
      this.reconnecting = false;
      this.error = null;
      this.notifyListeners("connected");
    });
    this.socket.on('your-id', (payload: any) => {
      console.log('234234345345', payload);
      this.socketId = payload;
      this.notifyListeners('your-id', payload);
    });

    // Explicit listeners for verification/logging
    // this.socket.on("comment:created", (payload) => {
    //   console.log("[BoardSocket] comment:created received", payload);
    //   // onAny handles notification, or we can explicit notify if we remove onAny. 
    //   // Since onAny exists, we just log here.
    // });


    this.socket.on("comment:updated", (payload) => {
      console.log("[BoardSocket] comment:updated received", payload);
    });
    this.socket.on("comment:deleted", (payload) => {
      console.log("[BoardSocket] comment:deleted received", payload);
    });

    // this.socket.on("task:created", (payload: any) => {
    //   console.log("[BoardSocket] task:created received", payload);
    //   if (payload?.data) {
    //     useTaskStore.getState().addTaskFromSocket(payload.data);
    //   }
    // });
    this.socket.on("task:updated", (payload: any) => {
      console.log("[BoardSocket] task:updated received", payload);
      const updateData = payload?.data || payload;
    //   if (updateData && updateData._id) {
    //     useTaskStore.getState().updateTaskFromSocket(updateData);
    //   }
    });
    this.socket.on("task:deleted", (payload: any) => {
      console.log("[BoardSocket] task:deleted received", payload);
    });

    // this.socket.on("checklist:created", (payload: any) => {
    //   console.log("[BoardSocket] checklist:created received", payload);
    //   // Expected payload: { checklist: { _id, taskId, ... }, taskObj: { ... } }
    //   const item = payload?.checklist;
    //   const data = payload?.taskObj
    //   if (item && item._id && item.taskId) {
    //     useTaskStore.getState().addChecklistItemFromSocket(item, data);
    //     useChecklistStore.getState().addChecklistItemFromSocket(item);
    //   }
    // });



    // this.socket.on("checklist:deleted", (payload) => {
    //   console.log("[BoardSocket] checklist:deleted received", payload);
    //   const checklistId = payload?.checklistId || payload?._id || payload;
    //   const taskId = payload?.taskId; // Often needed for taskStore updates
    //   if (checklistId) {
    //     useTaskStore.getState().deleteChecklistItemFromSocket(checklistId, taskId);
    //     useChecklistStore.getState().deleteChecklistItemFromSocket(checklistId);
    //   }
    // });

    this.socket.on("disconnect", (reason) => {
      const wasConnected = this.connected;
      this.connected = false;
      this.connecting = false;
      this.socketId = null;

      if (reason === "io client disconnect") {
        this.reconnecting = false;
      } else {
        this.reconnecting = true;
      }

      this.notifyListeners("disconnected", reason);

      if (wasConnected && reason !== "io client disconnect") {
        this.notifyListeners("reconnecting", reason);
      }

      if (reason !== "io client disconnect") {
        this.scheduleReconnect();
      }
    });

    this.socket.on("connect_error", (err) => {
      this.error = err.message || "Connection failed";
      this.connecting = false;
      this.reconnecting = true;
      this.notifyListeners("connect_error", err);
      this.scheduleReconnect();
    });

    this.socket.on("reconnect_attempt", (attemptNumber) => {
      this.reconnecting = true;
      this.notifyListeners("reconnect_attempt", attemptNumber);
    });

    this.socket.on("reconnect", (attemptNumber) => {
      this.reconnecting = false;
      this.connected = true;
      this.notifyListeners("reconnect", attemptNumber);
    });

    this.socket.on("reconnect_failed", () => {
      this.reconnecting = false;
      this.notifyListeners("reconnect_failed");
      this.scheduleReconnect(2000);
    });

    this.socket.on("error", (data: { message: string }) => {
      this.error = data.message;
      this.notifyListeners("error", data);
    });

    this.socket.onAny((event, ...args) => {
      // Avoid double notification if we handled it explicitly? 
      // Actually onAny captures everything. 
      // If we want listeners to work, we rely on this.
      this.notifyListeners(event, ...args);
    });
  };

  disconnect = () => {
    console.log('🔌 Manually disconnecting Board Socket');

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
  };

  private scheduleReconnect = (delayMs: number = 3000) => {
    if (this.reconnectTimeout || this.connecting || this.connected) {
      console.log('[Board Socket] Reconnect check: already connecting/connected or pending.', { connecting: this.connecting, connected: this.connected });
      return;
    }

    console.log(`[Board Socket] Scheduling reconnect in ${delayMs}ms...`);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (!this.connected && !this.connecting && this.userId && this.boardId) {

        // Fully disconnect and clean up old socket before establishing new connection
        if (this.socket) {
          this.socket.removeAllListeners();
          this.socket.disconnect();
          this.socket = null;
        }

        // Establish a fresh new connection
        console.log('[Board Socket] Establishing new connection for reconnection...');
        this.connect(this.userId!, this.boardId!);
      }
    }, delayMs);
  };

  private notifyListeners = (event: string, ...args: any[]) => {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in board-socket listener '${event}':`, error);
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
      console.warn(`[Board Socket] Cannot emit '${event}': not connected`);
    }
  };
}

export const timeSocketService = new TimeSocketService();





