import type { components } from "@/lib/api/schema";

export type AccessSession = Omit<
  components["schemas"]["Session"],
  "refresh_token" | "refresh_token_expires_in"
>;

let accessSession: AccessSession | null = null;

export function setAccessSession(session: AccessSession) {
  accessSession = session;
}

export function getAccessSession() {
  return accessSession;
}

export function getAccessToken() {
  return accessSession?.access_token ?? null;
}

export function clearAccessSession() {
  accessSession = null;
}
