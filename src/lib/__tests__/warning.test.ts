import { describe, expect, it } from "vitest";
import { CANONICAL_WARNING, checkWarning } from "../warning";
import type { ExtractedField } from "../types";

const clear = (text: string): ExtractedField => ({ text, legibility: "clear" });

/** Convenience: run a transcription with confirmed-good formatting. */
const check = (text: string) => checkWarning(clear(text), true, true);

describe("warning header", () => {
  it("accepts the canonical header", () => {
    expect(check(CANONICAL_WARNING).status).toBe("match");
  });

  it("accepts extra internal spacing collapsed from line wraps", () => {
    expect(check(CANONICAL_WARNING.replace("GOVERNMENT WARNING:", "GOVERNMENT  WARNING :")).status).toBe("match");
  });

  it("rejects title case", () => {
    expect(check(CANONICAL_WARNING.replace("GOVERNMENT WARNING:", "Government Warning:")).status).toBe("mismatch");
  });

  it("rejects all-lowercase", () => {
    expect(check(CANONICAL_WARNING.replace("GOVERNMENT WARNING:", "government warning:")).status).toBe("mismatch");
  });

  it("rejects a missing colon", () => {
    expect(check(CANONICAL_WARNING.replace("GOVERNMENT WARNING:", "GOVERNMENT WARNING")).status).toBe("mismatch");
  });

  it("rejects an abbreviated header", () => {
    expect(check(CANONICAL_WARNING.replace("GOVERNMENT WARNING:", "GOVT WARNING:")).status).toBe("mismatch");
  });

  it("rejects when the statement starts mid-text without the header", () => {
    expect(check(CANONICAL_WARNING.slice("GOVERNMENT WARNING:".length).trim()).status).toBe("mismatch");
  });
});

describe("warning body wording", () => {
  it("rejects a single substituted word", () => {
    expect(check(CANONICAL_WARNING.replace("birth defects", "birth issues")).status).toBe("mismatch");
  });

  it("rejects word-order changes", () => {
    expect(check(CANONICAL_WARNING.replace("drive a car or operate machinery", "operate machinery or drive a car")).status).toBe("mismatch");
  });

  it("rejects a dropped clause", () => {
    const dropped = CANONICAL_WARNING.replace(
      " (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.",
      "",
    );
    expect(check(dropped).status).toBe("mismatch");
  });

  it("rejects added marketing text inside the statement", () => {
    expect(check(CANONICAL_WARNING + " Please enjoy responsibly.").status).toBe("mismatch");
  });

  it("rejects missing clause numbering", () => {
    expect(check(CANONICAL_WARNING.replace("(1) ", "").replace("(2) ", "")).status).toBe("mismatch");
  });

  it("rejects dropped punctuation that changes the statement", () => {
    expect(check(CANONICAL_WARNING.replace("machinery, and", "machinery and")).status).toBe("mismatch");
  });

  it("accepts a fully lowercase body (case is only mandated for the header)", () => {
    const body = CANONICAL_WARNING.slice("GOVERNMENT WARNING:".length).toLowerCase();
    expect(check("GOVERNMENT WARNING:" + body).status).toBe("match");
  });

  it("accepts hyphenated line wraps anywhere in the body", () => {
    expect(check(CANONICAL_WARNING.replace("machinery", "machin-\nery")).status).toBe("match");
  });
});

describe("warning formatting observations", () => {
  const canonical = clear(CANONICAL_WARNING);

  it("downgrades to review when header capitalization could not be confirmed", () => {
    expect(checkWarning(canonical, null, true).status).toBe("needs_review");
  });

  it("downgrades to review when boldness could not be confirmed", () => {
    expect(checkWarning(canonical, true, null).status).toBe("needs_review");
  });

  it("rejects when the model observed a non-capitalized header despite canonical transcription", () => {
    expect(checkWarning(canonical, false, true).status).toBe("mismatch");
  });

  it("flags a non-bold header for review, not rejection", () => {
    expect(checkWarning(canonical, true, false).status).toBe("needs_review");
  });
});

describe("warning presence", () => {
  it("rejects an absent warning", () => {
    expect(checkWarning({ text: null, legibility: "absent" }, null, null).status).toBe("mismatch");
  });

  it("routes partial legibility to review", () => {
    expect(checkWarning({ text: "GOVERNMENT WAR…", legibility: "partial" }, null, null).status).toBe("needs_review");
  });

  it("routes unreadable to review", () => {
    expect(checkWarning({ text: null, legibility: "unreadable" }, null, null).status).toBe("needs_review");
  });
});
