"use client";

import type { CheckStatus, Verdict, VerifyResponse } from "@/lib/types";

const VERDICT_STYLE: Record<Verdict, { text: string; color: string; bg: string }> = {
  accepted: { text: "Approved", color: "text-approve", bg: "bg-approve-bg" },
  rejected: { text: "Rejected", color: "text-reject", bg: "bg-reject-bg" },
  needs_review: { text: "Needs Review", color: "text-review", bg: "bg-review-bg" },
};

const STATUS_ICON: Record<CheckStatus, { glyph: string; color: string; label: string }> = {
  match: { glyph: "✓", color: "text-approve", label: "Match" },
  mismatch: { glyph: "✗", color: "text-reject", label: "Mismatch" },
  needs_review: { glyph: "?", color: "text-review", label: "Needs review" },
  skipped: { glyph: "—", color: "text-ink-soft", label: "Skipped" },
};

/** Full verdict card: rubber-stamp verdict, summary, and per-field rows. */
export default function ResultCard({ response }: { response: VerifyResponse }) {
  const { result, elapsedMs } = response;
  const verdict = VERDICT_STYLE[result.verdict];

  return (
    <div className={`form-card overflow-hidden`}>
      <div className={`flex flex-wrap items-center gap-x-6 gap-y-3 px-6 py-5 ${verdict.bg}`}>
        <span className={`stamp ${verdict.color}`}>{verdict.text}</span>
        <div className="min-w-48 flex-1">
          <p className="font-medium">{result.summary}</p>
          <p className="mt-1 text-sm text-ink-soft">
            Checked in {(elapsedMs / 1000).toFixed(1)} seconds
          </p>
        </div>
      </div>

      {result.checks.length > 0 && (
        <ul className="divide-y divide-rule px-6">
          {result.checks.map((check) => {
            const icon = STATUS_ICON[check.status];
            return (
              <li key={check.field} className="flex gap-4 py-3.5">
                <span
                  aria-label={icon.label}
                  className={`mt-0.5 w-6 shrink-0 text-center text-xl font-bold ${icon.color}`}
                >
                  {icon.glyph}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <span className="font-semibold">{check.label}</span>
                    <span className={`text-sm font-medium ${icon.color}`}>{icon.label}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-ink-soft">{check.note}</p>
                  {check.status !== "skipped" && (
                    <dl className="mt-2 space-y-1 text-sm">
                      <div className="flex gap-2">
                        <dt className="w-24 shrink-0 text-ink-soft">Application:</dt>
                        <dd className="typed break-words">{check.expected ?? "—"}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="w-24 shrink-0 text-ink-soft">On label:</dt>
                        <dd className="typed break-words">{check.found ?? "not found"}</dd>
                      </div>
                    </dl>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
