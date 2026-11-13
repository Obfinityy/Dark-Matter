# Log Poisoning to RCE (via LFI)

## What it is
Log poisoning (CWE-117) chained into remote code execution (CWE-94):
attacker-controlled data lands in a server log file (through a header
such as User-Agent or Referer, or a logged field such as username), and
a local file inclusion sink (CWE-98) later includes that log file. If
the application server executes the included file as code — the classic
case is a PHP application including an Apache access log — the poisoned
log entry runs with server privileges. The injection point is not the
request that carries the payload; it is the request that includes the
log back.

Coverage row #337 [Critical] — the scanner had no log-poison concept
at all before this leg (the only "log-poison" hit was a prose mention
in csvLogInjection.js:214; sensitiveDataInLogs.js only READS served log
files and never writes or includes one).

## How Dark Matter checks it
For every scan target with an LFI-looking parameter (same surface as
the traversal probe: `file`, `page`, `path`, `include`, `view`), the
scanner runs a two-step oracle per target:

1. Discovery: send a benign canary (`dmprobe-benign-<rand>`) in the
   User-Agent header, then include each candidate log path through
   each LFI parameter until the canary appears in the included output.
   The first (parameter, log path) pair that returns the canary proves
   the log is writable AND includable. If User-Agent discovery finds
   nothing, discovery retries once with Referer (some log formats
   record only one of the two fields).
2. Execution: inject PHP code (`<?php echo "dmprobe-<rand>-exec";?>`)
   through the same field and include the same log path. A finding
   counts ONLY when the executed marker appears and the raw PHP payload
   does not — execution consumed the PHP tags.

Probe: `backend/src/scanner/probes/logPoisoning.js`
(`probeLogPoisoning`). Phase `'log-poisoning'` (149th phase), wired
into the param battery next to `traversal` in
`backend/src/scanner/index.js`.

## Payloads used
- Benign canary: `dmprobe-benign-<rand>` in User-Agent (Referer as
  fallback) — proves writability + inclusion, never a finding on its
  own.
- Execution payload: `<?php echo "dmprobe-<rand>-exec";?>` in the
  same field — the echo output is the executed marker.
- Log paths (six standard locations): `/var/log/apache2/access.log`,
  `/var/log/apache2/error.log`, `/var/log/nginx/access.log`,
  `/var/log/nginx/error.log`, `/var/log/httpd/access_log`,
  `/var/log/httpd/error_log`.

## What counts as proof (oracle)
The executed marker (`dmprobe-<rand>-exec`) appears in the included
log output **and** the raw PHP payload does **not**
(`signalCorrelated: true`, `diverged: true`, `executed: true`). The
marker string sits inside the payload text itself, so marker presence
alone would match on reflection — the raw-payload absence is what
separates execution from reflection. An HTML-escaped reflection still
contains `&lt;?php`, so it is excluded by the same check. Bare log
reflection is never confirmation; execution is.

The `signalCorrelated` flag matters for confirmation: `protocolFor`
routes class `log_poisoning` to the default protocol, judged on
`signalCorrelated` (`differential.js`). The capability maps
(`differential.js` + `chainEngine.js`) carry `log_poisoning` as
`['file_read', 'code_exec']`, so a confirmed finding scores
LIKELY_EXPLOITABLE and feeds the file_read → code_exec
'log poisoning / LFI-to-RCE' chain transition.

## Safety
Lab-gated like rfi/xslt. Writing attacker content into server logs is
a write, so the phase runs only when the target host is listed in
`labTargets`; on a non-lab host the probe returns [] without a single
request. On a bare page the phase skips with 'no param targets' (the
param-battery fallback).

## Limits
- PHP execution leg only in v1. The same two-step shape covers other
  runtimes (a JSP/ASP log executed by its own include, or a cron-executed
  log), but each needs its own execution marker — not covered here.
- One confirmed finding per scan: the first working (parameter, log
  path) pair wins, so later pairs are never attempted after a confirm.
- The log must be includable through a URL parameter on a scanned
  target. An LFI sink reachable only through a POST body, a header,
  or an out-of-band include path is not covered.
- The poisoned entry must execute on include. A log that is included
  as plain text (reflected but never executed) is correctly reported
  as no finding — that is a log-injection / information-disclosure
  shape, not RCE.
