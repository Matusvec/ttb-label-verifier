/**
 * Runs the real TTB COLA registry test set (public/cola/) through the
 * API. These are all APPROVED labels, so the expected pile is "accepted" —
 * anything else is printed with its failing checks for inspection.
 * Usage: node scripts/e2e-cola.mjs [baseUrl]
 */
import { readFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const DIR = new URL("../public/cola/", import.meta.url);

const csv = readFileSync(new URL("applications.csv", DIR), "utf8").trim().split("\n");
const header = csv[0].split(",");

function parseRow(line) {
  const cells = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) {
      cells.push(cur);
      cur = "";
    } else cur += ch;
  }
  cells.push(cur);
  return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""]));
}

let reviewOrWorse = 0;
for (const line of csv.slice(1)) {
  const row = parseRow(line);
  const image = readFileSync(new URL(row.filename, DIR));
  const form = new FormData();
  form.append("image", new Blob([image], { type: "image/jpeg" }), row.filename);
  form.append(
    "application",
    JSON.stringify({
      beverageType: row.beverage_type,
      brandName: row.brand_name,
      classType: row.class_type,
      alcoholContent: row.alcohol_content,
      netContents: row.net_contents,
      bottlerInfo: row.bottler_info,
      countryOfOrigin: row.country_of_origin,
    }),
  );
  const started = Date.now();
  const res = await fetch(`${BASE}/api/verify`, { method: "POST", body: form });
  const body = await res.json();
  if (!res.ok) {
    console.log(`ERROR ${row.filename}: ${body.error}`);
    reviewOrWorse++;
    continue;
  }
  const v = body.result.verdict;
  const ok = v === "accepted";
  if (!ok) reviewOrWorse++;
  console.log(
    `${ok ? "PASS" : "WARN"}  ${row.brand_name.padEnd(36)} ${v.padEnd(12)} ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
  if (!ok) {
    for (const c of body.result.checks.filter((c) => c.status !== "match" && c.status !== "skipped")) {
      console.log(`      ${c.label}: ${c.status} — ${c.note}`);
      console.log(`        app: ${c.expected} | label: ${c.found}`);
    }
  }
}
console.log(reviewOrWorse ? `\n${reviewOrWorse} label(s) did not auto-approve` : "\nAll real labels auto-approved");
