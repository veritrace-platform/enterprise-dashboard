import { NextResponse } from "next/server";
import type { components } from "@/lib/api/core";
import { createBackendClient } from "@/lib/auth/backend";
import { getBffSession } from "@/lib/auth/bff-session";

export async function POST(request: Request) {
  const session = await getBffSession();

  if (session.refreshToken) {
    const body: components["schemas"]["RefreshTokenRequest"] = {
      refresh_token: session.refreshToken,
    };
    await createBackendClient(request)
      .POST("/api/v1/auth/logout", { body })
      .catch(() => null);
  }

  await session.destroy();
  return new NextResponse(null, { status: 204 });
}
