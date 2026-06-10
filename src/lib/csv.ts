import Papa from "papaparse";
import type { ApplicationData, BeverageType } from "./types";

/** Column format for application-data CSVs (single and batch import). */
export const CSV_TEMPLATE =
  "filename,beverage_type,brand_name,class_type,alcohol_content,net_contents,bottler_info,country_of_origin\n" +
  'old-tom.png,spirits,Old Tom Distillery,Kentucky Straight Bourbon Whiskey,45% Alc./Vol.,750 mL,"Bottled by Old Tom Distillery, Bardstown, KY",\n';

export interface CsvApplicationRow {
  filename: string;
  application: ApplicationData;
}

/** Map one parsed CSV row to ApplicationData. */
export function rowToApplication(row: Record<string, string>): ApplicationData {
  const type = (row.beverage_type ?? "").trim().toLowerCase();
  return {
    beverageType: (["spirits", "wine", "beer"].includes(type) ? type : "spirits") as BeverageType,
    brandName: (row.brand_name ?? "").trim(),
    classType: (row.class_type ?? "").trim(),
    alcoholContent: (row.alcohol_content ?? "").trim(),
    netContents: (row.net_contents ?? "").trim(),
    bottlerInfo: (row.bottler_info ?? "").trim() || undefined,
    countryOfOrigin: (row.country_of_origin ?? "").trim() || undefined,
  };
}

/**
 * Parse an application-data CSV file. Resolves with one entry per row that
 * has a brand name; rejects with a user-facing message when unusable.
 */
export function parseApplicationCsv(file: File): Promise<CsvApplicationRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        const rows = parsed.data
          .filter((row) => (row.brand_name ?? "").trim())
          .map((row) => ({
            filename: (row.filename ?? "").trim(),
            application: rowToApplication(row),
          }));
        if (!rows.length) {
          reject(
            new Error(
              "No usable rows found — the CSV needs at least a brand_name column. Download the template to see the expected format.",
            ),
          );
        } else {
          resolve(rows);
        }
      },
      error: () => reject(new Error("That CSV could not be read.")),
    });
  });
}
