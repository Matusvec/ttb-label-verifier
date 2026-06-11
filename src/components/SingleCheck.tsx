"use client";

import { useEffect, useRef, useState } from "react";
import { SAMPLE_CASES, type SampleCase } from "@/data/samples";
import { verifyOne } from "@/lib/clientVerify";
import { parseApplicationCsv, type CsvApplicationRow } from "@/lib/csv";
import type { ApplicationData, BeverageType, VerifyResponse } from "@/lib/types";
import ResultCard from "./ResultCard";
import UploadDropzone from "./UploadDropzone";

const EMPTY_FORM: ApplicationData = {
  beverageType: "spirits",
  brandName: "",
  classType: "",
  alcoholContent: "",
  netContents: "",
  bottlerInfo: "",
  countryOfOrigin: "",
};

const BEVERAGE_OPTIONS: { value: BeverageType; label: string }[] = [
  { value: "spirits", label: "Distilled Spirits" },
  { value: "wine", label: "Wine" },
  { value: "beer", label: "Beer / Malt" },
];

/** Single-label flow: application form (typed or CSV-imported) + image → verdict. */
export default function SingleCheck() {
  const [form, setForm] = useState<ApplicationData>(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<VerifyResponse | null>(null);
  const [csvRows, setCsvRows] = useState<CsvApplicationRow[]>([]);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (response) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [response]);

  const set = (key: keyof ApplicationData) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  async function importCsv(csvFile: File) {
    setError(null);
    setResponse(null);
    try {
      const rows = await parseApplicationCsv(csvFile);
      setCsvRows(rows);
      setForm({ ...EMPTY_FORM, ...rows[0].application });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That CSV could not be read.");
    }
  }

  async function loadSample(sample: SampleCase) {
    setError(null);
    setResponse(null);
    setForm({ ...EMPTY_FORM, ...sample.application });
    try {
      const res = await fetch(sample.imagePath);
      const blob = await res.blob();
      setFile(new File([blob], `${sample.id}.png`, { type: "image/png" }));
    } catch {
      setError("Could not load the example image.");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please add the label image first.");
      return;
    }
    setBusy(true);
    setError(null);
    setResponse(null);
    try {
      setResponse(await verifyOne(file, form));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2">
        <fieldset className="form-card space-y-5 p-6">
          <legend className="sr-only">Application data</legend>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold">1. Application details</h2>
            <button
              type="button"
              onClick={() => csvInputRef.current?.click()}
              className="rounded-md border border-rule bg-paper px-3 py-1.5 text-sm font-medium hover:border-accent hover:text-accent transition-colors cursor-pointer"
            >
              Import from CSV
            </button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                if (e.target.files?.[0]) importCsv(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </div>

          {csvRows.length > 1 && (
            <label className="block">
              <span className="field-label">Application from CSV ({csvRows.length} rows)</span>
              <select
                className="text-input mt-1 cursor-pointer"
                onChange={(e) => {
                  const row = csvRows[Number(e.target.value)];
                  if (row) {
                    setForm({ ...EMPTY_FORM, ...row.application });
                    setResponse(null);
                  }
                }}
              >
                {csvRows.map((row, i) => (
                  <option key={i} value={i}>
                    {row.application.brandName}
                    {row.filename ? ` (${row.filename})` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div>
            <p className="field-label mb-2">Beverage type</p>
            <div className="flex flex-wrap gap-2">
              {BEVERAGE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`cursor-pointer rounded-md border px-4 py-2 font-medium transition-colors ${
                    form.beverageType === opt.value
                      ? "border-accent bg-accent text-white"
                      : "border-rule bg-paper hover:border-accent/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="beverageType"
                    value={opt.value}
                    checked={form.beverageType === opt.value}
                    onChange={() => set("beverageType")(opt.value)}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <Field label="Brand name" required value={form.brandName} onChange={set("brandName")} placeholder="Old Tom Distillery" />
          <Field label="Class / type" required value={form.classType} onChange={set("classType")} placeholder="Kentucky Straight Bourbon Whiskey" />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Alcohol content" value={form.alcoholContent} onChange={set("alcoholContent")} placeholder="45% Alc./Vol." />
            <Field label="Net contents" value={form.netContents} onChange={set("netContents")} placeholder="750 mL" />
          </div>

          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-accent">
              More fields (optional)
            </summary>
            <div className="mt-4 space-y-5">
              <Field label="Bottler name & address" value={form.bottlerInfo ?? ""} onChange={set("bottlerInfo")} placeholder="Bottled by …, City, State" />
              <Field label="Country of origin" value={form.countryOfOrigin ?? ""} onChange={set("countryOfOrigin")} placeholder="Product of France" />
            </div>
          </details>
        </fieldset>

        <div className="space-y-4">
          <div className="form-card p-6">
            <h2 className="font-display mb-4 text-xl font-semibold">2. Label image</h2>
            <UploadDropzone file={file} onFile={setFile} />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-accent px-6 py-4 text-xl font-bold text-white shadow transition hover:brightness-110 disabled:opacity-60 cursor-pointer disabled:cursor-wait"
          >
            {busy ? "Reading the label…" : "Check Label"}
          </button>

          {error && (
            <p role="alert" className="rounded-md bg-reject-bg px-4 py-3 font-medium text-reject">
              {error}
            </p>
          )}
        </div>
      </form>

      {response && (
        <div ref={resultRef} className="scroll-mt-4">
          <ResultCard response={response} />
        </div>
      )}

      <details className="text-sm text-ink-soft">
        <summary className="cursor-pointer hover:text-ink">
          No label handy? Load a built-in example
        </summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {SAMPLE_CASES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => loadSample(s)}
              title={s.demonstrates}
              className="rounded-full border border-rule bg-paper px-4 py-1.5 text-sm font-medium hover:border-accent hover:text-accent transition-colors cursor-pointer"
            >
              {s.name}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

function Field({ label, value, onChange, placeholder, required }: FieldProps) {
  return (
    <label className="block">
      <span className="field-label">
        {label}
        {required && <span className="text-reject"> *</span>}
      </span>
      <input
        type="text"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-input mt-1"
      />
    </label>
  );
}
