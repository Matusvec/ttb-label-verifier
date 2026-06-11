import { describe, expect, it } from "vitest";
import { allowRequest } from "../rateLimit";

describe("allowRequest", () => {
  it("never blocks a legitimate 300-label batch (concurrency 4, ~70 req/min)", () => {
    // 70 requests inside one window must all pass — Sarah's batch use case.
    for (let i = 0; i < 70; i++) {
      expect(allowRequest("batch-client")).toBe(true);
    }
  });

  it("blocks runaway abuse beyond 150 requests per minute", () => {
    const id = "client-a";
    for (let i = 0; i < 150; i++) {
      expect(allowRequest(id)).toBe(true);
    }
    expect(allowRequest(id)).toBe(false);
  });

  it("tracks clients independently", () => {
    for (let i = 0; i < 150; i++) allowRequest("client-b");
    expect(allowRequest("client-b")).toBe(false);
    expect(allowRequest("client-c")).toBe(true);
  });
});
