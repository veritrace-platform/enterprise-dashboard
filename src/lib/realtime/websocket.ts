import type { QueryClient } from "@tanstack/react-query";
import {
  invalidateIncidentQueries,
  invalidateShipmentQueries,
  queryKeys,
} from "@/lib/api/query-client";
import { refreshAccessSession } from "@/lib/auth/refresh";
import { getAccessToken } from "@/lib/auth/session";
import {
  type ClientMessage,
  type NotificationBreachConfirmed,
  type NotificationBreachResolved,
  type NotificationError,
  type NotificationRecall,
  parseNotificationMessage,
} from "./events";
import { type ReadingSubscriber, SubscriptionManager } from "./subscriptions";

export type RealtimeStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

export interface RealtimeCallbacks {
  onStatusChange?: (status: RealtimeStatus) => void;
  onBreachConfirmed?: (event: NotificationBreachConfirmed) => void;
  onBreachResolved?: (event: NotificationBreachResolved) => void;
  onShipmentRecalled?: (event: NotificationRecall) => void;
  onError?: (error: NotificationError) => void;
}

const MIN_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const MAX_SEEN_EVENT_IDS = 500;

export function resolveWebSocketUrl(): string {
  const configured = process.env.NEXT_PUBLIC_WS_URL;
  if (configured && configured.trim().length > 0) {
    return configured.trim();
  }
  if (typeof window === "undefined") {
    return "ws://localhost:8001/ws/v1/notifications";
  }
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/ws/v1/notifications`;
}

export function computeBackoffDelay(
  attempt: number,
  random = Math.random,
): number {
  const exp = Math.min(
    MAX_BACKOFF_MS,
    MIN_BACKOFF_MS * 2 ** Math.max(0, attempt),
  );
  const jitter = 0.75 + random() * 0.5;
  return Math.min(MAX_BACKOFF_MS, Math.round(exp * jitter));
}

export class RealtimeClient {
  private socket: WebSocket | null = null;
  private status: RealtimeStatus = "disconnected";
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyClosed = false;
  private hasConnectedBefore = false;
  private lastSubscribedSscc: string | null = null;
  private readonly seenEventIds = new Set<string>();
  private readonly subscriptions = new SubscriptionManager();

  constructor(
    private readonly queryClient: QueryClient,
    private readonly callbacks: RealtimeCallbacks = {},
  ) {}

  getStatus(): RealtimeStatus {
    return this.status;
  }

  connect() {
    if (typeof WebSocket === "undefined") {
      return;
    }
    this.manuallyClosed = false;
    this.clearReconnectTimer();

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const token = getAccessToken();
    if (!token) {
      this.setStatus("disconnected");
      return;
    }

    this.setStatus(this.hasConnectedBefore ? "reconnecting" : "connecting");

    const ws = new WebSocket(resolveWebSocketUrl(), [
      "veritrace.v1",
      `bearer.${token}`,
    ]);
    this.socket = ws;

    ws.onopen = () => {
      if (this.socket !== ws) {
        return;
      }
      const isReconnect = this.hasConnectedBefore;
      this.hasConnectedBefore = true;
      this.reconnectAttempt = 0;
      this.setStatus("connected");

      for (const sscc of this.subscriptions.getActiveSsccs()) {
        this.sendSubscriptionFrame(sscc, "subscribe");
      }

      if (isReconnect) {
        invalidateShipmentQueries(this.queryClient);
        invalidateIncidentQueries(this.queryClient);
        void this.queryClient.invalidateQueries({
          queryKey: queryKeys.lots.all,
        });
      }
    };

    ws.onmessage = (event) => {
      if (typeof event.data !== "string") {
        return;
      }
      const message = parseNotificationMessage(event.data);
      if (!message) {
        return;
      }

      switch (message.type) {
        case "telemetry.reading": {
          this.subscriptions.emitReading(message.data);
          break;
        }
        case "cold_chain.breach_confirmed": {
          if (this.isDuplicateEvent(message.id)) {
            return;
          }
          invalidateIncidentQueries(this.queryClient, message.data.sscc);
          invalidateShipmentQueries(this.queryClient, message.data.shipment_id);
          this.callbacks.onBreachConfirmed?.(message.data);
          break;
        }
        case "cold_chain.breach_resolved": {
          if (this.isDuplicateEvent(message.id)) {
            return;
          }
          invalidateIncidentQueries(this.queryClient, message.data.sscc);
          invalidateShipmentQueries(this.queryClient);
          this.callbacks.onBreachResolved?.(message.data);
          break;
        }
        case "shipment.recalled": {
          if (this.isDuplicateEvent(message.id)) {
            return;
          }
          invalidateShipmentQueries(this.queryClient, message.data.shipment_id);
          void this.queryClient.invalidateQueries({
            queryKey: queryKeys.lots.all,
          });
          this.callbacks.onShipmentRecalled?.(message.data);
          break;
        }
        case "error": {
          if (
            message.data.code === "FORBIDDEN" &&
            this.lastSubscribedSscc !== null
          ) {
            this.subscriptions.markForbidden(this.lastSubscribedSscc);
          }
          this.callbacks.onError?.(message.data);
          break;
        }
        case "subscribed":
        case "unsubscribed":
          break;
      }
    };

    ws.onclose = (event) => {
      if (this.socket === ws) {
        this.socket = null;
      }
      if (this.manuallyClosed) {
        this.setStatus("disconnected");
        return;
      }
      void this.handleClose(event.code);
    };

    ws.onerror = () => {
      // Browser fires onclose right after onerror; reconnect is handled there.
    };
  }

  disconnect() {
    this.manuallyClosed = true;
    this.clearReconnectTimer();
    if (this.socket) {
      const current = this.socket;
      this.socket = null;
      current.close(1000);
    }
    this.setStatus("disconnected");
  }

  subscribeTelemetry(sscc: string, callback: ReadingSubscriber): () => void {
    return this.subscriptions.subscribe(
      sscc,
      callback,
      (targetSscc, action) => {
        this.sendSubscriptionFrame(targetSscc, action);
      },
    );
  }

  private sendSubscriptionFrame(
    sscc: string,
    type: "subscribe" | "unsubscribe",
  ) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    if (type === "subscribe") {
      this.lastSubscribedSscc = sscc;
    }
    const payload: ClientMessage = {
      type,
      channel: "telemetry",
      sscc,
    };
    this.socket.send(JSON.stringify(payload));
  }

  private async handleClose(code: number) {
    // 4400 / 1009 indicate a client bug; do not loop.
    if (code === 4400 || code === 1009) {
      this.setStatus("disconnected");
      return;
    }

    if (code === 4401) {
      this.setStatus("reconnecting");
      const refreshed = await refreshAccessSession();
      if (!refreshed || this.manuallyClosed) {
        this.setStatus("disconnected");
        return;
      }
      this.connect();
      return;
    }

    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.manuallyClosed) {
      return;
    }
    this.setStatus("reconnecting");
    const delay = computeBackoffDelay(this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.manuallyClosed) {
        this.connect();
      }
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private isDuplicateEvent(id: string): boolean {
    if (this.seenEventIds.has(id)) {
      return true;
    }
    if (this.seenEventIds.size >= MAX_SEEN_EVENT_IDS) {
      const oldest = this.seenEventIds.values().next().value;
      if (oldest) {
        this.seenEventIds.delete(oldest);
      }
    }
    this.seenEventIds.add(id);
    return false;
  }

  private setStatus(next: RealtimeStatus) {
    if (this.status === next) {
      return;
    }
    this.status = next;
    this.callbacks.onStatusChange?.(next);
  }
}
