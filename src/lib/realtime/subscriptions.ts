import type { NotificationReading } from "./events";

export type ReadingSubscriber = (reading: NotificationReading) => void;

const MAX_SUBSCRIPTIONS = 20;

export class SubscriptionManager {
  private readonly callbacksBySscc = new Map<string, Set<ReadingSubscriber>>();
  private readonly forbiddenSsccs = new Set<string>();

  subscribe(
    sscc: string,
    callback: ReadingSubscriber,
    sendFrame: (sscc: string, action: "subscribe" | "unsubscribe") => void,
  ): () => void {
    if (this.forbiddenSsccs.has(sscc)) {
      return () => undefined;
    }

    let listeners = this.callbacksBySscc.get(sscc);
    const isFirstSubscriber = !listeners || listeners.size === 0;

    if (
      isFirstSubscriber &&
      !this.callbacksBySscc.has(sscc) &&
      this.callbacksBySscc.size >= MAX_SUBSCRIPTIONS
    ) {
      return () => undefined;
    }

    if (!listeners) {
      listeners = new Set();
      this.callbacksBySscc.set(sscc, listeners);
    }
    listeners.add(callback);

    if (isFirstSubscriber) {
      sendFrame(sscc, "subscribe");
    }

    return () => {
      const current = this.callbacksBySscc.get(sscc);
      if (!current) {
        return;
      }
      current.delete(callback);
      if (current.size === 0) {
        this.callbacksBySscc.delete(sscc);
        sendFrame(sscc, "unsubscribe");
      }
    };
  }

  markForbidden(sscc: string) {
    this.forbiddenSsccs.add(sscc);
    this.callbacksBySscc.delete(sscc);
  }

  getActiveSsccs(): string[] {
    const active: string[] = [];
    for (const [sscc, listeners] of this.callbacksBySscc.entries()) {
      if (listeners.size > 0 && !this.forbiddenSsccs.has(sscc)) {
        active.push(sscc);
      }
    }
    return active;
  }

  emitReading(reading: NotificationReading) {
    const listeners = this.callbacksBySscc.get(reading.sscc);
    if (!listeners) {
      return;
    }
    for (const listener of listeners) {
      listener(reading);
    }
  }

  clear() {
    this.callbacksBySscc.clear();
    this.forbiddenSsccs.clear();
  }
}

