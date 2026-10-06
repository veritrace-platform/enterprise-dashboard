import {
  getIronSession,
  type IronSession,
  type SessionOptions,
} from "iron-session";
import { cookies } from "next/headers";

export interface BffSession {
  refreshToken?: string;
}

const sessionSecret = process.env.SESSION_SECRET ?? "";

const sessionOptions: SessionOptions = {
  cookieName: "veritrace_session",
  password: sessionSecret,
  cookieOptions: {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  },
};

function assertSessionSecret() {
  if (sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  }
}

export async function getBffSession(): Promise<IronSession<BffSession>> {
  assertSessionSecret();
  return getIronSession<BffSession>(await cookies(), sessionOptions);
}
