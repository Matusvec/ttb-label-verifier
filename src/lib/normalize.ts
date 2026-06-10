/**
 * Deterministic text normalization and fuzzy comparison.
 *
 * All "judgment" matching lives here as plain string algorithms — fast,
 * free, offline, and unit-testable — rather than inside an LLM prompt.
 */

/**
 * Lowercase, trim, collapse whitespace, strip punctuation, unify quotes,
 * and treat "&" and "and" as equivalent (bottler names use both).
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s*&\s*/g, " and ")
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

export type TextSimilarity =
  | "exact"
  | "case_only"
  | "contains"
  | "contained"
  | "close"
  | "different";

/**
 * Compare two strings the way a reasonable agent would:
 * identical → exact; differs only in case/punctuation/spacing → case_only;
 * the expected value appears inside the label text (labels surround
 * required info with extra words: "…HEIRLOOM LANDBIER…LAGER", bottler
 * lines with phone numbers) → contains; the label shows only part of the
 * expected value → contained; small edit distance (≤1 edit per 8 chars,
 * min 1) → close; else different.
 */
export function compareText(expected: string, found: string): TextSimilarity {
  if (expected === found) return "exact";
  const ne = normalize(expected);
  const nf = normalize(found);
  if (ne === nf) return "case_only";
  if (ne.length >= 4 && nf.includes(ne)) return "contains";
  if (nf.length >= 4 && ne.includes(nf)) return "contained";
  const dist = levenshtein(ne, nf);
  const threshold = Math.max(1, Math.floor(Math.max(ne.length, nf.length) / 8));
  return dist <= threshold ? "close" : "different";
}

const GENERIC_TOKENS = new Set([
  "distillery", "distilling", "brewery", "brewing", "winery", "cellars",
  "vineyards", "vineyard", "company", "wines", "spirits", "estate",
]);

/**
 * True when two names share a distinctive word (≥4 chars, not a generic
 * industry term) — e.g. "GUINNESS OPEN GATE BREWERY" and "GUINNESS
 * MIDNIGHT HARMONY" share "guinness". Used to route partial brand
 * overlaps to human review instead of rejection.
 */
export function sharesSignificantToken(a: string, b: string): boolean {
  const tokens = (s: string) =>
    new Set(
      normalize(s)
        .split(" ")
        .filter((t) => t.length >= 4 && !GENERIC_TOKENS.has(t)),
    );
  const ta = tokens(a);
  for (const t of tokens(b)) if (ta.has(t)) return true;
  return false;
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
  pt: 473.176,
  pint: 473.176,
  pints: 473.176,
  qt: 946.353,
  quart: 946.353,
  quarts: 946.353,
  gal: 3785.41,
  gals: 3785.41,
  gallon: 3785.41,
  gallons: 3785.41,
};

const UNIT_PATTERN =
  /(\d+(?:\.\d+)?)\s*(fl\s*oz|fluid ounces?|milliliters?|litres?|liters?|gallons?|gals?|pints?|quarts?|ml|cl|l|oz|pt|qt)\b/g;

/**
 * Parse a net-contents string to milliliters, or null.
 *
 * Handles three real label shapes:
 * - single statement: "750 mL" → 750
 * - compound imperial (descending units): "1 PT. 6 FL. OZ." → 473.2 + 177.4
 * - dual statement of the same volume: "750 mL (25.4 FL OZ)" → 750
 */
export function parseNetContents(text: string): number | null {
  const cleaned = text.toLowerCase().replace(/(?<=[a-z])\./g, "");
  const parts: { factor: number; ml: number }[] = [];
  for (const m of cleaned.matchAll(UNIT_PATTERN)) {
    const unit = m[2].replace(/\s+/g, " ").trim();
    const factor = ML_PER_UNIT[unit];
    if (!factor) return null;
    parts.push({ factor, ml: parseFloat(m[1]) * factor });
  }
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0].ml;
  // Strictly descending unit sizes ("1 PT" then "6 FL OZ") = one compound
  // quantity; anything else ("750 mL (25.4 FL OZ)") restates the volume.
  const descending = parts.every((p, i) => i === 0 || p.factor < parts[i - 1].factor);
  const restated = parts.every((p) => Math.abs(p.ml - parts[0].ml) / parts[0].ml < 0.05);
  if (restated) return parts[0].ml;
  if (descending) return parts.reduce((sum, p) => sum + p.ml, 0);
  return parts[0].ml;
}
