# One-Page-Deep Model

## The model (owner order, 3 Nov 2026)

The user pastes **one page link**. The scanner goes **deep on that page** —
it does not spray the whole site. Then the user pastes the next page and it
repeats. Minutes per page is fine; the scan keeps working automatically
until the page is exhausted.

Pipeline per page:

1. **Fingerprint** — what the page/site is built with (server, tech, DB hint).
   This tells the scanner *where* bugs can live.
2. **Page analysis** (`page-analyze` phase) — inventory **every element** on
   the page: input boxes (with their type), buttons, forms, textareas,
   selects, URL parameters. Standalone inputs (outside any `<form>`) are
   flagged — they are invisible to the form battery otherwise.
3. **Element × vulnerability matrix** — each element kind maps to its
   applicable vulnerability classes (`ELEMENT_VULN_MATRIX` in
   `backend/src/scanner/pageAnalyze.js`). Fully predefined, no AI. Example:
   a text input maps to SQLi (error + blind), reflected XSS, command
   injection, SSTI. A password field maps to SQLi + XSS. A URL parameter maps
   to the full injection set plus open redirect and SSRF.
4. **Probe battery** — every applicable class is tried per element with
   differential oracles (control vs injected response). The param battery
   runs as a superset: the matrix is the guaranteed minimum per element.
5. **Verification** — `verifyFindings` confirms only what the differential
   judges prove; unconfirmed stays a lead, never "Confirmed".
6. **Report** — confirmed findings surface in the product UI (report, panel,
   chat) with evidence.

## Safety

Same rule as the form battery: every synthesized target fills inputs with
**unique** values (`dmprobe_<rand>`, never empty, never equal). A
state-changing form (e.g. a password-change form) only fires when its inputs
"match" — unique fillers keep every probe read-only.

## Documented gaps (not oversights)

- **Brute force / credential stuffing**: out of scope — needs a browser and
  rate-limit-safe multi-step flow.
- **File upload** (`input:file`): inventoried by the analyzer, but the upload
  battery is a future slot — the matrix keeps the empty entry so it cannot
  be forgotten.
- **Stored XSS / DOM XSS**: need multi-step or DOM execution; outside the
  HTTP-level battery.

## Code

- `backend/src/scanner/pageAnalyze.js` — `analyzePage()`, `matrixFor()`,
  `planForPage()`, `ELEMENT_VULN_MATRIX`.
- `backend/src/scanner/index.js` — `page-analyze` phase in `DEFAULT_PHASES`;
  standalone inputs become synthesized GET targets; `pageAnalysis` summary
  in the scan result.
- `backend/src/scanner/pageAnalyze.test.js` — 6 tests.
