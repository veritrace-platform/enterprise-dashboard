import { NextResponse } from "next/server";
import { z } from "zod";
import { parseProblem } from "@/lib/api/errors";
import { createBackendClient } from "@/lib/auth/backend";
import { getBffSession } from "@/lib/auth/bff-session";

const loginBodySchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => null);
  const parsedBody = loginBodySchema.safeParse(rawBody);

  if (!parsedBody.success) {
    return NextResponse.json(
      {
        type: "about:blank",
        title: "Bad Request",
        status: 400,
        code: "VALIDATION_FAILED",
      },
      { status: 400 },
    );
  }

  try {
    const { data, error, response } = await createBackendClient(request).POST(
      "/api/v1/auth/login",
      { body: parsedBody.data },
    );

    if (!response.ok || !data) {
      const headers = new Headers();
      const retryAfter = response.headers.get("Retry-After");
      if (retryAfter) {
        headers.set("Retry-After", retryAfter);
      }
      return NextResponse.json(parseProblem(error, response), {
        status: response.status,
        headers,
      });
    }

    const session = await getBffSession(data.refresh_token_expires_in);
    session.refreshToken = data.refresh_token;
    await session.save();

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
          "Không thể kết nối tới Backend API Gateway (cổng 8000 / 8080). Vui lòng kiểm tra Docker containers đã được khởi động.",
      },
      { status: 503 },
    );
  }
}
