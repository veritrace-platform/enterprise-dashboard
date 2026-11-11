import createClient from "openapi-fetch";
import { refreshAccessSession } from "@/lib/auth/refresh";
import { getAccessToken } from "@/lib/auth/session";
import type { paths as CorePaths } from "./core";
import { problemSchema } from "./errors";
import type { paths as TelemetryPaths } from "./telemetry";

export const apiClient = createClient<CorePaths & TelemetryPaths>({
  // OpenAPI paths already include the /api/v1 prefix. Same-origin by default per ADR-0021.
  baseUrl: typeof window !== "undefined" ? window.location.origin : "",
  fetch: (...args) => globalThis.fetch(...args),
});

const retryableRequests = new WeakMap<Request, Request>();

apiClient.use({
  onRequest({ request }) {
    const accessToken = getAccessToken();

    if (accessToken) {
      request.headers.set("Authorization", `Bearer ${accessToken}`);
    }

    if (!request.headers.get("x-veritrace-retried")) {
      retryableRequests.set(request, request.clone());
    }

    return request;
  },
  async onResponse({ request, response }) {
    if (response.status !== 401 || request.headers.get("x-veritrace-retried")) {
      return response;
    }

    const body = await response
      .clone()
      .json()
      .catch(() => null);
    const parsedProblem = problemSchema.safeParse(body);
    const code = parsedProblem.success
      ? parsedProblem.data.code
      : (body as { code?: unknown } | null)?.code;

    if (code !== "TOKEN_EXPIRED") {
      return response;
    }

    const retryRequest = retryableRequests.get(request);
    if (!retryRequest) {
      return response;
    }

    const session = await refreshAccessSession();

    if (!session) {
      return response;
    }

    retryRequest.headers.set("Authorization", `Bearer ${session.access_token}`);
    retryRequest.headers.set("x-veritrace-retried", "1");

    return fetch(retryRequest);
  },
});
