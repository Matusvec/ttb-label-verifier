import type { CheckStatus, ExtractedField } from "./types";

/**
 * The Government Health Warning Statement mandated by 27 CFR Part 16.
 * Must appear verbatim; "GOVERNMENT WARNING" must be capitalized and bold.
 */
export const CANONICAL_WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should " +
  "not drink alcoholic beverages during pregnancy because of the risk of " +
  "birth defects. (2) Consumption of alcoholic beverages impairs your " +
  "ability to drive a car or operate machinery, and may cause health problems.";

/**
 * Collapse whitespace/line wraps and rejoin words hyphenated across line
 * breaks (real labels print e.g. "PREG-\nNANCY"), preserving case and
 * punctuation.
 */
function collapseWs(text: string): string {
  return text
    .replace(/(\p{L})-\s+(\p{L})/gu, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

const CANONICAL_HEADER = "GOVERNMENT WARNING:";
const CANONICAL_BODY = CANONICAL_WARNING.slice(CANONICAL_HEADER.length).trim();

export interface WarningCheckResult {
  status: CheckStatus;
  note: string;
}

/**
 * Strict, character-exact check of the government warning.
 *
 * Unlike every other field, this one tolerates nothing except line wrapping:
 * wording, punctuation, and capitalization must match the statute. The
 * model's independent header-capitalization observation is cross-checked
 * against the transcription to defend against the model "autocorrecting"
 * a non-compliant warning to the canonical text it knows from training.
 */
export function checkWarning(
  field: ExtractedField,
  headerAllCaps: boolean | null,
  headerBold: boolean | null,
): WarningCheckResult {
  if (field.legibility === "unreadable" || field.legibility === "partial") {
    return {
      status: "needs_review",
      note: "A warning statement appears to be present but could not be read reliably. Request a clearer image.",
    };
  }
  if (field.legibility === "absent" || !field.text) {
    return {
      status: "mismatch",
      note: "No government warning statement found on the label. The warning is mandatory on all alcohol beverages.",
    };
  }

  const found = collapseWs(field.text);

  // 27 CFR 16.21 prescribes case only for the header: "GOVERNMENT WARNING"
  // must be capitalized (and bold). Approved labels print the body in
  // sentence case or all caps, so the body is compared case-insensitively
  // but word-for-word.
  // Whitespace before the colon appears on TTB-approved labels, so the
  // header tolerates it; the capitalization itself stays strict.
  const headerMatch = found.match(/^GOVERNMENT WARNING\s*:/);
  if (!headerMatch) {
    const headerCaseWrong = /^government warning\s*:/i.test(found);
    return {
      status: "mismatch",
      note: headerCaseWrong
        ? "The \"GOVERNMENT WARNING\" header is not printed in all capital letters as required."
        : "Warning statement does not begin with the required \"GOVERNMENT WARNING:\" header.",
    };
  }
  const body = found.slice(headerMatch[0].length).trim();
  if (body.toLowerCase() !== CANONICAL_BODY.toLowerCase()) {
    return {
      status: "mismatch",
      note: "Warning text deviates from the mandatory statement. The warning must match 27 CFR Part 16 word-for-word.",
    };
  }

  // Transcription is canonical — cross-check the model's independent
  // formatting observations before trusting it.
  if (headerAllCaps === false) {
    return {
      status: "mismatch",
      note: "\"GOVERNMENT WARNING\" header is not printed in all capitals as required.",
    };
  }
  if (headerBold === false) {
    return {
      status: "needs_review",
      note: "Warning text matches, but the \"GOVERNMENT WARNING\" header does not appear bold. Verify formatting manually.",
    };
  }
  if (headerAllCaps === null || headerBold === null) {
    return {
      status: "needs_review",
      note: "Warning text matches, but header formatting could not be confirmed from the image.",
    };
  }
  return {
    status: "match",
    note: "Warning statement matches the mandatory text exactly, with a capitalized, bold header.",
  };
}
