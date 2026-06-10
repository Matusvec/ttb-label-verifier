/**
 * Deterministic text normalization and fuzzy comparison.
 *
 * All "judgment" matching lives here as plain string algorithms — fast,
 * free, offline, and unit-testable — rather than inside an LLM prompt.
 */

/** Lowercase, trim, collapse whitespace, strip punctuation, unify quotes. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[.,;:!?"()\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Classic Levenshtein edit distance (iterative, two-row). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

export type TextSimilarity = "exact" | "case_only" | "close" | "different";

/**
 * Compare two strings the way a reasonable agent would:
 * identical → exact; differs only in case/punctuation/spacing → case_only;
 * small edit distance (≤1 edit per 8 chars, min 1) → close; else different.
 */
export function compareText(expected: string, found: string): TextSimilarity {
  if (expected === found) return "exact";
  const ne = normalize(expected);
  const nf = normalize(found);
  if (ne === nf) return "case_only";
  const dist = levenshtein(ne, nf);
  const threshold = Math.max(1, Math.floor(Math.max(ne.length, nf.length) / 8));
  return dist <= threshold ? "close" : "different";
}

/** Parse an alcohol-content string to a percentage number, or null. */
export function parseAbv(text: string): number | null {
  // Prefer an explicit percentage: "45% Alc./Vol.", "ALC. 13.5% BY VOL", "5.0%"
  const pct = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct) return parseFloat(pct[1]);
  // "90 proof" → 45%
  const proof = text.match(/(\d+(?:\.\d+)?)\s*proof/i);
  if (proof) return parseFloat(proof[1]) / 2;
  // Bare number, e.g. the form just says "45"
  const bare = text.trim().match(/^(\d+(?:\.\d+)?)$/);
  if (bare) return parseFloat(bare[1]);
  return null;
}

const ML_PER_UNIT: Record<string, number> = {
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  cl: 10,
  l: 1000,
  liter: 1000,
  liters: 1000,
  litre: 1000,
  litres: 1000,
  oz: 29.5735,
  "fl oz": 29.5735,
  "fluid ounce": 29.5735,
  "fluid ounces": 29.5735,
  gal: 3785.41,
  gallon: 3785.41,
  gallons: 3785.41,
};

/** Parse a net-contents string to milliliters, or null. */
export function parseNetContents(text: string): number | null {
  const m = text
    .toLowerCase()
    .replace(/(?<=[a-z])\./g, "")
    .match(/(\d+(?:\.\d+)?)\s*(fl\s*oz|fluid ounces?|milliliters?|litres?|liters?|gallons?|ml|cl|l|oz|gal)\b/);
  if (!m) return null;
  const unit = m[2].replace(/\s+/g, " ").trim();
  const factor = ML_PER_UNIT[unit];
  return factor ? parseFloat(m[1]) * factor : null;
}
