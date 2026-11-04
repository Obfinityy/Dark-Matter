# EL Injection & OGNL Injection

## What it is
**EL injection (#197):** Expression Language `${...}` / `#{...}` (JSP EL,
JSF, Spring EL) evaluates user input server-side. Benign math like
`${7*7}` renders as `49` → the app executes expressions from input.

**OGNL injection (#425):** Struts2 evaluates OGNL in action parameters.
`%{7*7}` rendering as `49` proves the OGNL evaluator runs on input —
historically a direct path to Struts2 RCE (e.g. CVE-2017-5638 class).

## How the scanner checks it
Both probes use the same differential oracle as the SSTI probe, per
parameter (max 10):
1. **Control:** unique plain-text filler `dm_<rand>` (EL) or OGNL-shaped
   `%{dm_<rand>}` (OGNL) — proves the oracle token is not already on the
   page.
2. **Eval:** benign payloads — EL: `${7*7}`, `#{7*7}`,
   `${'dmElTest'.toString()}`; OGNL: `%{7*7}`, `${7*7}`.

**Proof oracle:** oracle result present (`49` / `dmElTest`) **and** the
literal payload absent **and** the oracle absent from the control →
`signalCorrelated` → **confirmed**. Literal reflection of `${7*7}` is
**never** a finding — evaluation only.

**Targeting (OGNL):** math tests run only when the URL looks like Struts2
(`.action` / `.do` suffix, `/struts/` path) or a baseline GET reveals
Struts markers (`X-Powered-By: Struts2`, `Welcome to Struts2`,
`struts.tags`, `org.apache.struts`). A marker hit also emits an info
finding `struts_fingerprint` (low) — it justifies why the target was
tested, not a vuln by itself.

## Payloads
- EL: `${7*7}`, `#{7*7}`, `${'dmElTest'.toString()}` (max 3/param; `quick`
  depth uses only `${7*7}`)
- OGNL: `%{7*7}`, `${7*7}` (max 2/param; `quick` depth uses only `%{7*7}`)

Severities: EL injection **high**, OGNL injection **critical**
(Struts2 OGNL is a known RCE primitive).

## Limits
- **No RCE confirmation, by design:** payloads like
  `%{#context['xwork.MethodAccessor.denyMethodExecution']=false}` or any
  static-method / command-execution shape are **never sent** — on a real
  Struts2 app they can lead to remote code execution. Detection stops at
  math evaluation; confirming execution impact is manual-lab-only.
- No blind/time-based EL oracles — output-reflection only.
- The `${'dmElTest'.toString()}` oracle needs the app to echo evaluated
  strings; math-only stacks are covered by the `49` oracles.
- Read-only GET, `redirect: manual`, unique canary per input.
