---
name: lfi
description: Local file inclusion — traverse to a real file read on the server
---
## Attack surface
Parameters that name a file or page: file=, page=, template=, view=, download and document endpoints, include-style routing, and upload/preview features that read back stored paths.
## Detection channels
Content (the file's actual contents in the response) and error (messages naming real server paths). Status codes and page length alone detect nothing.
## Testing methodology
1. Find ONE parameter that names a file or page and send its normal baseline value; save the response.
2. Set the parameter to ../../etc/passwd — root: lines in the response prove the server read the file.
3. If traversal sequences are filtered, vary the encoding, one at a time: ....//....//etc/passwd, ..%2f..%2fetc%2fpasswd, %2e%2e%2f%2e%2e%2fetc%2fpasswd.
4. If depth is the problem, add ../ segments (up to six) rather than changing anything else.
5. Only after /etc/passwd proves the read primitive, try ONE application file the read would expose (a config path the app itself referenced).
6. Stop at the single file read. Do not go reading credential stores or other users' files.
## Validation
Probed and proven means: actual file contents (root:x:0:0…) returned by a reproduced request — claim with the exact command and the full response. A 200 status, a long page, or an error message is not a file read.
## False positives
SPA or catch-all routes that serve the homepage for every path (compare the body with the homepage — identical bytes means fallback, not inclusion); custom 404 pages echoing your requested path; WAF block pages. If the body equals the homepage body, nothing was read.
