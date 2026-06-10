import { describe, expect, it } from "vitest";
import { allowRequest } from "../rateLimit";

describe("allowRequest", () => {
  it("allows up to 30 requests per minute per client, then blocks", () => {
    const id = "client-a";
    for (let i = 0; i < 30; i++) {
      expect(allowRequest(id)).toBe(true);
    }
    expect(allowRequest(id)).toBe(false);
  });

  it("tracks clients independently", () => {
    for (let i = 0; i < 30; i++) allowRequest("client-b");
    expect(allowRequest("client-b")).toBe(false);
    expect(allowRequest("client-c")).toBe(true);
  });
});
