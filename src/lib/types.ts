/** Beverage categories with distinct TTB labeling rules. */
export type BeverageType = "spirits" | "wine" | "beer";

/** What the applicant claims on their COLA application form. */
export interface ApplicationData {
  beverageType: BeverageType;
  brandName: string;
  classType: string;
  /** ABV as entered, e.g. "45", "45%", "45% Alc./Vol." Empty string = not provided. */
  alcoholContent: string;
  /** Net contents as entered, e.g. "750 mL", "12 fl oz". */
  netContents: string;
  /** Optional: bottler/producer name and address. */
  bottlerInfo?: string;
  /** Optional: country of origin (imports). */
  countryOfOrigin?: string;
}

/** Per-field legibility as observed by the vision model. */
export type Legibility = "clear" | "partial" | "unreadable" | "absent";

/** Verbatim transcription of one label field. */
export interface ExtractedField {
  /** Exact text as printed, preserving case and punctuation. Null if absent. */
  text: string | null;
  legibility: Legibility;
}

/** Structured output of the vision-model extraction pass. */
export interface LabelExtraction {
  isAlcoholLabel: boolean;
  imageQuality: "good" | "poor";
  brandName: ExtractedField;
  classType: ExtractedField;
  alcoholContent: ExtractedField;
  netContents: ExtractedField;
  bottlerInfo: ExtractedField;
  countryOfOrigin: ExtractedField;
  governmentWarning: ExtractedField;
  /** Whether the literal string "GOVERNMENT WARNING" appears in all capitals. */
  warningHeaderAllCaps: boolean | null;
  /** Whether the warning header appears bold relative to surrounding text. */
  warningHeaderBold: boolean | null;
  /** What category of beverage the label appears to be, judged from its content. */
  apparentBeverageType: BeverageType | "unknown";
}

export type CheckStatus = "match" | "mismatch" | "needs_review" | "skipped";

/** Result of comparing one field against the application. */
export interface FieldCheck {
  field: string;
  label: string;
  status: CheckStatus;
  expected: string | null;
  found: string | null;
  /** Human-readable explanation shown to the agent. */
  note: string;
}

/** The three piles agents sort applications into. */
export type Verdict = "accepted" | "rejected" | "needs_review";

export interface VerificationResult {
  verdict: Verdict;
  checks: FieldCheck[];
  /** Top-line explanation of the verdict. */
  summary: string;
}

/** Full API response for one label. */
export interface VerifyResponse {
  result: VerificationResult;
  extraction: LabelExtraction;
  /** Server-side processing time in milliseconds. */
  elapsedMs: number;
}
