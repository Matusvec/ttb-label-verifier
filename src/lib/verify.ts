import { compareText, parseAbv, parseNetContents } from "./normalize";
import { checkWarning } from "./warning";
import type {
  ApplicationData,
  ExtractedField,
  FieldCheck,
  LabelExtraction,
  VerificationResult,
} from "./types";

/**
 * Compare one free-text field with agent-style judgment: exact and
 * case/punctuation-only differences are matches, near-misses go to human
 * review, everything else is a mismatch.
 */
function checkFuzzyField(
  field: string,
  label: string,
  expected: string,
  extracted: ExtractedField,
): FieldCheck {
  const base = { field, label, expected, found: extracted.text };
  if (extracted.legibility === "absent" || !extracted.text) {
    return { ...base, status: "mismatch", note: `${label} not found on the label.` };
  }
  if (extracted.legibility !== "clear") {
    return {
      ...base,
      status: "needs_review",
      note: `${label} could not be read reliably from the image.`,
    };
  }
  switch (compareText(expected, extracted.text)) {
    case "exact":
      return { ...base, status: "match", note: "Exact match." };
    case "case_only":
      return {
        ...base,
        status: "match",
        note: "Match (differs only in capitalization/punctuation).",
      };
    case "close":
      return {
        ...base,
        status: "needs_review",
        note: "Very similar but not identical — possible typo. Verify manually.",
      };
    default:
      return {
        ...base,
        status: "mismatch",
        note: `Label does not match the application.`,
      };
  }
}

function checkAbv(app: ApplicationData, extracted: ExtractedField): FieldCheck {
  const base = {
    field: "alcoholContent",
    label: "Alcohol content",
    expected: app.alcoholContent || null,
    found: extracted.text,
  };
  const required = app.beverageType === "spirits";
  if (!app.alcoholContent.trim()) {
    return {
      ...base,
      status: required ? "needs_review" : "skipped",
      note: required
        ? "No ABV on the application, but it is mandatory for distilled spirits."
        : "Not provided on application; ABV is optional for this beverage type.",
    };
  }
  if (extracted.legibility === "absent" || !extracted.text) {
    return {
      ...base,
      status: required ? "mismatch" : "needs_review",
      note: required
        ? "Alcohol content not found on the label (mandatory for distilled spirits)."
        : "Alcohol content on application but not found on label.",
    };
  }
  if (extracted.legibility !== "clear") {
    return { ...base, status: "needs_review", note: "Alcohol content could not be read reliably." };
  }
  const expectedPct = parseAbv(app.alcoholContent);
  const foundPct = parseAbv(extracted.text);
  if (expectedPct === null || foundPct === null) {
    return { ...base, status: "needs_review", note: "Could not interpret the alcohol content as a percentage." };
  }
  if (Math.abs(expectedPct - foundPct) < 0.05) {
    return { ...base, status: "match", note: `Both state ${expectedPct}% alcohol by volume.` };
  }
  return {
    ...base,
    status: "mismatch",
    note: `Application states ${expectedPct}% but label states ${foundPct}%.`,
  };
}

function checkNetContents(app: ApplicationData, extracted: ExtractedField): FieldCheck {
  const base = {
    field: "netContents",
    label: "Net contents",
    expected: app.netContents || null,
    found: extracted.text,
  };
  if (!app.netContents.trim()) {
    return { ...base, status: "skipped", note: "Not provided on application." };
  }
  if (extracted.legibility === "absent" || !extracted.text) {
    return { ...base, status: "mismatch", note: "Net contents not found on the label." };
  }
  if (extracted.legibility !== "clear") {
    return { ...base, status: "needs_review", note: "Net contents could not be read reliably." };
  }
  const expectedMl = parseNetContents(app.netContents);
  const foundMl = parseNetContents(extracted.text);
  if (expectedMl === null || foundMl === null) {
    // Fall back to fuzzy text comparison when units can't be parsed.
    return checkFuzzyField("netContents", "Net contents", app.netContents, extracted);
  }
  if (Math.abs(expectedMl - foundMl) < 1) {
    return { ...base, status: "match", note: "Volumes are equivalent." };
  }
  return {
    ...base,
    status: "mismatch",
    note: `Application states ${app.netContents} but label states ${extracted.text}.`,
  };
}

/** Optional field: verified only when the application provides a value. */
function checkOptionalField(
  field: string,
  label: string,
  expected: string | undefined,
  extracted: ExtractedField,
): FieldCheck {
  if (!expected?.trim()) {
    return {
      field,
      label,
      expected: null,
      found: extracted.text,
      status: "skipped",
      note: "Not provided on application.",
    };
  }
  return checkFuzzyField(field, label, expected, extracted);
}

/**
 * Run every field check and roll the results up into one of the three
 * piles: any mismatch → rejected; otherwise any needs_review → needs
 * review; otherwise accepted.
 */
export function verifyLabel(
  app: ApplicationData,
  extraction: LabelExtraction,
): VerificationResult {
  if (!extraction.isAlcoholLabel) {
    return {
      verdict: "needs_review",
      checks: [],
      summary: "The uploaded image does not appear to be an alcohol beverage label. Verify the correct file was uploaded.",
    };
  }

  const checks: FieldCheck[] = [
    checkFuzzyField("brandName", "Brand name", app.brandName, extraction.brandName),
    checkFuzzyField("classType", "Class/type", app.classType, extraction.classType),
    checkAbv(app, extraction.alcoholContent),
    checkNetContents(app, extraction.netContents),
    checkOptionalField("bottlerInfo", "Bottler name & address", app.bottlerInfo, extraction.bottlerInfo),
    checkOptionalField("countryOfOrigin", "Country of origin", app.countryOfOrigin, extraction.countryOfOrigin),
    {
      field: "governmentWarning",
      label: "Government warning",
      expected: "Mandatory statement (27 CFR Part 16)",
      found: extraction.governmentWarning.text,
      ...checkWarning(
        extraction.governmentWarning,
        extraction.warningHeaderAllCaps,
        extraction.warningHeaderBold,
      ),
    },
  ];

  const mismatches = checks.filter((c) => c.status === "mismatch");
  const reviews = checks.filter((c) => c.status === "needs_review");

  if (mismatches.length > 0) {
    return {
      verdict: "rejected",
      checks,
      summary: `${mismatches.length} field${mismatches.length > 1 ? "s do" : " does"} not match the application: ${mismatches.map((c) => c.label.toLowerCase()).join(", ")}.`,
    };
  }
  if (reviews.length > 0 || extraction.imageQuality === "poor") {
    return {
      verdict: "needs_review",
      checks,
      summary:
        reviews.length > 0
          ? `Needs human review: ${reviews.map((c) => c.label.toLowerCase()).join(", ")}.`
          : "All fields match, but image quality is poor — verify against a clearer image.",
    };
  }
  return {
    verdict: "accepted",
    checks,
    summary: "All label fields match the application.",
  };
}
