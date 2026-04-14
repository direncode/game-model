import { io, Socket } from "socket.io-client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || (typeof window !== "undefined" ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}` : "ws://localhost:8000");

type EventHandler = (...args: unknown[]) => void;

class WebSocketManager {
  private socket: Socket | null = null;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  connect(token?: string) {
    if (this.socket?.connected) return;

    this.socket = io(WS_URL, {
      auth: token ? { token } : undefined,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.socket.on("connect", () => {
      console.log("[WS] Connected");
      this.reconnectAttempts = 0;
    });

    this.socket.on("disconnect", (reason) => {
      console.log("[WS] Disconnected:", reason);
    });

    this.socket.on("connect_error", (error) => {
      console.error("[WS] Connection error:", error.message);
      this.reconnectAttempts++;
    });

    // Re-register all existing handlers on the new socket
    this.handlers.forEach((handlers, event) => {
      handlers.forEach((handler) => {
        this.socket?.on(event, handler);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.handlers.clear();
  }

  on(event: string, handler: EventHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    this.socket?.on(event, handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(event)?.delete(handler);
      this.socket?.off(event, handler);
    };
  }

  emit(event: string, ...args: unknown[]) {
    this.socket?.emit(event, ...args);
  }

  joinRoom(room: string) {
    this.emit("join", { room });
  }

  leaveRoom(room: string) {
    this.emit("leave", { room });
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // Crystallization-specific helpers
  subscribeToCrystallization(jobId: string, handlers: {
    onProgress?: (data: { stage: string; progress: number; message: string }) => void;
    onComplete?: (data: { job_id: string; status: string }) => void;
    onError?: (data: { job_id: string; error: string }) => void;
  }) {
    this.joinRoom(`crystallization:${jobId}`);

    const unsubs: (() => void)[] = [];

    if (handlers.onProgress) {
      unsubs.push(this.on("crystallization:progress", handlers.onProgress as EventHandler));
    }
    if (handlers.onComplete) {
      unsubs.push(this.on("crystallization:complete", handlers.onComplete as EventHandler));
    }
    if (handlers.onError) {
      unsubs.push(this.on("crystallization:error", handlers.onError as EventHandler));
    }

    return () => {
      this.leaveRoom(`crystallization:${jobId}`);
      unsubs.forEach((unsub) => unsub());
    };
  }

  // Alert subscription helper
  subscribeToAlerts(handler: (alert: { id: string; type: string; message: string; severity: string }) => void) {
    return this.on("alert", handler as EventHandler);
  }
}

export const ws = new WebSocketManager();
