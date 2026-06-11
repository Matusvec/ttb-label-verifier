"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { SAMPLE_CASES, type SampleCase } from "@/data/samples";
import { REAL_CASES } from "@/data/realSamples";
import { runWithConcurrency, verifyOne } from "@/lib/clientVerify";
import { CSV_TEMPLATE, parseApplicationCsv } from "@/lib/csv";
import type { ApplicationData, Verdict, VerifyResponse } from "@/lib/types";
import ResultCard from "./ResultCard";
import UploadDropzone from "./UploadDropzone";

interface BatchItem {
  file: File;
  application: ApplicationData | null;
  state: "waiting" | "running" | "done" | "error";
  response?: VerifyResponse;
  error?: string;
}

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

/** Filenames are matched case-insensitively between images and CSV rows. */
const fileKey = (name: string) => name.trim().toLowerCase();

/** Batch flow: many images + a CSV of application rows → three piles. */
export default function BatchCheck() {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [csvName, setCsvName] = useState<string | null>(null);
  const [apps, setApps] = useState<Map<string, ApplicationData>>(new Map());
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped whenever the item list is replaced or reordered, so in-flight
  // results from a superseded run can never attach to the wrong row.
  const generation = useRef(0);

  function addFiles(files: File[]) {
    if (running) return;
    setItems((prev) => {
      const known = new Set(prev.map((i) => fileKey(i.file.name)));
      const fresh = files
        .filter((f) => !known.has(fileKey(f.name)))
        .map((file) => ({
          file,
          application: apps.get(fileKey(file.name)) ?? null,
          state: "waiting" as const,
        }));
      return [...prev, ...fresh];
    });
  }

  function removeItem(name: string) {
    if (running) return;
    generation.current++;
    setItems((prev) => prev.filter((i) => i.file.name !== name));
    if (expanded === name) setExpanded(null);
  }

  async function loadCsv(file: File) {
    if (running) return;
    setCsvName(file.name);
    setError(null);
    generation.current++;
    try {
      const rows = await parseApplicationCsv(file);
      const map = new Map<string, ApplicationData>();
      for (const row of rows) {
        if (row.filename) map.set(fileKey(row.filename), row.application);
      }
      if (!map.size) {
        setError("No rows with a filename column found in that CSV — download the template to see the expected format.");
        return;
      }
      setApps(map);
      setItems((prev) =>
        prev.map((item) => ({ ...item, application: map.get(fileKey(item.file.name)) ?? null })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "That CSV could not be read.");
    }
  }

  async function loadSampleBatch(cases: SampleCase[], label: string) {
    if (running) return;
    setError(null);
    generation.current++;
    try {
      const loaded = await Promise.all(
        cases.map(async (s) => {
          const res = await fetch(s.imagePath);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
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
    } catch {
      setError("Could not load the built-in examples — please try again.");
    }
  }

  async function run() {
    const ready = items.filter((i) => i.application);
    if (!ready.length || running) return;
    const gen = generation.current;
    setRunning(true);
    setProgress(0);
    setExpanded(null);
    setItems((prev) =>
      prev.map((i) => (i.application ? { ...i, state: "running", response: undefined, error: undefined } : i)),
    );
    const jobs = items
      .filter((item) => item.application)
      .map((item) => async () => {
        const name = item.file.name;
        try {
          const response = await verifyOne(item.file, item.application!);
          if (generation.current !== gen) return;
          setItems((prev) => prev.map((p) => (p.file.name === name ? { ...p, state: "done", response } : p)));
        } catch (err) {
          if (generation.current !== gen) return;
          const message = err instanceof Error ? err.message : "Failed.";
          setItems((prev) => prev.map((p) => (p.file.name === name ? { ...p, state: "error", error: message } : p)));
        }
      });
    await runWithConcurrency(jobs, 4, setProgress);
    setRunning(false);
  }

  function exportCsv() {
    const rows = items
      .filter((i) => i.response || i.error)
      .map((i) => ({
        filename: i.file.name,
        verdict: i.response ? VERDICT_NAME[i.response.result.verdict] : "Error",
        summary: i.response?.result.summary ?? i.error ?? "",
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
  const unmatched = items.length - matched;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="form-card p-6">
          <h2 className="font-display mb-4 text-xl font-semibold">1. Label images</h2>
          <UploadDropzone file={null} onFile={(f) => addFiles([f])} multiple onFiles={addFiles} disabled={running} />
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
          <label
            className={`block w-full rounded-lg border-2 border-dashed border-rule bg-paper px-4 py-6 text-center font-medium ${
              running ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:border-accent/60"
            }`}
          >
            {csvName ?? "Click to choose the CSV file"}
            <input
              type="file"
              accept=".csv,text/csv"
              hidden
              disabled={running}
              onChange={(e) => {
                if (e.target.files?.[0]) loadCsv(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-reject-bg px-4 py-3 font-medium text-reject">{error}</p>
      )}

      {apps.size > 0 && unmatched > 0 && (
        <p role="alert" className="rounded-md bg-review-bg px-4 py-3 font-medium text-review">
          {unmatched} of {items.length} image{items.length > 1 ? "s have" : " has"} no matching CSV
          row — the CSV&apos;s filename column must match the image filenames. Unmatched images are
          marked below and will be skipped.
        </p>
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
            : items.length && apps.size
              ? "No image filenames match the CSV"
              : "Add images and a CSV to begin"}
      </button>

      {running && (
        <div
          className="h-3 overflow-hidden rounded-full bg-rule"
          role="progressbar"
          aria-label="Batch progress"
          aria-valuenow={progress}
          aria-valuemax={matched}
        >
          <div className="h-full bg-accent transition-all" style={{ width: `${(progress / Math.max(matched, 1)) * 100}%` }} />
        </div>
      )}

      {done > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(VERDICT_NAME) as Verdict[]).map((v) => (
            <div key={v} className={`form-card px-4 py-3 text-center ${VERDICT_CHIP[v]}`}>
              <p className="text-3xl font-bold font-display">{counts[v]}</p>
              <p className="text-sm font-semibold">{VERDICT_NAME[v]}</p>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="form-card divide-y divide-rule">
          {items.map((item) => {
            const name = item.file.name;
            const isExpanded = expanded === name;
            return (
              <div key={name}>
                <div className="flex w-full flex-wrap items-center gap-3 px-5 py-3">
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : name)}
                    aria-expanded={isExpanded}
                    className="flex min-w-40 flex-1 flex-wrap items-center gap-3 text-left hover:text-accent cursor-pointer"
                  >
                    <span className="typed min-w-40 flex-1 truncate">{name}</span>
                    {!item.application && <Chip className="bg-review-bg text-review">No CSV row</Chip>}
                    {item.state === "running" && <Chip className="bg-paper text-ink-soft">Checking…</Chip>}
                    {item.state === "error" && <Chip className="bg-reject-bg text-reject">Failed</Chip>}
                    {item.response && (
                      <Chip className={VERDICT_CHIP[item.response.result.verdict]}>
                        {VERDICT_NAME[item.response.result.verdict]}
                      </Chip>
                    )}
                  </button>
                  {!running && (
                    <button
                      type="button"
                      onClick={() => removeItem(name)}
                      aria-label={`Remove ${name}`}
                      className="rounded px-2 py-0.5 text-ink-soft hover:bg-reject-bg hover:text-reject cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {isExpanded && item.response && (
                  <div className="px-5 pb-5">
                    <ResultCard response={item.response} />
                  </div>
                )}
                {isExpanded && item.error && (
                  <p className="px-5 pb-4 text-sm text-reject">{item.error}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {done > 0 && (
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-md border border-rule bg-paper-raised px-5 py-2.5 font-medium hover:border-accent hover:text-accent transition-colors cursor-pointer"
        >
          Download results (CSV)
        </button>
      )}

      <details className="text-sm text-ink-soft">
        <summary className="cursor-pointer hover:text-ink">
          No files handy? Load a built-in batch
        </summary>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={running}
            onClick={() => loadSampleBatch(SAMPLE_CASES, "demo batch (built in)")}
            className="rounded-full border border-rule bg-paper px-4 py-1.5 text-sm font-medium hover:border-accent hover:text-accent transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Demo labels (all three piles)
          </button>
          <button
            type="button"
            disabled={running}
            onClick={() => loadSampleBatch(REAL_CASES, "real TTB labels (built in)")}
            className="rounded-full border border-rule bg-paper px-4 py-1.5 text-sm font-medium hover:border-accent hover:text-accent transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Real approved TTB labels
          </button>
        </div>
      </details>
    </div>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${className}`}>{children}</span>
  );
}
