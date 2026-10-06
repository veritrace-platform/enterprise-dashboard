import {
  type AccessSession,
  clearAccessSession,
  setAccessSession,
} from "./session";

let refreshPromise: Promise<AccessSession | null> | null = null;

export async function refreshAccessSession() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = fetch("/bff/session/refresh", {
    method: "POST",
    credentials: "same-origin",
  })
    .then(async (response) => {
      if (!response.ok) {
        clearAccessSession();
        return null;
      }

      const session = (await response.json()) as AccessSession;
      setAccessSession(session);
      return session;
    })
    .catch(() => {
      clearAccessSession();
      return null;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}
