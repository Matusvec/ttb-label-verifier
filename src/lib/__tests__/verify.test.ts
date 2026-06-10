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
  apparentBeverageType: "spirits",
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

  it("routes partial brand overlap to review (blind test: Guinness)", () => {
    const result = verifyLabel(
      { ...app, brandName: "GUINNESS MIDNIGHT HARMONY" },
      { ...goodExtraction, brandName: clear("GUINNESS OPEN GATE BREWERY") },
    );
    expect(result.checks.find((c) => c.field === "brandName")?.status).toBe("needs_review");
  });

  it("still rejects entirely different brands", () => {
    const result = verifyLabel(app, {
      ...goodExtraction,
      brandName: clear("SUNSET RIDGE CELLARS"),
    });
    expect(result.verdict).toBe("rejected");
  });

  it("routes class-code vs label-designation differences to review, not rejection (blind test: La Crema)", () => {
    const result = verifyLabel(
      { ...app, beverageType: "wine", classType: "TABLE RED WINE" },
      { ...goodExtraction, classType: clear("PINOT NOIR") },
    );
    expect(result.checks.find((c) => c.field === "classType")?.status).toBe("needs_review");
    expect(result.verdict).toBe("needs_review");
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

  it("flags a beverage-type contradiction (manual test: whiskey label filed as beer)", () => {
    const result = verifyLabel(
      {
        beverageType: "beer",
        brandName: "Ston THROW",
        classType: "Straight Ryes",
        alcoholContent: "47.5% Alc./Vol.",
        netContents: "750 mL",
      },
      {
        ...goodExtraction,
        brandName: clear("STONE'S THROW"),
        classType: clear("Straight Rye Whiskey"),
        alcoholContent: clear("47.5% ALC./VOL."),
        apparentBeverageType: "spirits",
      },
    );
    expect(result.verdict).toBe("needs_review");
    const bev = result.checks.find((c) => c.field === "beverageType");
    expect(bev?.status).toBe("needs_review");
    expect(bev?.note).toContain("beer");
    expect(bev?.note).toContain("spirits");
  });

  it("matches when label content agrees with the filed beverage type", () => {
    const result = verifyLabel(app, goodExtraction);
    expect(result.checks.find((c) => c.field === "beverageType")?.status).toBe("match");
  });

  it("skips the beverage-type check when the label is ambiguous", () => {
    const result = verifyLabel(app, { ...goodExtraction, apparentBeverageType: "unknown" });
    expect(result.checks.find((c) => c.field === "beverageType")?.status).toBe("skipped");
    expect(result.verdict).toBe("accepted");
  });

  it("routes poor image quality to review even when all fields match", () => {
    const result = verifyLabel(app, { ...goodExtraction, imageQuality: "poor" });
    expect(result.verdict).toBe("needs_review");
  });

  it("treats proof-only label ABV as equivalent to a percentage application", () => {
    const result = verifyLabel(
      { ...app, alcoholContent: "45% Alc./Vol." },
      { ...goodExtraction, alcoholContent: clear("90 PROOF") },
    );
    expect(result.checks.find((c) => c.field === "alcoholContent")?.status).toBe("match");
  });

  it("rejects a half-percent ABV discrepancy", () => {
    const result = verifyLabel(
      { ...app, alcoholContent: "45%" },
      { ...goodExtraction, alcoholContent: clear("45.5% ALC./VOL.") },
    );
    expect(result.verdict).toBe("rejected");
  });

  it("rejects a missing brand name", () => {
    const result = verifyLabel(app, {
      ...goodExtraction,
      brandName: { text: null, legibility: "absent" },
    });
    expect(result.verdict).toBe("rejected");
  });

  it("requires ABV on the label for spirits", () => {
    const result = verifyLabel(app, { ...goodExtraction, alcoholContent: absent });
    expect(result.verdict).toBe("rejected");
  });

  it("routes a label missing ABV to review for wine when the application states one", () => {
    const result = verifyLabel(
      { ...app, beverageType: "wine" },
      { ...goodExtraction, apparentBeverageType: "wine", alcoholContent: absent },
    );
    expect(result.checks.find((c) => c.field === "alcoholContent")?.status).toBe("needs_review");
  });

  it("matches a country of origin embedded in a longer statement (real Glenfiddich)", () => {
    const result = verifyLabel(
      { ...app, countryOfOrigin: "United Kingdom" },
      { ...goodExtraction, countryOfOrigin: clear("PRODUCT OF UNITED KINGDOM") },
    );
    expect(result.checks.find((c) => c.field === "countryOfOrigin")?.status).toBe("match");
  });

  it("falls back to text comparison when net contents cannot be parsed", () => {
    const result = verifyLabel(
      { ...app, netContents: "one standard bottle" },
      { ...goodExtraction, netContents: clear("One Standard Bottle") },
    );
    expect(result.checks.find((c) => c.field === "netContents")?.status).toBe("match");
  });

  it("does not require ABV for beer when not provided", () => {
    const result = verifyLabel(
      { ...app, beverageType: "beer", alcoholContent: "" },
      { ...goodExtraction, apparentBeverageType: "beer", alcoholContent: absent },
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

  it("tolerates whitespace before the header colon (blind test: approved Glenfiddich label)", () => {
    const spaced = CANONICAL_WARNING.replace(
      "GOVERNMENT WARNING:",
      "GOVERNMENT WARNING :",
    );
    expect(checkWarning(clear(spaced), true, true).status).toBe("match");
  });

  it("accepts an all-caps body with hyphenated line wraps (real Buffalo Trace label)", () => {
    const allCaps = CANONICAL_WARNING.toUpperCase().replace(
      "PREGNANCY",
      "PREG-\nNANCY",
    );
    expect(checkWarning(clear(allCaps), true, true).status).toBe("match");
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
