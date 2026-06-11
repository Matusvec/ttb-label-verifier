/**
 * Live end-to-end check: runs every bundled sample case through the running
 * dev server and compares the verdict against the expected pile.
 * Usage: node scripts/e2e-samples.mjs [baseUrl]
 */
import { readFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";

const CASES = [
  {
    id: "old-tom-pass",
    expect: "accepted",
    app: {
      beverageType: "spirits",
      brandName: "Old Tom Distillery",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
      bottlerInfo: "Distilled and Bottled by Old Tom Distillery, Bardstown, KY",
    },
  },
  {
    id: "stones-throw",
    expect: "accepted",
    app: {
      beverageType: "spirits",
      brandName: "Stone's Throw",
      classType: "Straight Rye Whiskey",
      alcoholContent: "47.5% Alc./Vol.",
      netContents: "750 mL",
    },
  },
  {
    id: "old-tom-wrong-abv",
    expect: "rejected",
    app: {
      beverageType: "spirits",
      brandName: "Old Tom Distillery",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
    },
  },
  {
    id: "title-case-warning",
    expect: "rejected",
    app: {
      beverageType: "wine",
      brandName: "Sunset Ridge Cellars",
      classType: "Cabernet Sauvignon",
      alcoholContent: "13.5% Alc. by Vol.",
      netContents: "750 mL",
    },
  },
  {
    id: "near-miss-brand",
    expect: "needs_review",
    app: {
      beverageType: "spirits",
      brandName: "Old Tom Distillery",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
    },
  },
  {
    id: "reworded-warning",
    expect: "rejected",
    app: {
      beverageType: "spirits",
      brandName: "Juniper & Pine",
      classType: "Dry Gin",
      alcoholContent: "43% Alc./Vol.",
      netContents: "750 mL",
    },
  },
  {
    id: "wrong-net-contents",
    expect: "rejected",
    app: {
      beverageType: "spirits",
      brandName: "Old Tom Distillery",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
    },
  },
  {
    id: "proof-only-abv",
    expect: "accepted",
    app: {
      beverageType: "spirits",
      brandName: "Copper Canyon",
      classType: "Straight Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol.",
      netContents: "750 mL",
    },
  },
  {
    id: "hop-haven-missing-warning",
    expect: "rejected",
    app: {
      beverageType: "beer",
      brandName: "Hop Haven Brewing Co.",
      classType: "India Pale Ale",
      alcoholContent: "6.8% Alc./Vol.",
      netContents: "12 FL. OZ.",
    },
  },
];

let failures = 0;
for (const c of CASES) {
  const image = readFileSync(new URL(`../public/samples/${c.id}.png`, import.meta.url));
  const form = new FormData();
  form.append("image", new Blob([image], { type: "image/png" }), `${c.id}.png`);
  form.append("application", JSON.stringify(c.app));
  const started = Date.now();
  let verdict = "ERROR";
  let detail = "";
  try {
    const res = await fetch(`${BASE}/api/verify`, { method: "POST", body: form });
    const body = await res.json();
    if (!res.ok) {
      detail = body.error ?? `HTTP ${res.status}`;
    } else {
      verdict = body.result.verdict;
      detail = body.result.summary;
    }
  } catch (err) {
    detail = String(err);
  }
  const ok = verdict === c.expect;
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${c.id.padEnd(26)} expected=${c.expect.padEnd(12)} got=${verdict.padEnd(12)} ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
  if (!ok) console.log(`      ${detail}`);
}
console.log(failures ? `\n${failures} case(s) failed` : "\nAll cases passed");
process.exit(failures ? 1 : 0);
