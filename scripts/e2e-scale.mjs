/**
 * Scale test for Sarah's peak-season scenario: a 200-label batch (importers
 * "dump 200, 300 label applications at once"). Cycles the bundled sample
 * cases to build N jobs, runs them at the same concurrency the UI uses,
 * and reports throughput, latency percentiles, and verdict accuracy.
 * Usage: node scripts/e2e-scale.mjs [count] [baseUrl]
 */
import { readFileSync } from "node:fs";

const COUNT = Number(process.argv[2] ?? 200);
const BASE = process.argv[3] ?? "http://localhost:3000";
const CONCURRENCY = 4;

const CASES = [
  { id: "old-tom-pass", expect: "accepted", app: { beverageType: "spirits", brandName: "Old Tom Distillery", classType: "Kentucky Straight Bourbon Whiskey", alcoholContent: "45% Alc./Vol. (90 Proof)", netContents: "750 mL" } },
  { id: "stones-throw", expect: "accepted", app: { beverageType: "spirits", brandName: "Stone's Throw", classType: "Straight Rye Whiskey", alcoholContent: "47.5% Alc./Vol.", netContents: "750 mL" } },
  { id: "old-tom-wrong-abv", expect: "rejected", app: { beverageType: "spirits", brandName: "Old Tom Distillery", classType: "Kentucky Straight Bourbon Whiskey", alcoholContent: "45% Alc./Vol. (90 Proof)", netContents: "750 mL" } },
  { id: "title-case-warning", expect: "rejected", app: { beverageType: "wine", brandName: "Sunset Ridge Cellars", classType: "Cabernet Sauvignon", alcoholContent: "13.5% Alc. by Vol.", netContents: "750 mL" } },
  { id: "hop-haven-missing-warning", expect: "rejected", app: { beverageType: "beer", brandName: "Hop Haven Brewing Co.", classType: "India Pale Ale", alcoholContent: "6.8% Alc./Vol.", netContents: "12 FL. OZ." } },
];

const images = new Map(
  CASES.map((c) => [c.id, readFileSync(new URL(`../public/samples/${c.id}.png`, import.meta.url))]),
);

const jobs = Array.from({ length: COUNT }, (_, i) => CASES[i % CASES.length]);
const latencies = [];
let correct = 0;
let errors = 0;
let next = 0;

const started = Date.now();
async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++];
    const form = new FormData();
    form.append("image", new Blob([images.get(job.id)], { type: "image/png" }), `${job.id}.png`);
    form.append("application", JSON.stringify(job.app));
    const t0 = Date.now();
    try {
      const res = await fetch(`${BASE}/api/verify`, { method: "POST", body: form });
      const body = await res.json();
      latencies.push(Date.now() - t0);
      if (!res.ok) {
        errors++;
        if (errors <= 5) console.log(`  error: HTTP ${res.status} — ${body.error}`);
      } else if (body.result.verdict === job.expect) {
        correct++;
      } else {
        console.log(`  WRONG: ${job.id} expected=${job.expect} got=${body.result.verdict}`);
      }
    } catch (err) {
      errors++;
      latencies.push(Date.now() - t0);
      if (errors <= 5) console.log(`  error: ${err.message}`);
    }
    const done = correct + errors + (latencies.length - correct - errors);
    if (done % 25 === 0) console.log(`  ${latencies.length}/${COUNT} done...`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const wall = (Date.now() - started) / 1000;
latencies.sort((a, b) => a - b);
const pct = (p) => (latencies[Math.floor((latencies.length - 1) * p)] / 1000).toFixed(1);
console.log(`\n${COUNT} labels in ${(wall / 60).toFixed(1)} min (${(COUNT / wall).toFixed(1)} labels/sec sustained)`);
console.log(`latency p50=${pct(0.5)}s p95=${pct(0.95)}s max=${pct(1)}s`);
console.log(`verdicts: ${correct}/${COUNT} correct, ${errors} errors`);
process.exit(errors > COUNT * 0.02 || correct < COUNT - errors ? 1 : 0);
