/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * Good enough to stop casual abuse of the public prototype; state is
 * per-serverless-instance, so a production deployment would use a shared
 * store (e.g. Upstash) instead. Defense in depth: the Gemini account also
 * carries a hard spend cap.
 */

// Sized for the legitimate heavy case: a 200–300 label batch at
// concurrency 4 (~70 requests/min sustained) must never trip the limit,
// while runaway scripted abuse still does. The Gemini account's hard
// spend cap remains the backstop.
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 150;

const hits = new Map<string, number[]>();

/** Returns true if this client is within its request budget. */
export function allowRequest(clientId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(clientId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    hits.set(clientId, recent);
    return false;
  }
  recent.push(now);
  hits.set(clientId, recent);
  // Opportunistic cleanup so the map can't grow unboundedly.
  if (hits.size > 1000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
    }
  }
  return true;
}
