import type { SampleCase } from "./samples";

/**
 * Real approved labels from TTB's Public COLA Registry
 * (ttbonline.gov/colasonline), each paired with its actual application
 * data. Multi-image label sets (front/back/neck) are composited into one
 * image per application. All were approved by TTB, so all should land in
 * the Approved pile.
 */
export const REAL_CASES: SampleCase[] = [
  {
    id: "25048001000235",
    name: "Buffalo Trace Bourbon",
    demonstrates: "TTB ID 25048001000235 — approved 02/18/2025.",
    imagePath: "/cola/25048001000235.jpg",
    application: {
      beverageType: "spirits",
      brandName: "Buffalo Trace",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "45% Alc/Vol (90 Proof)",
      netContents: "50 mL",
      bottlerInfo: "Distilled, aged & bottled by Buffalo Trace Distillery, Louisville, Kentucky",
    },
  },
  {
    id: "25227001000374",
    name: "Buffalo Trace Bourbon Cream",
    demonstrates: "TTB ID 25227001000374 — approved 08/19/2025.",
    imagePath: "/cola/25227001000374.jpg",
    application: {
      beverageType: "spirits",
      brandName: "Buffalo Trace",
      classType: "Liqueur",
      alcoholContent: "15% Alc by Vol (30 Proof)",
      netContents: "50 mL",
      bottlerInfo: "Produced by Buffalo Trace Distillery, Louisville, KY",
    },
  },
  {
    id: "24327001000557",
    name: "Sierra Nevada Landbier",
    demonstrates: "TTB ID 24327001000557 — approved 01/06/2025 (5-gallon keg).",
    imagePath: "/cola/24327001000557.jpg",
    application: {
      beverageType: "beer",
      brandName: "Sierra Nevada",
      classType: "Lager",
      alcoholContent: "4.8% Alc./Vol.",
      netContents: "5 gallons",
      bottlerInfo: "Sierra Nevada Brewing Co., Chico, CA",
    },
  },
  {
    id: "25013001000158",
    name: "Sierra Nevada Peachy",
    demonstrates: "TTB ID 25013001000158 — approved 01/15/2025 (5-gallon keg).",
    imagePath: "/cola/25013001000158.jpg",
    application: {
      beverageType: "beer",
      brandName: "Sierra Nevada",
      classType: "Ale with natural flavors",
      alcoholContent: "7% Alc./Vol.",
      netContents: "5 gallons",
      bottlerInfo: "Sierra Nevada Brewing Co., Chico, CA & Mills River, NC",
    },
  },
  {
    id: "25104001000793",
    name: "Kendall-Jackson Cabernet",
    demonstrates: "TTB ID 25104001000793 — approved 04/21/2025.",
    imagePath: "/cola/25104001000793.jpg",
    application: {
      beverageType: "wine",
      brandName: "Kendall-Jackson",
      classType: "Cabernet Sauvignon",
      alcoholContent: "13.5% by Vol.",
      netContents: "750 mL",
      bottlerInfo: "Vinted & bottled by Kendall-Jackson Vineyards & Winery, Geyserville, California",
    },
  },
  {
    id: "25104001000767",
    name: "Kendall-Jackson Merlot",
    demonstrates: "TTB ID 25104001000767 — approved 04/21/2025.",
    imagePath: "/cola/25104001000767.jpg",
    application: {
      beverageType: "wine",
      brandName: "Kendall-Jackson",
      classType: "Merlot",
      alcoholContent: "14.5% by Vol.",
      netContents: "750 mL",
      bottlerInfo: "Vinted & bottled by Kendall-Jackson Vineyards & Winery, Geyserville, California",
    },
  },
];
