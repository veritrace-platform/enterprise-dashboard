import { afterEach, describe, expect, it, vi } from "vitest";
import { refreshAccessSession } from "@/lib/auth/refresh";
import { clearAccessSession } from "@/lib/auth/session";

describe("refreshAccessSession", () => {
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
          user: {},
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
});
