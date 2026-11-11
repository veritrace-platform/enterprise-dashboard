import {
  getIronSession,
  type IronSession,
  type SessionOptions,
} from "iron-session";
import { cookies } from "next/headers";

export interface BffSession {
  refreshToken?: string;
}

const sessionSecret =
  process.env.SESSION_SECRET ||
  (process.env.NODE_ENV === "development"
    ? "veritrace-local-dev-session-secret-32chars"
    : "");
const DEFAULT_MAX_AGE_SECONDS = 604_800;

function buildSessionOptions(maxAge = DEFAULT_MAX_AGE_SECONDS): SessionOptions {
  return {
    cookieName: "veritrace_session",
    password: sessionSecret,
    ttl: maxAge,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge,
    },
  };
}

function assertSessionSecret() {
  if (sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  }
}

export async function getBffSession(
  maxAge?: number,
): Promise<IronSession<BffSession>> {
  assertSessionSecret();
  return getIronSession<BffSession>(
    await cookies(),
    buildSessionOptions(maxAge),
  );
}
