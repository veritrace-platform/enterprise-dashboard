import { NextResponse } from "next/server";
import type { components } from "@/lib/api/schema";
import { createBackendClient } from "@/lib/auth/backend";
import { getBffSession } from "@/lib/auth/bff-session";

export async function POST() {
  const session = await getBffSession();

  if (!session.refreshToken) {
    return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 });
  }

  const body: components["schemas"]["RefreshTokenRequest"] = {
    refresh_token: session.refreshToken,
  };
  const { data, error, response } = await createBackendClient().POST(
    "/api/v1/auth/refresh",
    { body },
  );

  if (!response.ok || !data) {
    if (response.status === 401) {
      await session.destroy();
    }

    return NextResponse.json(error ?? { code: "UPSTREAM_ERROR" }, {
      status: response.status,
    });
  }

  session.refreshToken = data.refresh_token;
  await session.save();

  const {
    refresh_token: _refreshToken,
    refresh_token_expires_in: _refreshTokenExpiresIn,
    ...safeSession
  } = data;
  return NextResponse.json(safeSession);
}
