/**
 * Generates the demo label images in public/samples/ from SVG templates.
 * Requires librsvg (`rsvg-convert`). Run: node scripts/generate-samples.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const WARNING_BODY =
  "(1) According to the Surgeon General, women should not drink alcoholic " +
  "beverages during pregnancy because of the risk of birth defects. " +
  "(2) Consumption of alcoholic beverages impairs your ability to drive a car " +
  "or operate machinery, and may cause health problems.";

const esc = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** Naive word-wrap for SVG tspans. */
function wrap(text, maxChars) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if ((line + " " + word).trim().length > maxChars) {
      lines.push(line.trim());
      line = word;
    } else {
      line += " " + word;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

/**
 * Render one label SVG.
 * @param opts.warning null = omit entirely; otherwise { header, bold }
 */
function labelSvg(opts) {
  const {
    bg = "#f4ead8",
    ink = "#2b2118",
    accent = "#8a2f1d",
    brand,
    brandSize = 64,
    classType,
    abv,
    net,
    bottler,
    warning,
    warningBody = WARNING_BODY,
  } = opts;

  const W = 800;
  const H = 1000;
  let warningBlock = "";
  if (warning) {
    const lines = wrap(warningBody, 62);
    const tspans = lines
      .map(
        (l, i) =>
          `<tspan x="${W / 2}" dy="${i === 0 ? 0 : 26}">${esc(l)}</tspan>`,
      )
      .join("");
    warningBlock = `
      <line x1="80" y1="760" x2="${W - 80}" y2="760" stroke="${ink}" stroke-width="2"/>
      <text x="${W / 2}" y="800" text-anchor="middle" font-family="DejaVu Sans" font-size="22"
        font-weight="${warning.bold ? "bold" : "normal"}" fill="${ink}">${esc(warning.header)}</text>
      <text x="${W / 2}" y="834" text-anchor="middle" font-family="DejaVu Sans" font-size="20" fill="${ink}">${tspans}</text>
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${bg}"/>
    <rect x="28" y="28" width="${W - 56}" height="${H - 56}" fill="none" stroke="${ink}" stroke-width="3"/>
    <rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="none" stroke="${ink}" stroke-width="1"/>
    <text x="${W / 2}" y="150" text-anchor="middle" font-family="DejaVu Serif" font-size="26"
      letter-spacing="6" fill="${accent}">EST. ★ 1897</text>
    <text x="${W / 2}" y="280" text-anchor="middle" font-family="DejaVu Serif" font-size="${brandSize}"
      font-weight="bold" fill="${ink}">${esc(brand)}</text>
    <line x1="150" y1="330" x2="${W - 150}" y2="330" stroke="${accent}" stroke-width="3"/>
    <text x="${W / 2}" y="420" text-anchor="middle" font-family="DejaVu Serif" font-size="34"
      font-style="italic" fill="${ink}">${esc(classType)}</text>
    <text x="${W / 2}" y="560" text-anchor="middle" font-family="DejaVu Sans" font-size="30" fill="${ink}">${esc(abv)}</text>
    <text x="${W / 2}" y="610" text-anchor="middle" font-family="DejaVu Sans" font-size="30" fill="${ink}">${esc(net)}</text>
    <text x="${W / 2}" y="720" text-anchor="middle" font-family="DejaVu Sans" font-size="20" fill="${ink}">${esc(bottler)}</text>
    ${warningBlock}
  </svg>`;
}

const CANONICAL_HEADER = "GOVERNMENT WARNING:";

const LABELS = {
  "old-tom-pass": labelSvg({
    brand: "OLD TOM DISTILLERY",
    classType: "Kentucky Straight Bourbon Whiskey",
    abv: "45% ALC./VOL. (90 PROOF)",
    net: "750 mL",
    bottler: "DISTILLED AND BOTTLED BY OLD TOM DISTILLERY, BARDSTOWN, KY",
    warning: { header: CANONICAL_HEADER, bold: true },
  }),
  "stones-throw": labelSvg({
    bg: "#1f2a24",
    ink: "#e8dfc8",
    accent: "#c9a227",
    brand: "STONE'S THROW",
    classType: "Straight Rye Whiskey",
    abv: "47.5% ALC./VOL.",
    net: "750 mL",
    bottler: "STONE'S THROW SPIRITS CO., HUDSON, NY",
    warning: { header: CANONICAL_HEADER, bold: true },
  }),
  "old-tom-wrong-abv": labelSvg({
    brand: "OLD TOM DISTILLERY",
    classType: "Kentucky Straight Bourbon Whiskey",
    abv: "40% ALC./VOL. (80 PROOF)",
    net: "750 mL",
    bottler: "DISTILLED AND BOTTLED BY OLD TOM DISTILLERY, BARDSTOWN, KY",
    warning: { header: CANONICAL_HEADER, bold: true },
  }),
  "title-case-warning": labelSvg({
    bg: "#f7f1e1",
    accent: "#5b3954",
    brand: "SUNSET RIDGE CELLARS",
    brandSize: 56,
    classType: "Cabernet Sauvignon",
    abv: "13.5% ALC. BY VOL.",
    net: "750 mL",
    bottler: "PRODUCED AND BOTTLED BY SUNSET RIDGE CELLARS, NAPA, CA",
    warning: { header: "Government Warning:", bold: true },
  }),
  "near-miss-brand": labelSvg({
    brand: "OLD TIM DISTILLERY",
    classType: "Kentucky Straight Bourbon Whiskey",
    abv: "45% ALC./VOL. (90 PROOF)",
    net: "750 mL",
    bottler: "DISTILLED AND BOTTLED BY OLD TOM DISTILLERY, BARDSTOWN, KY",
    warning: { header: CANONICAL_HEADER, bold: true },
  }),
  "reworded-warning": labelSvg({
    bg: "#efe7d4",
    accent: "#3a5a40",
    brand: "JUNIPER & PINE",
    brandSize: 58,
    classType: "Dry Gin",
    abv: "43% ALC./VOL.",
    net: "750 mL",
    bottler: "DISTILLED BY JUNIPER & PINE SPIRITS, BEND, OR",
    warning: { header: CANONICAL_HEADER, bold: true },
    warningBody: WARNING_BODY.replace("birth defects", "birth issues"),
  }),
  "wrong-net-contents": labelSvg({
    brand: "OLD TOM DISTILLERY",
    classType: "Kentucky Straight Bourbon Whiskey",
    abv: "45% ALC./VOL. (90 PROOF)",
    net: "700 mL",
    bottler: "DISTILLED AND BOTTLED BY OLD TOM DISTILLERY, BARDSTOWN, KY",
    warning: { header: CANONICAL_HEADER, bold: true },
  }),
  "proof-only-abv": labelSvg({
    bg: "#241d16",
    ink: "#e7d9bd",
    accent: "#b08948",
    brand: "COPPER CANYON",
    classType: "Straight Bourbon Whiskey",
    abv: "90 PROOF",
    net: "750 mL",
    bottler: "COPPER CANYON DISTILLING CO., DENVER, CO",
    warning: { header: CANONICAL_HEADER, bold: true },
  }),
  "hop-haven-missing-warning": labelSvg({
    bg: "#173042",
    ink: "#f2e6c9",
    accent: "#d98e32",
    brand: "HOP HAVEN",
    classType: "India Pale Ale",
    abv: "6.8% ALC./VOL.",
    net: "12 FL. OZ.",
    bottler: "BREWED AND CANNED BY HOP HAVEN BREWING CO., PORTLAND, OR",
    warning: null,
  }),
};

const outDir = new URL("../public/samples/", import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "labels-"));
try {
  for (const [name, svg] of Object.entries(LABELS)) {
    const svgPath = join(tmp, `${name}.svg`);
    writeFileSync(svgPath, svg);
    execFileSync("rsvg-convert", [svgPath, "-o", join(outDir, `${name}.png`)]);
    console.log(`generated ${name}.png`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
