import { describe, expect, it } from "vitest";
import {
  compareText,
  levenshtein,
  normalize,
  parseAbv,
  parseNetContents,
  sharesSignificantToken,
} from "../normalize";

describe("compareText", () => {
  it("treats identical strings as exact", () => {
    expect(compareText("OLD TOM DISTILLERY", "OLD TOM DISTILLERY")).toBe("exact");
  });

  it("treats case-only differences as a match (Dave's STONE'S THROW case)", () => {
    expect(compareText("Stone's Throw", "STONE'S THROW")).toBe("case_only");
  });

  it("treats curly vs straight apostrophes as a match", () => {
    expect(compareText("Stone's Throw", "STONE’S THROW")).toBe("case_only");
  });

  it("matches when the application value appears within longer label text (real K-J bottler line)", () => {
    expect(
      compareText(
        "Vinted & bottled by Kendall-Jackson Vineyards & Winery, Geyserville, California",
        "VINTED & BOTTLED BY KENDALL-JACKSON VINEYARDS & WINERY, GEYSERVILLE, CALIFORNIA | 1.800.769.3649",
      ),
    ).toBe("contains");
    expect(
      compareText("Lager", "ESTATE® SERIES HEIRLOOM LANDBIER BREWED WITH PURPLE EGYPTIAN BARLEY LAGER"),
    ).toBe("contains");
  });

  it("flags a label showing only part of the application value", () => {
    expect(compareText("Buffalo Trace Bourbon Cream", "BUFFALO TRACE")).toBe("contained");
  });

  it("flags near-misses as close, not matching", () => {
    expect(compareText("Old Tom Distillery", "Old Tim Distillery")).toBe("close");
  });

  it("treats different brands as different", () => {
    expect(compareText("Old Tom Distillery", "Sunset Ridge Cellars")).toBe("different");
  });
});

describe("levenshtein", () => {
  it("computes edit distance", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("same", "same")).toBe(0);
  });
});

describe("parseAbv", () => {
  it("parses percentage statements", () => {
    expect(parseAbv("45% Alc./Vol. (90 Proof)")).toBe(45);
    expect(parseAbv("ALC. 13.5% BY VOL.")).toBe(13.5);
    expect(parseAbv("5.2%")).toBe(5.2);
  });

  it("derives ABV from proof when no percentage is given", () => {
    expect(parseAbv("90 Proof")).toBe(45);
  });

  it("accepts a bare number from the application form", () => {
    expect(parseAbv("45")).toBe(45);
  });

  it("returns null for unparseable text", () => {
    expect(parseAbv("strong")).toBeNull();
    expect(parseAbv("")).toBeNull();
  });

  it("prefers the percentage when both percentage and proof are present", () => {
    expect(parseAbv("45% Alc./Vol. (90 Proof)")).toBe(45);
    // even when proof comes first
    expect(parseAbv("90 PROOF — 45% ALC/VOL")).toBe(45);
  });

  it("parses decimal percentages and bare decimals", () => {
    expect(parseAbv("ALC. 6.8% BY VOL.")).toBe(6.8);
    expect(parseAbv("13.5")).toBe(13.5);
  });
});

describe("parseNetContents", () => {
  it("normalizes volume units to milliliters", () => {
    expect(parseNetContents("750 mL")).toBe(750);
    expect(parseNetContents("750ml")).toBe(750);
    expect(parseNetContents("1 L")).toBe(1000);
    expect(parseNetContents("12 FL. OZ.")).toBeCloseTo(354.88, 1);
    expect(parseNetContents("5 GALS")).toBeCloseTo(parseNetContents("5 gallons"), 5);
  });

  it("returns null for unparseable text", () => {
    expect(parseNetContents("a bottle")).toBeNull();
  });

  it("sums compound imperial statements", () => {
    // Classic 22 oz bomber phrasing: 1 pint + 6 fl oz ≈ 650.6 mL
    expect(parseNetContents("1 PT. 6 FL. OZ.")).toBeCloseTo(650.6, 0);
  });

  it("does not double-count dual-unit restatements", () => {
    expect(parseNetContents("750 mL (25.4 FL OZ)")).toBe(750);
    expect(parseNetContents("12 FL OZ — 355 mL")).toBeCloseTo(354.88, 1);
  });

  it("parses pints and quarts", () => {
    expect(parseNetContents("1 PINT")).toBeCloseTo(473.2, 0);
    expect(parseNetContents("1 QT")).toBeCloseTo(946.4, 0);
    expect(parseNetContents("1.75 L")).toBe(1750);
  });
});

describe("normalize", () => {
  it("treats & and 'and' as equivalent", () => {
    expect(normalize("Kendall-Jackson Vineyards & Winery")).toBe(
      normalize("Kendall-Jackson Vineyards and Winery"),
    );
  });

  it("strips punctuation and collapses whitespace", () => {
    expect(normalize("  OLD   TOM. DISTILLERY! ")).toBe("old tom distillery");
  });
});

describe("sharesSignificantToken", () => {
  it("finds a shared distinctive token", () => {
    expect(
      sharesSignificantToken("GUINNESS MIDNIGHT HARMONY", "GUINNESS OPEN GATE BREWERY"),
    ).toBe(true);
  });

  it("ignores generic industry words", () => {
    expect(
      sharesSignificantToken("Old Tom Distillery", "Sunset Ridge Distillery"),
    ).toBe(false);
  });

  it("ignores short tokens", () => {
    expect(sharesSignificantToken("Old Tom", "Old Crow")).toBe(false);
  });
});
