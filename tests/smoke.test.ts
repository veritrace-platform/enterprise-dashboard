import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";

describe("localization routing", () => {
  it("supports the enterprise dashboard locales", () => {
    expect(routing.locales).toEqual(["vi", "en"]);
    expect(routing.defaultLocale).toBe("vi");
  });
});
