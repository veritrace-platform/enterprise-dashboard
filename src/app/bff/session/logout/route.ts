import { NextResponse } from "next/server";
import type { components } from "@/lib/api/schema";
import { createBackendClient } from "@/lib/auth/backend";
import { getBffSession } from "@/lib/auth/bff-session";

export async function POST() {
  const session = await getBffSession();

  if (session.refreshToken) {
    const body: components["schemas"]["RefreshTokenRequest"] = {
      refresh_token: session.refreshToken,
    };
    await createBackendClient().POST("/api/v1/auth/logout", { body });
  }

  await session.destroy();
  return new NextResponse(null, { status: 204 });
}
