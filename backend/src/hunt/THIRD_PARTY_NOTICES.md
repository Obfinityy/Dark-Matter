# Third-Party Notices — Hunt subsystem (`backend/src/hunt/`)

This file documents the external projects that informed the design of the
Infinity AI hunt planner and scanner pipeline. **No third-party code was
copied into this repository** — the modules here are original
implementations. User-visible product surfaces say "Infinity AI" only;
original project names never appear in the UI.

## 1. PentestGPT (GreyDGL) — MIT License — architecture inspiration

The triple-brain task-tree design in `planner.js` (three cooperating LLM
sessions — reasoner / generator / parser — maintaining a structured
Pentesting Task Tree, multi-stage pipeline recon → vuln → report, and
session persistence/resume) is conceptually inspired by PentestGPT.

- Project: https://github.com/GreyDGL/PentestGPT
- License: MIT
- What was taken: the *architecture pattern* (task tree + cooperating
  sessions + persisted session state). All prompts, state shapes, and code
  in `planner.js` are original and were written for this codebase.
- What was NOT taken: no source files, no prompts, no model backends.

The MIT license text is reproduced below as required for attribution of the
inspiration (the project itself is not vendored):

```
MIT License

Copyright (c) 2023 GreyDGL

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 2. AutoAttacker (Microsoft Research, arXiv 2403.01038) — architecture only

The context-protection "Summarizer" pattern in `planner.js` (compressing
verbose tool output between reasoning turns to protect the context window)
is conceptually inspired by the AutoAttacker paper's Planner/Summarizer
split. The paper's reference implementation is not open-source; nothing was
copied. The summarizer here is an original implementation with a
deterministic extractive fallback.

## 3. PenHeal (academic project) — concept only

The "recommended fixes ranked by effort/impact" section in `liveReport.js`
is conceptually inspired by PenHeal's remediation-ranking idea. The ranking
formula and remediation catalog here are original.

## 4. ProjectDiscovery toolchain — UNMODIFIED EXTERNAL BINARIES (AGPL-3.0)

`toolRunner.js` shells out to the following ProjectDiscovery tools as
**separate OS-level subprocesses** via `node:child_process` spawn:

- subfinder, dnsx, httpx, katana, nuclei, naabu

These projects are licensed AGPL-3.0 (nuclei-templates is MIT). They are:

- **NOT vendored** — no binaries, source files, or templates ship in this
  repository.
- **NOT linked or imported** — the backend never `require()`s/`import()`s
  them; communication is stdin/stdout/stderr only.
- **NOT modified** — they run exactly as the operator installed them.

Because the tools run as independent programs with no shared address space
and no modified sources, the AGPL copyleft obligations do not extend to the
Infinity AI backend. Operators install these binaries themselves
(e.g. `go install` from their official releases); when a binary is absent,
the pipeline logs the fact and continues with the built-in engine-based
recon feed.

Note: `nuclei -ai` is deliberately not used (it requires ProjectDiscovery
Cloud, which conflicts with the product's no-cloud-dependency stance).

## Rebranding policy

Per product direction, all user-visible strings in the hunt subsystem say
"Infinity AI". The project names above appear only in this engineering
notice file, never in the product UI.
