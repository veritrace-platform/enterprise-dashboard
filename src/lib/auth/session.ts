import { z } from "zod";
import type { components } from "@/lib/api/core";

export type AccessSession = Omit<
  components["schemas"]["Session"],
  "refresh_token" | "refresh_token_expires_in"
>;

export type SessionUser = components["schemas"]["Me"];
export type UserRole = components["schemas"]["Role"];

export const roleSchema = z.enum([
  "ADMIN",
  "WAREHOUSE_MANAGER",
  "DRIVER",
  "INSPECTOR",
]);

export const tenantSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  legal_name: z.string(),
  gs1_company_prefix: z.string(),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  full_name: z.string(),
  phone: z.string().nullable(),
  role: roleSchema,
  is_active: z.boolean(),
  last_login_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  tenant: tenantSummarySchema,
});

export const accessSessionSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.literal("Bearer"),
  expires_in: z.number(),
  user: sessionUserSchema,
});

type SessionListener = (session: AccessSession | null) => void;

let accessSession: AccessSession | null = null;
const listeners = new Set<SessionListener>();

function notifyListeners() {
  for (const listener of listeners) {
    listener(accessSession);
  }
}

export function setAccessSession(session: AccessSession) {
  accessSession = session;
  notifyListeners();
}

export function getAccessSession() {
  return accessSession;
}

export function getAccessToken() {
  return accessSession?.access_token ?? null;
}

export function clearAccessSession() {
  if (accessSession === null) {
    return;
  }
  accessSession = null;
  notifyListeners();
}

export function subscribeAccessSession(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
