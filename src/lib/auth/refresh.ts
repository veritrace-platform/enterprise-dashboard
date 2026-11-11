import {
  type AccessSession,
  accessSessionSchema,
  clearAccessSession,
  setAccessSession,
} from "./session";

let refreshPromise: Promise<AccessSession | null> | null = null;

async function runWithTabLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request("veritrace-session-refresh", fn);
  }
  return fn();
}

function resolveRefreshUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/bff/session/refresh`;
  }
  return "/bff/session/refresh";
}

async function performRefresh(): Promise<AccessSession | null> {
  return runWithTabLock(async () => {
    try {
      const response = await fetch(resolveRefreshUrl(), {
        method: "POST",
        credentials: "same-origin",
      });

      if (!response.ok) {
        clearAccessSession();
        return null;
      }

      const json: unknown = await response.json();
      const parsed = accessSessionSchema.safeParse(json);
      const session = parsed.success
        ? parsed.data
        : isAccessSessionLike(json)
          ? json
          : null;

      if (!session) {
        clearAccessSession();
        return null;
      }

      setAccessSession(session);
      return session;
    } catch {
      clearAccessSession();
      return null;
    }
  });
}

function isAccessSessionLike(value: unknown): value is AccessSession {
  return (
    typeof value === "object" &&
    value !== null &&
    "access_token" in value &&
    typeof (value as { access_token: unknown }).access_token === "string" &&
    (value as { access_token: string }).access_token.length > 0 &&
    "user" in value &&
    typeof (value as { user: unknown }).user === "object" &&
    (value as { user: unknown }).user !== null
  );
}

export function refreshAccessSession(): Promise<AccessSession | null> {
  refreshPromise ??= performRefresh().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}
