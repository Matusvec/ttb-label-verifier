import { prepareImage } from "./clientImage";
import type { ApplicationData, VerifyResponse } from "./types";

/**
 * Submit one label image + application data to the verification API.
 * Large images are downscaled client-side first. Throws an Error with a
 * user-facing message on failure.
 */
export async function verifyOne(
  image: File,
  application: ApplicationData,
): Promise<VerifyResponse> {
  const form = new FormData();
  form.append("image", await prepareImage(image));
  form.append("application", JSON.stringify(application));
  let res: Response;
  try {
    res = await fetch("/api/verify", { method: "POST", body: form });
  } catch {
    throw new Error("Could not reach the server — check your connection and try again.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? "Something went wrong while checking the label.");
  }
  return body as VerifyResponse;
}

/**
 * Run jobs with bounded concurrency, reporting completion as it happens.
 * Used by batch mode so 300 labels don't run one at a time (or all at once).
 */
export async function runWithConcurrency<T>(
  jobs: (() => Promise<T>)[],
  limit: number,
  onProgress?: (completed: number) => void,
): Promise<T[]> {
  const results: T[] = new Array(jobs.length);
  let next = 0;
  let completed = 0;
  async function worker() {
    while (next < jobs.length) {
      const index = next++;
      results[index] = await jobs[index]();
      completed++;
      onProgress?.(completed);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, jobs.length) }, () => worker()),
  );
  return results;
}
