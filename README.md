# Label Check — AI-Powered Alcohol Label Verification

A prototype for TTB compliance agents: upload a label image and the matching
COLA application data, and the app verifies that the label says what the
application claims — sorting every submission into one of three piles:
**Approved**, **Rejected**, or **Needs Review** by a human agent.

> **Live demo:** _deployment URL goes here_
>
> No setup needed to try it — expand **"No label handy? Load a built-in
> example"** (single mode) or **"No files handy? Load a built-in batch"**
> (batch mode) to run bundled demo labels that exercise all three piles,
> or real TTB-approved labels.

## Running locally

```bash
pnpm install
cp .env.example .env.local    # add your Gemini API key
pnpm dev                      # http://localhost:3000
pnpm test                     # 97 unit tests (no API key needed)

# live end-to-end suites (dev server must be running; each call costs ~$0.002)
node scripts/e2e-samples.mjs  # 9 synthetic defect cases → expected piles
node scripts/e2e-cola.mjs     # 6 real approved labels → all must approve
node scripts/e2e-scale.mjs    # Sarah's scenario: 200-label batch, throughput report
```

Optional: `node scripts/generate-samples.mjs` regenerates the demo label
images (requires librsvg).

## How it works

```
label image ──► extraction (one vision-LLM call)  ──► verbatim field JSON
application ──► verification (pure TypeScript)    ──► per-field checks
                                                  ──► verdict: one of three piles
```

1. **Extraction** (`src/lib/extraction.ts`) — a single Gemini Flash call
   transcribes each label field *verbatim* (case and punctuation preserved)
   into structured JSON, with a per-field legibility rating. This is the only
   file that talks to an LLM.
2. **Verification** (`src/lib/verify.ts`, `normalize.ts`, `warning.ts`) —
   deterministic TypeScript compares the transcription against the
   application. No AI judgment here: every rule is readable, unit-tested
   code.
3. **Rollup** — any hard mismatch → **Rejected**; anything uncertain
   (near-miss text, unreadable field, poor image) → **Needs Review**;
   otherwise **Approved**.

## Design decisions, mapped to the discovery interviews

| Decision | Why (interview source) |
| --- | --- |
| One fast vision-model call per label, thinking disabled — **measured p50 2.6 s, p95 3.1 s** under batch load | Sarah: the previous pilot took 30–40 s per label and agents abandoned it — "if we can't get results back in about 5 seconds, nobody's going to use it." |
| Government warning checked **character-exact** (after un-wrapping lines), with an independent all-caps/bold observation cross-checked against the transcription | Jenny: the warning must be exact, word-for-word, with "GOVERNMENT WARNING" capitalized — title case gets rejected. The cross-check defends against the vision model silently "autocorrecting" a non-compliant warning to the canonical text it knows. |
| Every other field uses **lenient, deterministic matching** (normalization + edit distance), and near-misses go to review instead of rejection | Dave: "STONE'S THROW" vs "Stone's Throw" is obviously the same brand — "you can't just pattern match everything. You need judgment." |
| **Three piles** instead of pass/fail | Dave's nuance point + Jenny's bad-image point: when the tool isn't sure, it should hand the case to a human (or request a better photo), not guess. |
| **Batch mode**: many images + a CSV, checked 4 at a time with live progress and a results export — **load-tested at 200 labels: 2.3 minutes wall-clock, 200/200 correct verdicts, 0 errors** (`scripts/e2e-scale.mjs`) | Sarah: importers dump 200–300 applications at once and agents process them one at a time; "if there was some way to handle batch uploads, that would be huge." |
| One screen, two big tabs, one big button, large type, high contrast, results as a rubber stamp. Keyboard-navigable ARIA tabs; tab switches never lose work in progress; **axe-core reports zero WCAG 2.0/2.1 A+AA violations** (Section 508 baseline) | Sarah: "we need something my mother could figure out… clean, obvious, no hunting for buttons." Half the team is over 50. |
| Extraction isolated behind a single function | Marcus: the TTB network blocks outbound traffic to many ML endpoints. A production build could swap in a self-hosted open-source vision model inside their network by reimplementing one file. |
| Nothing is stored; no accounts | Marcus: "we're not storing anything sensitive for this exercise" — the prototype keeps no state at all. |

## Tools used

- **Next.js 16 / React / TypeScript / Tailwind 4** — one repo, API routes and
  UI together, deployed on Vercel.
- **Gemini 3.5 Flash** (`@google/genai`) — vision extraction with a strict
  JSON response schema and thinking disabled for latency.
- **Vitest** — 97 unit tests across six suites: the verification rules
  (incl. a 22-case government-warning matrix), text normalization and
  volume/ABV parsers, the API route (validation, error mapping, rate
  limiting, with the model mocked), the rate limiter, and runtime
  validation of model output at the trust boundary.
- **librsvg** — generates the bundled demo labels from SVG templates, so the
  test cases (wrong ABV, title-case warning, near-miss brand, missing
  warning) are precisely controlled.

## Test data: synthetic defects + real approved labels

Two bundled test sets, both runnable from the UI or via scripts:

- **Demo set** (`public/samples/`, generated SVG labels) — six cases with
  *controlled* defects: wrong ABV, title-case government warning, near-miss
  brand name, missing warning. Covers all three piles deterministically.
  Run: `node scripts/e2e-samples.mjs`.
- **Real set** (`public/cola/`) — six labels **approved by TTB**, pulled from
  the [Public COLA Registry](https://ttbonline.gov/colasonline/publicSearchColasBasic.do)
  (Buffalo Trace, Sierra Nevada, Kendall-Jackson — spirits, beer, and wine),
  paired with their actual application data and identified by TTB ID. Since
  TTB approved them, the app should too — a calibration check against real
  agent decisions. Run: `node scripts/e2e-cola.mjs`. Real applications
  submit multi-image label sets (front/back/neck), composited here into one
  image per application; handling multi-image sets natively is noted as
  future work.

The real set caught three bugs the synthetic set couldn't: approved labels
print the warning *body* in all caps (only the header's case is mandated by
27 CFR 16.21), hyphenate words across line breaks ("PREG-NANCY"), and embed
required text inside longer phrases (class/type within marketing copy,
bottler lines with phone numbers appended). Each fix is now a unit test.

A second, **blind** evaluation followed: eight more approved labels
(Glenfiddich, Guinness, Yellow Tail, Dogfish Head, Barefoot, Stella Artois,
La Crema) were harvested without inspecting the artwork, paired only with
the registry's own application fields, and run cold. That surfaced three
calibration issues — an approved label printing "GOVERNMENT WARNING :" with
a space before the colon, TTB class-code vocabulary ("TABLE RED WINE") never
matching label designations ("PINOT NOIR"), and partial brand overlaps
("GUINNESS OPEN GATE BREWERY" vs brand+fanciful "GUINNESS MIDNIGHT HARMONY")
being hard-rejected. All three now resolve the way an agent would: the
spacing is tolerated, and vocabulary/overlap differences route to
**Needs Review** instead of rejection. After calibration the blind set
produces zero false rejections; every remaining flag is a legitimate
"have a human look" given the registry's application vocabulary.

## Assumptions

- **Beverage-type rules are simplified**: ABV is treated as mandatory for
  distilled spirits and optional (verified when provided) for beer and wine.
  Real TTB rules (27 CFR Part 5 for spirits, Part 4 for wine, Part 7 for
  malt beverages) are finer-grained — e.g. wine above/below 14% ABV; the
  field-rule functions in `verify.ts` are where they would slot in. The
  health-warning rules implemented are 27 CFR Part 16 §16.21 (mandatory
  verbatim statement) and §16.22(a) (capitalized, bold "GOVERNMENT
  WARNING"); §16.22's type-size-per-container rules are out of scope, as is
  TTB's own qualification stamped on approvals ("TTB has not reviewed this
  label for type size…").
- The application data arrives as typed fields (or CSV columns for batch) —
  parsing actual COLA form PDFs is out of scope.
- The mandatory warning text is the 27 CFR Part 16 statement; "bold header"
  compliance is approximated by the vision model's visual judgment, so an
  un-bold header lands in Needs Review rather than auto-rejection.
- Sample labels are flat artwork, but imperfect photos were tested by
  synthetically degrading a known label: with moderate tilt, perspective,
  noise, and blur the fields still extract and verify; under heavy blur the
  system routes to **Needs Review** with "request a clearer image" rather
  than guessing — per Jenny, agents currently reject and request a better
  image, and this prototype keeps a human in that loop. Large photos are
  downscaled in the browser before upload (phone photos run 5–12 MB;
  Vercel's payload cap is 4.5 MB).

## Trade-offs & known limitations

- **Bold detection is best-effort.** Font weight can't be verified from a
  transcription, so the model reports it visually and uncertainty degrades to
  human review, never silent approval.
- **Rate limiting is per-serverless-instance** (in-memory). Real abuse
  protection would use a shared store; the Gemini account also carries a hard
  spend cap as defense in depth.
- **Batch concurrency is fixed at 4** to stay inside API rate limits; 300
  labels complete in roughly 4–5 minutes with per-label results streaming in,
  rather than blocking on the slowest.
- **The model can still misread.** Extraction temperature is 0, the schema
  is strict, and output is runtime-validated — but a vision model is not an
  oracle, which is exactly why the product's output is a *recommendation
  with evidence*: every non-skipped field shows the application value next
  to what was read off the label, including matches, so the agent can always
  eyeball the transcript.
- **Adversarial label art shares the extraction trust boundary.** A
  malicious applicant could print instructions to the transcription system
  on the label itself. The prompt instructs the model to treat all label
  text as content, and the deterministic verifier never lets the model
  decide a verdict — but the warning-header cross-check and the
  transcription come from the same model call, so they defend against
  accidental autocorrect, not a determined adversary. Production would add
  a second independent extraction pass (different model) for
  tamper-sensitive fields; for this prototype the always-visible per-field
  evidence keeps the human able to catch a forged match.

## Production considerations (out of scope, acknowledged)

PII/retention policies, FedRAMP-authorized hosting, COLA integration, and the
agency firewall (Marcus's interview) would all shape a real deployment — most
notably by swapping the cloud vision model for one hosted inside the TTB
boundary (or a FedRAMP-authorized AI service on the agency's Azure tenancy),
which the single-function extraction layer is designed to allow. The
prototype stores nothing: uploads are processed in memory and discarded,
which is also the simplest possible retention policy.

## How this was built

This prototype was built AI-assisted (Claude Code) in keeping with the
role's focus on applied AI engineering — with the discipline that makes
that workable: every AI-authored matching rule is pinned by deterministic
unit tests (97), validated against three tiers of test data (synthetic
defects → real approved labels → a blind set of unseen approved labels),
and load-tested against the spec's stated peak scenario. The AI never
grades its own homework: verdicts come from plain TypeScript, and the live
e2e suites check the system against ground truth established independently
of the model.
