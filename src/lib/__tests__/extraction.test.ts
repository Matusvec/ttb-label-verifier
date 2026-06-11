import { describe, expect, it } from "vitest";
import { validateExtraction } from "../extraction";

const field = (text: string | null = "x") => ({ text, legibility: "clear" });

const valid = {
  isAlcoholLabel: true,
  imageQuality: "good",
  brandName: field(),
  classType: field(),
  alcoholContent: field(),
  netContents: field(),
  bottlerInfo: field(null),
  countryOfOrigin: field(null),
  governmentWarning: field(),
  warningHeaderAllCaps: true,
  warningHeaderBold: null,
  apparentBeverageType: "spirits",
};

describe("validateExtraction — trust boundary for model output", () => {
  it("accepts a well-formed extraction", () => {
    expect(validateExtraction(valid)).toEqual(valid);
  });

  it("rejects non-objects", () => {
    expect(() => validateExtraction(null)).toThrow(/malformed/);
    expect(() => validateExtraction("text")).toThrow(/malformed/);
  });

  it("rejects a missing field object", () => {
    const { brandName: _omitted, ...rest } = valid;
    expect(() => validateExtraction(rest)).toThrow(/brandName/);
  });

  it("rejects an invalid legibility value", () => {
    expect(() =>
      validateExtraction({ ...valid, netContents: { text: "750", legibility: "fuzzy" } }),
    ).toThrow(/netContents/);
  });

  it("rejects non-string field text", () => {
    expect(() =>
      validateExtraction({ ...valid, alcoholContent: { text: 45, legibility: "clear" } }),
    ).toThrow(/alcoholContent/);
  });

  it("rejects an unexpected beverage type", () => {
    expect(() => validateExtraction({ ...valid, apparentBeverageType: "mead" })).toThrow(
      /apparentBeverageType/,
    );
  });

  it("rejects a non-boolean header observation", () => {
    expect(() => validateExtraction({ ...valid, warningHeaderAllCaps: "yes" })).toThrow(
      /warningHeaderAllCaps/,
    );
  });
});
