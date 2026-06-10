import { GoogleGenAI, Type } from "@google/genai";
import type { LabelExtraction } from "./types";

/**
 * Vision-model extraction layer. This is the ONLY file that talks to an
 * LLM; swapping providers (e.g. a self-hosted VLM inside a restricted
 * network) means reimplementing just `extractLabelFields`.
 */

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

const fieldSchema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING, nullable: true },
    legibility: {
      type: Type.STRING,
      enum: ["clear", "partial", "unreadable", "absent"],
    },
  },
  required: ["text", "legibility"],
};

const extractionSchema = {
  type: Type.OBJECT,
  properties: {
    isAlcoholLabel: { type: Type.BOOLEAN },
    imageQuality: { type: Type.STRING, enum: ["good", "poor"] },
    brandName: fieldSchema,
    classType: fieldSchema,
    alcoholContent: fieldSchema,
    netContents: fieldSchema,
    bottlerInfo: fieldSchema,
    countryOfOrigin: fieldSchema,
    governmentWarning: fieldSchema,
    warningHeaderAllCaps: { type: Type.BOOLEAN, nullable: true },
    warningHeaderBold: { type: Type.BOOLEAN, nullable: true },
    apparentBeverageType: {
      type: Type.STRING,
      enum: ["spirits", "wine", "beer", "unknown"],
    },
  },
  required: [
    "isAlcoholLabel",
    "imageQuality",
    "brandName",
    "classType",
    "alcoholContent",
    "netContents",
    "bottlerInfo",
    "countryOfOrigin",
    "governmentWarning",
    "warningHeaderAllCaps",
    "warningHeaderBold",
    "apparentBeverageType",
  ],
};

const PROMPT = `You are transcribing an alcohol beverage label image for a TTB compliance check.

Transcribe each field EXACTLY as printed on the label — preserve the original capitalization, punctuation, and spelling character-for-character, even if the text contains errors or unusual formatting. Do NOT correct, normalize, or substitute text you expect to see. If the label's wording differs from standard or legally required wording, report what is physically printed, not the standard wording.

Fields to extract:
- brandName: the brand name (the most prominent product name)
- classType: the class/type designation (e.g. "Kentucky Straight Bourbon Whiskey", "India Pale Ale", "Cabernet Sauvignon")
- alcoholContent: the alcohol content statement (e.g. "45% Alc./Vol. (90 Proof)")
- netContents: the net contents statement (e.g. "750 mL")
- bottlerInfo: bottler/producer/importer name and address line
- countryOfOrigin: country of origin statement (e.g. "Product of France")
- governmentWarning: the full government health warning statement, transcribed verbatim including its header, preserving the exact capitalization printed on the label

For each field set legibility: "clear" (confidently readable), "partial" (readable with uncertainty), "unreadable" (present but not readable), or "absent" (not on the label). When a field is absent, set its text to null.

Separately observe the government warning header:
- warningHeaderAllCaps: true only if the words "GOVERNMENT WARNING" are printed entirely in capital letters; false if any letter is lowercase; null if no warning or unreadable.
- warningHeaderBold: true if the header appears bolder than the body of the warning; false if not; null if you cannot tell.

Also set:
- isAlcoholLabel: false if the image is not an alcohol beverage label at all.
- imageQuality: "poor" if blur, glare, angle, or lighting could make any transcription unreliable; otherwise "good".
- apparentBeverageType: judging from the label's content, whether this is "spirits" (distilled: whiskey, vodka, gin, rum, tequila, liqueur), "wine" (incl. cider, sake), "beer" (incl. ale, lager, stout, malt beverages), or "unknown" if unclear.`;

/**
 * Extract structured, verbatim field transcriptions from a label image.
 * @param imageBase64 Base64-encoded image bytes (no data: prefix).
 * @param mimeType Image MIME type, e.g. "image/png".
 */
export async function extractLabelFields(
  imageBase64: string,
  mimeType: string,
): Promise<LabelExtraction> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: PROMPT },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: extractionSchema,
      // Disable thinking for latency — extraction is perception, not reasoning,
      // and the 5-second budget is the product's hardest requirement.
      thinkingConfig: { thinkingBudget: 0 },
      temperature: 0,
    },
  });
  const text = response.text;
  if (!text) {
    throw new Error("Vision model returned an empty response");
  }
  return JSON.parse(text) as LabelExtraction;
}
