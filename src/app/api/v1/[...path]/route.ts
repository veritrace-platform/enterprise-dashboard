import { type NextRequest, NextResponse } from "next/server";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

async function proxyToBackend(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const subPath = `/api/v1/${path.join("/")}`;
  const isTelemetry = path[0] === "telemetry" || (path[0] === "public" && path[1] === "telemetry");

  const primaryBase = (
    process.env.API_BASE_URL || "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
  const fallbackBase = isTelemetry
    ? "http://127.0.0.1:8090"
    : "http://127.0.0.1:8080";

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const bodyBuffer = hasBody ? await request.arrayBuffer() : undefined;

  async function forwardTo(baseUrl: string) {
    const targetUrl = new URL(`${baseUrl}${subPath}`);
    request.nextUrl.searchParams.forEach((value, key) => {
      targetUrl.searchParams.append(key, value);
    });
    return fetch(targetUrl.toString(), {
      method: request.method,
      headers,
      body: bodyBuffer && bodyBuffer.byteLength > 0 ? bodyBuffer : undefined,
      redirect: "manual",
    });
  }

  try {
    let upstreamResponse: Response;
    try {
      upstreamResponse = await forwardTo(primaryBase);
    } catch (err) {
      if (process.env.NODE_ENV === "development" && !process.env.API_BASE_URL) {
        upstreamResponse = await forwardTo(fallbackBase);
      } else {
        throw err;
      }
    }

    const responseHeaders = new Headers();
    upstreamResponse.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      {
        type: "about:blank",
        title: "Service Unavailable",
        status: 503,
        code: "SERVICE_UNAVAILABLE",
        detail:
          "Không thể kết nối tới Backend API Gateway (cổng 8000 / 8080). Vui lòng khởi động Docker containers.",
      },
      { status: 503 },
    );
  }
}

export const GET = proxyToBackend;
export const POST = proxyToBackend;
export const PATCH = proxyToBackend;
export const PUT = proxyToBackend;
export const DELETE = proxyToBackend;
