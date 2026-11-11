import { NextResponse } from "next/server";
import type { components } from "@/lib/api/core";
import { parseProblem } from "@/lib/api/errors";
import { createBackendClient } from "@/lib/auth/backend";
import { getBffSession } from "@/lib/auth/bff-session";

export async function POST(request: Request) {
  const session = await getBffSession();

  if (!session.refreshToken) {
    return NextResponse.json(
      {
        type: "about:blank",
        title: "Unauthorized",
        status: 401,
        code: "UNAUTHENTICATED",
      },
      { status: 401 },
    );
  }

  const body: components["schemas"]["RefreshTokenRequest"] = {
    refresh_token: session.refreshToken,
  };

  try {
    const { data, error, response } = await createBackendClient(request).POST(
      "/api/v1/auth/refresh",
      { body },
    );

    if (!response.ok || !data) {
      if (response.status === 401) {
        await session.destroy();
      }

      return NextResponse.json(parseProblem(error, response), {
        status: response.status,
      });
    }

    const rotatedSession = await getBffSession(data.refresh_token_expires_in);
    rotatedSession.refreshToken = data.refresh_token;
    await rotatedSession.save();

    const {
      refresh_token: _refreshToken,
      refresh_token_expires_in: _refreshTokenExpiresIn,
      ...safeSession
    } = data;
    return NextResponse.json(safeSession);
  } catch {
    return NextResponse.json(
      {
        type: "about:blank",
        title: "Service Unavailable",
        status: 503,
        code: "SERVICE_UNAVAILABLE",
        detail:
          "Không thể kết nối tới Backend API Gateway (cổng 8000 / 8080).",
      },
      { status: 503 },
    );
  }
}
