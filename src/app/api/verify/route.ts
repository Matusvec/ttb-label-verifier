import { NextRequest, NextResponse } from "next/server";
import { extractLabelFields } from "@/lib/extraction";
import { verifyLabel } from "@/lib/verify";
import { allowRequest } from "@/lib/rateLimit";
import type { ApplicationData, BeverageType, VerifyResponse } from "@/lib/types";

export const maxDuration = 30;

// Vercel's serverless request payload cap is 4.5 MB; the client downscales
// large images before upload, so anything bigger than this is anomalous.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const BEVERAGE_TYPES: BeverageType[] = ["spirits", "wine", "beer"];

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * POST /api/verify — verify one label image against application data.
 * Multipart form: `image` (file) + `application` (JSON string).
 */
export async function POST(req: NextRequest) {
  const clientId = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!allowRequest(clientId)) {
    return badRequest("Too many requests — please wait a minute and try again.", 429);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest("Expected multipart form data.");
  }

  const image = form.get("image");
  if (!(image instanceof File)) {
    return badRequest("Missing label image.");
  }
  if (!ALLOWED_TYPES.has(image.type)) {
    return badRequest("Unsupported image type — please upload a PNG, JPEG, or WebP.");
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return badRequest("Image is too large — please use an image under 4 MB.");
  }

  let app: ApplicationData;
  try {
    const raw = JSON.parse(String(form.get("application") ?? ""));
    app = {
      beverageType: BEVERAGE_TYPES.includes(raw.beverageType) ? raw.beverageType : "spirits",
      brandName: String(raw.brandName ?? "").trim(),
      classType: String(raw.classType ?? "").trim(),
      alcoholContent: String(raw.alcoholContent ?? "").trim(),
      netContents: String(raw.netContents ?? "").trim(),
      bottlerInfo: String(raw.bottlerInfo ?? "").trim() || undefined,
      countryOfOrigin: String(raw.countryOfOrigin ?? "").trim() || undefined,
    };
  } catch {
    return badRequest("Invalid application data.");
  }
  if (!app.brandName || !app.classType) {
    return badRequest("Brand name and class/type are required.");
  }

  const started = Date.now();
  try {
    const bytes = Buffer.from(await image.arrayBuffer()).toString("base64");
    const extraction = await extractLabelFields(bytes, image.type);
    const result = verifyLabel(app, extraction);
    const body: VerifyResponse = {
      result,
      extraction,
      elapsedMs: Date.now() - started,
    };
    return NextResponse.json(body);
  } catch (err) {
    console.error("verify failed:", err);
    return badRequest(
      "The label could not be analyzed right now. Please try again in a moment.",
      502,
    );
  }
}
