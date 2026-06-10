import { beforeEach, describe, expect, it, vi } from "vitest";
import { CANONICAL_WARNING } from "@/lib/warning";
import type { LabelExtraction } from "@/lib/types";

// The route is exercised with the vision model mocked out — these tests
// cover request validation, error mapping, and response shape, not the LLM.
vi.mock("@/lib/extraction", () => ({
  extractLabelFields: vi.fn(),
}));
// Each client IP gets a fresh allowance so validation tests don't trip it.
vi.mock("@/lib/rateLimit", () => ({
  allowRequest: vi.fn(() => true),
}));

import { POST } from "../route";
import { extractLabelFields } from "@/lib/extraction";
import { allowRequest } from "@/lib/rateLimit";
import { NextRequest } from "next/server";

const clear = (text: string) => ({ text, legibility: "clear" as const });

const extraction: LabelExtraction = {
  isAlcoholLabel: true,
  imageQuality: "good",
  brandName: clear("OLD TOM DISTILLERY"),
  classType: clear("Kentucky Straight Bourbon Whiskey"),
  alcoholContent: clear("45% ALC./VOL."),
  netContents: clear("750 mL"),
  bottlerInfo: { text: null, legibility: "absent" },
  countryOfOrigin: { text: null, legibility: "absent" },
  governmentWarning: clear(CANONICAL_WARNING),
  warningHeaderAllCaps: true,
  warningHeaderBold: true,
  apparentBeverageType: "spirits",
};

const goodApplication = JSON.stringify({
  beverageType: "spirits",
  brandName: "Old Tom Distillery",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45%",
  netContents: "750 mL",
});

function request(form: FormData): NextRequest {
  return new NextRequest("http://localhost/api/verify", {
    method: "POST",
    body: form,
  });
}

function pngFile(bytes = 64, name = "label.png"): File {
  return new File([new Uint8Array(bytes)], name, { type: "image/png" });
}

beforeEach(() => {
  vi.mocked(extractLabelFields).mockReset().mockResolvedValue(extraction);
  vi.mocked(allowRequest).mockReturnValue(true);
});

describe("POST /api/verify validation", () => {
  it("rejects a missing image", async () => {
    const form = new FormData();
    form.append("application", goodApplication);
    const res = await POST(request(form));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/image/i);
  });

  it("rejects unsupported image types", async () => {
    const form = new FormData();
    form.append("image", new File([new Uint8Array(8)], "x.gif", { type: "image/gif" }));
    form.append("application", goodApplication);
    const res = await POST(request(form));
    expect(res.status).toBe(400);
  });

  it("rejects oversized images", async () => {
    const form = new FormData();
    form.append("image", pngFile(4 * 1024 * 1024 + 1));
    form.append("application", goodApplication);
    const res = await POST(request(form));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/large/i);
  });

  it("rejects malformed application JSON", async () => {
    const form = new FormData();
    form.append("image", pngFile());
    form.append("application", "{not json");
    const res = await POST(request(form));
    expect(res.status).toBe(400);
  });

  it("requires brand name and class/type", async () => {
    const form = new FormData();
    form.append("image", pngFile());
    form.append("application", JSON.stringify({ brandName: "", classType: "" }));
    const res = await POST(request(form));
    expect(res.status).toBe(400);
  });

  it("falls back to a valid beverage type on junk input", async () => {
    const form = new FormData();
    form.append("image", pngFile());
    form.append(
      "application",
      JSON.stringify({ beverageType: "moonshine", brandName: "Old Tom Distillery", classType: "Bourbon" }),
    );
    const res = await POST(request(form));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/verify behavior", () => {
  it("returns a verdict with extraction and timing on success", async () => {
    const form = new FormData();
    form.append("image", pngFile());
    form.append("application", goodApplication);
    const res = await POST(request(form));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.verdict).toBe("accepted");
    expect(body.extraction.brandName.text).toBe("OLD TOM DISTILLERY");
    expect(typeof body.elapsedMs).toBe("number");
  });

  it("maps extraction failures to a friendly 502", async () => {
    vi.mocked(extractLabelFields).mockRejectedValue(new Error("model exploded"));
    const form = new FormData();
    form.append("image", pngFile());
    form.append("application", goodApplication);
    const res = await POST(request(form));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).not.toContain("exploded");
  });

  it("returns 429 when the rate limiter blocks", async () => {
    vi.mocked(allowRequest).mockReturnValue(false);
    const form = new FormData();
    form.append("image", pngFile());
    form.append("application", goodApplication);
    const res = await POST(request(form));
    expect(res.status).toBe(429);
  });
});
