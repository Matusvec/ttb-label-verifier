/**
 * Client-side image preparation. Phone photos routinely run 5–12 MB;
 * Vercel's request payload cap is 4.5 MB and the vision model needs
 * nowhere near that resolution. Downscaling in the browser keeps uploads
 * fast and inside platform limits.
 */

const MAX_DIMENSION = 2000;
const TARGET_TYPE = "image/jpeg";
const QUALITY = 0.88;
/** Images already smaller than this are sent untouched. */
const PASSTHROUGH_BYTES = 2 * 1024 * 1024;

/**
 * Downscale an image to at most 2000px on its long edge, re-encoded as
 * JPEG. Returns the original file when it is already small, or when the
 * browser cannot decode it (the server will then report a clear error).
 */
export async function prepareImage(file: File): Promise<File> {
  if (file.size <= PASSTHROUGH_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, TARGET_TYPE, QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
      type: TARGET_TYPE,
    });
  } catch {
    return file;
  }
}
