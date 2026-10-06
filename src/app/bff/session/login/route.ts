import { NextResponse } from "next/server";
import type { components } from "@/lib/api/schema";
import { createBackendClient } from "@/lib/auth/backend";
import { getBffSession } from "@/lib/auth/bff-session";

export async function POST(request: Request) {
  const body = (await request.json()) as components["schemas"]["LoginRequest"];
  const { data, error, response } = await createBackendClient().POST(
    "/api/v1/auth/login",
    { body },
  );

  if (!response.ok || !data) {
    return NextResponse.json(error ?? { code: "UPSTREAM_ERROR" }, {
      status: response.status,
    });
  }

  const session = await getBffSession();
  session.refreshToken = data.refresh_token;
  await session.save();

  const {
    refresh_token: _refreshToken,
    refresh_token_expires_in: _refreshTokenExpiresIn,
    ...safeSession
  } = data;
  return NextResponse.json(safeSession);
}
