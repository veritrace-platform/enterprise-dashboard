import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders shadcn UI content", () => {
    render(<Button>Open shipment</Button>);

    expect(screen.getByRole("button", { name: "Open shipment" })).toBeVisible();
  });
});
