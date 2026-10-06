import createClient from "openapi-fetch";
import { refreshAccessSession } from "@/lib/auth/refresh";
import { getAccessToken } from "@/lib/auth/session";
import type { paths } from "./schema";

export const apiClient = createClient<paths>({
  // OpenAPI paths already include the /api/v1 prefix. Same-origin by default per ADR-0021.
  baseUrl: "",
});

apiClient.use({
  onRequest({ request }) {
    const accessToken = getAccessToken();

    if (accessToken) {
      request.headers.set("Authorization", `Bearer ${accessToken}`);
    }

    return request;
  },
  async onResponse({ request, response }) {
    if (response.status !== 401 || request.headers.get("x-veritrace-retried")) {
      return response;
    }

    const problem = (await response
      .clone()
      .json()
      .catch(() => null)) as {
      code?: string;
    } | null;

    if (problem?.code !== "TOKEN_EXPIRED") {
      return response;
    }

    const session = await refreshAccessSession();

    if (!session) {
      return response;
    }

    const headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${session.access_token}`);
    headers.set("x-veritrace-retried", "1");

    return fetch(new Request(request, { headers }));
  },
});
