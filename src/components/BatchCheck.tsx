"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import { SAMPLE_CASES, type SampleCase } from "@/data/samples";
import { REAL_CASES } from "@/data/realSamples";
import { runWithConcurrency, verifyOne } from "@/lib/clientVerify";
import type { ApplicationData, BeverageType, Verdict, VerifyResponse } from "@/lib/types";
import ResultCard from "./ResultCard";
import UploadDropzone from "./UploadDropzone";

interface BatchItem {
  file: File;
  application: ApplicationData | null;
  state: "waiting" | "running" | "done" | "error";
  response?: VerifyResponse;
  error?: string;
}

const CSV_TEMPLATE =
  "filename,beverage_type,brand_name,class_type,alcohol_content,net_contents,bottler_info,country_of_origin\n" +
  'old-tom.png,spirits,Old Tom Distillery,Kentucky Straight Bourbon Whiskey,45% Alc./Vol.,750 mL,"Bottled by Old Tom Distillery, Bardstown, KY",\n';

const VERDICT_CHIP: Record<Verdict, string> = {
  accepted: "bg-approve-bg text-approve",
  rejected: "bg-reject-bg text-reject",
  needs_review: "bg-review-bg text-review",
};

const VERDICT_NAME: Record<Verdict, string> = {
  accepted: "Approved",
  rejected: "Rejected",
  needs_review: "Needs Review",
};

function rowToApplication(row: Record<string, string>): ApplicationData {
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

/** Batch flow: many images + a CSV of application rows → three piles. */
export default function BatchCheck() {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [csvName, setCsvName] = useState<string | null>(null);
  const [apps, setApps] = useState<Map<string, ApplicationData>>(new Map());
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addFiles(files: File[]) {
    setItems((prev) => {
      const known = new Set(prev.map((i) => i.file.name));
      const fresh = files
        .filter((f) => !known.has(f.name))
        .map((file) => ({ file, application: apps.get(file.name) ?? null, state: "waiting" as const }));
      return [...prev, ...fresh];
    });
  }

  function loadCsv(file: File) {
    setCsvName(file.name);
    setError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        const map = new Map<string, ApplicationData>();
        for (const row of parsed.data) {
          const name = (row.filename ?? "").trim();
          if (name) map.set(name, rowToApplication(row));
        }
        if (!map.size) {
          setError("No rows with a filename column found in that CSV — download the template to see the expected format.");
          return;
        }
        setApps(map);
        setItems((prev) =>
          prev.map((item) => ({ ...item, application: map.get(item.file.name) ?? null })),
        );
      },
      error: () => setError("That CSV could not be read."),
    });
  }

  async function loadSampleBatch(cases: SampleCase[], label: string) {
    setError(null);
    const loaded = await Promise.all(
      cases.map(async (s) => {
        const blob = await (await fetch(s.imagePath)).blob();
        const ext = s.imagePath.endsWith(".jpg") ? "jpg" : "png";
        return {
          file: new File([blob], `${s.id}.${ext}`, {
            type: ext === "jpg" ? "image/jpeg" : "image/png",
          }),
          application: s.application,
          state: "waiting" as const,
        };
      }),
    );
    setItems(loaded);
    setCsvName(label);
    setProgress(0);
    setExpanded(null);
  }

  async function run() {
    const ready = items.filter((i) => i.application);
    if (!ready.length) return;
    setRunning(true);
    setProgress(0);
    setExpanded(null);
    setItems((prev) =>
      prev.map((i) => (i.application ? { ...i, state: "running", response: undefined, error: undefined } : i)),
    );
    const indexed = items.map((item, index) => ({ item, index })).filter(({ item }) => item.application);
    await runWithConcurrency(
      indexed.map(({ item, index }) => async () => {
        try {
          const response = await verifyOne(item.file, item.application!);
          setItems((prev) => prev.map((p, i) => (i === index ? { ...p, state: "done", response } : p)));
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed.";
          setItems((prev) => prev.map((p, i) => (i === index ? { ...p, state: "error", error: message } : p)));
        }
      }),
      4,
      setProgress,
    );
    setRunning(false);
  }

  function exportCsv() {
    const rows = items
      .filter((i) => i.response)
      .map((i) => ({
        filename: i.file.name,
        verdict: VERDICT_NAME[i.response!.result.verdict],
        summary: i.response!.result.summary,
      }));
    const url = URL.createObjectURL(new Blob([Papa.unparse(rows)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "label-check-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const counts = useMemo(() => {
    const c: Record<Verdict, number> = { accepted: 0, rejected: 0, needs_review: 0 };
    for (const i of items) if (i.response) c[i.response.result.verdict]++;
    return c;
  }, [items]);

  const matched = items.filter((i) => i.application).length;
  const done = items.filter((i) => i.state === "done" || i.state === "error").length;

  return (
    <div className="space-y-6">
      <div className="form-card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <p className="text-sm text-ink-soft">
          New here? Load a built-in batch — demo labels covering all three piles, or real
          approved labels from TTB&apos;s public COLA registry.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => loadSampleBatch(SAMPLE_CASES, "demo batch (built in)")}
            className="rounded-full border border-rule bg-paper px-4 py-1.5 text-sm font-medium hover:border-accent hover:text-accent transition-colors cursor-pointer"
          >
            Load demo batch
          </button>
          <button
            type="button"
            onClick={() => loadSampleBatch(REAL_CASES, "real TTB labels (built in)")}
            className="rounded-full border border-rule bg-paper px-4 py-1.5 text-sm font-medium hover:border-accent hover:text-accent transition-colors cursor-pointer"
          >
            Load real TTB labels
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="form-card p-6">
          <h2 className="font-display mb-4 text-xl font-semibold">1. Label images</h2>
          <UploadDropzone file={null} onFile={(f) => addFiles([f])} multiple onFiles={addFiles} />
          {items.length > 0 && (
            <p className="mt-3 text-sm text-ink-soft">{items.length} image{items.length > 1 ? "s" : ""} added</p>
          )}
        </div>

        <div className="form-card p-6">
          <h2 className="font-display mb-4 text-xl font-semibold">2. Application data (CSV)</h2>
          <p className="mb-3 text-sm text-ink-soft">
            One row per label, matched to images by filename.{" "}
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`}
              download="label-check-template.csv"
              className="font-medium text-accent underline"
            >
              Download the template
            </a>
          </p>
          <label className="block w-full cursor-pointer rounded-lg border-2 border-dashed border-rule bg-paper px-4 py-6 text-center font-medium hover:border-accent/60">
            {csvName ?? "Click to choose the CSV file"}
            <input
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => e.target.files?.[0] && loadCsv(e.target.files[0])}
            />
          </label>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-reject-bg px-4 py-3 font-medium text-reject">{error}</p>
      )}

      <button
        type="button"
        onClick={run}
        disabled={running || !matched}
        className="w-full rounded-lg bg-accent px-6 py-4 text-xl font-bold text-white shadow transition hover:brightness-110 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
      >
        {running
          ? `Checking… ${progress} of ${matched}`
          : matched
            ? `Check ${matched} Label${matched > 1 ? "s" : ""}`
            : "Add images and a CSV to begin"}
      </button>

      {running && (
        <div className="h-3 overflow-hidden rounded-full bg-rule" role="progressbar" aria-valuenow={progress} aria-valuemax={matched}>
          <div className="h-full bg-accent transition-all" style={{ width: `${(progress / Math.max(matched, 1)) * 100}%` }} />
        </div>
      )}

      {done > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {(Object.keys(VERDICT_NAME) as Verdict[]).map((v) => (
              <div key={v} className={`form-card px-4 py-3 text-center ${VERDICT_CHIP[v]}`}>
                <p className="text-3xl font-bold font-display">{counts[v]}</p>
                <p className="text-sm font-semibold">{VERDICT_NAME[v]}</p>
              </div>
            ))}
          </div>

          <div className="form-card divide-y divide-rule">
            {items.map((item, index) => (
              <div key={item.file.name}>
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === index ? null : index)}
                  className="flex w-full flex-wrap items-center gap-3 px-5 py-3 text-left hover:bg-paper cursor-pointer"
                >
                  <span className="typed min-w-40 flex-1 truncate">{item.file.name}</span>
                  {!item.application && <Chip className="bg-review-bg text-review">No CSV row</Chip>}
                  {item.state === "running" && <Chip className="bg-paper text-ink-soft">Checking…</Chip>}
                  {item.state === "error" && <Chip className="bg-reject-bg text-reject">Failed</Chip>}
                  {item.response && (
                    <Chip className={VERDICT_CHIP[item.response.result.verdict]}>
                      {VERDICT_NAME[item.response.result.verdict]}
                    </Chip>
                  )}
                </button>
                {expanded === index && item.response && (
                  <div className="px-5 pb-5">
                    <ResultCard response={item.response} />
                  </div>
                )}
                {expanded === index && item.error && (
                  <p className="px-5 pb-4 text-sm text-reject">{item.error}</p>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={exportCsv}
            className="rounded-md border border-rule bg-paper-raised px-5 py-2.5 font-medium hover:border-accent hover:text-accent transition-colors cursor-pointer"
          >
            Download results (CSV)
          </button>
        </>
      )}
    </div>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${className}`}>{children}</span>
  );
}
