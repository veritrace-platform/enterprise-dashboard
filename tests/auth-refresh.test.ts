import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api/client";
import { refreshAccessSession } from "@/lib/auth/refresh";
import { clearAccessSession, setAccessSession } from "@/lib/auth/session";
import { server } from "./mocks/server";

const mockUser = {
  id: "0192f7a4-7c3e-7d2a-9b1e-3f4a5b6c7d90",
  email: "admin@sgfresh.example",
  full_name: "Nguyen Van An",
  phone: null,
  role: "ADMIN" as const,
  is_active: true,
  last_login_at: null,
  created_at: "2026-09-30T08:00:00Z",
  updated_at: "2026-09-30T08:00:00Z",
  tenant: {
    id: "0192f7a4-7c3e-7d2a-9b1e-3f4a5b6c7d8e",
    code: "SGFRESH",
    legal_name: "Saigon Fresh Foods",
    gs1_company_prefix: "8930001",
    status: "ACTIVE" as const,
  },
};

describe("refreshAccessSession and apiClient 401 retry", () => {
  afterEach(() => {
    clearAccessSession();
    vi.unstubAllGlobals();
  });

  it("coalesces concurrent refresh requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "access-token",
          token_type: "Bearer",
          expires_in: 900,
          user: mockUser,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([
      refreshAccessSession(),
      refreshAccessSession(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first?.access_token).toBe("access-token");
    expect(second).toBe(first);
  });

  it("clones POST request body and retries once after 401 TOKEN_EXPIRED", async () => {
    setAccessSession({
      access_token: "expired-token",
      token_type: "Bearer",
      expires_in: 900,
      user: mockUser,
    });

    const receivedBodies: unknown[] = [];
    const receivedAuthHeaders: (string | null)[] = [];

    server.use(
      http.post("http://localhost:3000/bff/session/refresh", () => {
        return HttpResponse.json({
          access_token: "fresh-token",
          token_type: "Bearer",
          expires_in: 900,
          user: mockUser,
        });
      }),
      http.post(
        "http://localhost:3000/api/v1/shipments/:id/cancel",
        async ({ request }) => {
          const auth = request.headers.get("authorization");
          receivedAuthHeaders.push(auth);
          receivedBodies.push(await request.json());

          if (auth === "Bearer expired-token") {
            return HttpResponse.json(
              {
                type: "about:blank",
                title: "Unauthorized",
                status: 401,
                code: "TOKEN_EXPIRED",
              },
              { status: 401 },
            );
          }

          return HttpResponse.json({ id: "ship-1", status: "CANCELLED" });
        },
      ),
    );

    const { response } = await apiClient.POST(
      "/api/v1/shipments/{shipment_id}/cancel",
      {
        params: { path: { shipment_id: "ship-1" } },
        body: { reason: "Customer postponed" },
      },
    );

    expect(response.status).toBe(200);
    expect(receivedAuthHeaders).toEqual([
      "Bearer expired-token",
      "Bearer fresh-token",
    ]);
    expect(receivedBodies).toEqual([
      { reason: "Customer postponed" },
      { reason: "Customer postponed" },
    ]);
  });
});
