import { describe, expect, it } from "vitest";
import { verifyLabel } from "../verify";
import { CANONICAL_WARNING, checkWarning } from "../warning";
import type { ApplicationData, ExtractedField, LabelExtraction } from "../types";

const clear = (text: string): ExtractedField => ({ text, legibility: "clear" });
const absent: ExtractedField = { text: null, legibility: "absent" };

const app: ApplicationData = {
  beverageType: "spirits",
  brandName: "Old Tom Distillery",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
};

const goodExtraction: LabelExtraction = {
  isAlcoholLabel: true,
  imageQuality: "good",
  brandName: clear("OLD TOM DISTILLERY"),
  classType: clear("Kentucky Straight Bourbon Whiskey"),
  alcoholContent: clear("45% ALC./VOL. (90 PROOF)"),
  netContents: clear("750 mL"),
  bottlerInfo: clear("Distilled and bottled by Old Tom Distillery, Bardstown, KY"),
  countryOfOrigin: absent,
  governmentWarning: clear(CANONICAL_WARNING),
  warningHeaderAllCaps: true,
  warningHeaderBold: true,
};

describe("verifyLabel — the three piles", () => {
  it("accepts a fully matching label, despite case differences", () => {
    const result = verifyLabel(app, goodExtraction);
    expect(result.verdict).toBe("accepted");
  });

  it("rejects on a hard mismatch (wrong ABV)", () => {
    const result = verifyLabel(app, {
      ...goodExtraction,
      alcoholContent: clear("40% ALC./VOL. (80 PROOF)"),
    });
    expect(result.verdict).toBe("rejected");
    const abv = result.checks.find((c) => c.field === "alcoholContent");
    expect(abv?.status).toBe("mismatch");
    expect(abv?.note).toContain("45");
    expect(abv?.note).toContain("40");
  });

  it("sends near-miss brand names to human review, not rejection", () => {
    const result = verifyLabel(app, {
      ...goodExtraction,
      brandName: clear("OLD TIM DISTILLERY"),
    });
    expect(result.verdict).toBe("needs_review");
  });

  it("sends unreadable fields to human review", () => {
    const result = verifyLabel(app, {
      ...goodExtraction,
      netContents: { text: "75", legibility: "partial" },
    });
    expect(result.verdict).toBe("needs_review");
  });

  it("flags non-label images for review without running checks", () => {
    const result = verifyLabel(app, { ...goodExtraction, isAlcoholLabel: false });
    expect(result.verdict).toBe("needs_review");
    expect(result.checks).toHaveLength(0);
  });

  it("accepts equivalent net contents in different units", () => {
    const result = verifyLabel(
      { ...app, netContents: "0.75 L" },
      goodExtraction,
    );
    expect(result.checks.find((c) => c.field === "netContents")?.status).toBe("match");
  });

  it("skips optional fields the application leaves blank", () => {
    const result = verifyLabel(app, goodExtraction);
    expect(result.checks.find((c) => c.field === "countryOfOrigin")?.status).toBe("skipped");
  });

  it("does not require ABV for beer when not provided", () => {
    const result = verifyLabel(
      { ...app, beverageType: "beer", alcoholContent: "" },
      { ...goodExtraction, alcoholContent: absent },
    );
    expect(result.checks.find((c) => c.field === "alcoholContent")?.status).toBe("skipped");
    expect(result.verdict).toBe("accepted");
  });
});

describe("checkWarning — strict by design", () => {
  it("accepts the canonical warning with confirmed formatting", () => {
    expect(checkWarning(clear(CANONICAL_WARNING), true, true).status).toBe("match");
  });

  it("accepts the warning when line-wrapped on the label", () => {
    const wrapped = CANONICAL_WARNING.replace(
      "should not drink",
      "should\nnot drink",
    );
    expect(checkWarning(clear(wrapped), true, true).status).toBe("match");
  });

  it("rejects Jenny's title-case warning", () => {
    const titleCase = CANONICAL_WARNING.replace(
      "GOVERNMENT WARNING:",
      "Government Warning:",
    );
    const result = checkWarning(clear(titleCase), false, true);
    expect(result.status).toBe("mismatch");
    expect(result.note).toContain("capital");
  });

  it("rejects reworded warnings even when close", () => {
    const reworded = CANONICAL_WARNING.replace("birth defects", "birth issues");
    expect(checkWarning(clear(reworded), true, true).status).toBe("mismatch");
  });

  it("rejects a missing warning outright", () => {
    expect(checkWarning(absent, null, null).status).toBe("mismatch");
  });

  it("catches model autocorrect: canonical transcription but header observed lowercase", () => {
    expect(checkWarning(clear(CANONICAL_WARNING), false, true).status).toBe("mismatch");
  });

  it("routes unconfirmed bold formatting to review, not acceptance", () => {
    expect(checkWarning(clear(CANONICAL_WARNING), true, false).status).toBe("needs_review");
  });

  it("routes an unreadable warning to review, not rejection", () => {
    expect(
      checkWarning({ text: "GOVERNMENT W...", legibility: "partial" }, null, null).status,
    ).toBe("needs_review");
  });
});
