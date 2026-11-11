import createClient from "openapi-fetch";
import type { paths } from "@/lib/api/core";

const DEFAULT_GATEWAY_URL = "http://127.0.0.1:8000";
const FALLBACK_CORE_URL = "http://127.0.0.1:8080";

async function resilientFetch(input: Request): Promise<Response> {
  try {
    return await fetch(input.clone());
  } catch (err) {
    if (
      process.env.NODE_ENV === "development" &&
      !process.env.API_BASE_URL &&
      (input.url.startsWith("http://127.0.0.1:8000") ||
        input.url.startsWith("http://localhost:8000"))
    ) {
      const fallbackUrl = input.url.replace(
        /^http:\/\/(127\.0\.0\.1|localhost):8000/,
        FALLBACK_CORE_URL,
      );
      const fallbackReq = new Request(fallbackUrl, input);
      return await fetch(fallbackReq);
    }
    throw err;
  }
}

export function createBackendClient(request?: Request) {
  const baseUrl =
    process.env.API_BASE_URL ||
    (process.env.NODE_ENV === "development" ? DEFAULT_GATEWAY_URL : "");

  if (!baseUrl) {
    throw new Error("API_BASE_URL is required for BFF routes");
  }

  const headers: Record<string, string> = {};
  if (request) {
    const forwardedFor = request.headers.get("x-forwarded-for");
    const userAgent = request.headers.get("user-agent");
    const traceparent = request.headers.get("traceparent");

    if (forwardedFor) {
      headers["x-forwarded-for"] = forwardedFor;
    }
    if (userAgent) {
      headers["user-agent"] = userAgent;
    }
    if (traceparent) {
      headers.traceparent = traceparent;
    }
  }

  return createClient<paths>({
    baseUrl,
    headers,
    fetch: resilientFetch,
  });
}
