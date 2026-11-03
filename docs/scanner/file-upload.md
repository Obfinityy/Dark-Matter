# Unrestricted File Upload

## What it is
Upload forms that accept arbitrary files — the classic webshell vector.
Even without code execution, unrestricted upload hosts phishing pages and
stored-XSS payloads on the victim's own domain.

## How the scanner checks it
1. **Find** `<input type="file">` forms on the target page (max 2).
2. **Benign upload:** a `.txt` file with a unique marker. The response must
   reference the filename/marker or report success.
3. **Dangerous variant:** the same content as `.phtml`. If the server
   accepts it (not rejected as invalid/denied) → **high**; if only the
   benign upload works → **medium**.

**Proof oracle:** server response confirms storage (`signalCorrelated`).
Uploaded content is a harmless text marker — never a real shell.

## Safety — lab gate
This probe WRITES files. It runs **only** when `opts.allowWrite` is true,
which `runScan` sets solely when the authorized host is listed in
`labTargets`. With `allowWrite` unset/false it returns `[]` without a
single request (tested).

## Limits
- Does not verify remote code execution — acceptance of the executable
  extension is the finding.
- Only the target page's upload forms (max 2), not every endpoint.
