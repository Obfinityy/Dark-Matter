# lab-xxe — deliberately vulnerable XXE lab service

Lab-only target for the scanner's XXE OOB lanes (`backend/src/scanner/probes/xxe.js`
and `saml.js`). No authorised lab exposes a vulnerable XML endpoint: WebGoat's
XXE lessons and bWAPP's `xxe-1.php`/`xxe-2.php` are both auth-gated (and bWAPP's
DB is broken), and DVWA / Juice Shop / VAmPI have no XML endpoint at all
(survey 7 Nov 2026 — see `~/workspace/goals/dark-matter-autonomous-bug-bounty-agent/hidden_files/xxe-oob-lab-search-20261107.md`).

## Endpoints (port 8000 in-container, 3500 on 172.17.0.1)

- `GET /` — info page.
- `POST /` or `POST /xml` — parses the body as XML with a deliberately
  vulnerable lxml parser (`resolve_entities=True`, `load_dtd=True`,
  `no_network=False`) and returns the document text, expanded entities
  reflected. This is what `probeXxe` needs: internal expansion → `xxe`,
  external parameter entity fetched → `xxe_oob`.
- `POST /saml/acs`, `/sso/acs`, `/saml2/acs`, `/acs` — accepts a
  `SAMLResponse` form field (deflated+base64, or raw XML), parses the
  assertion with the same vulnerable parser, echoes the NameID. This is
  what `probeSaml` needs: internal expansion → `saml_xxe_entities`,
  external parameter entity fetched → `saml_xxe_oob`. The ACS is
  deliberately naive (no signature/audience validation) and echoes the
  NameID for any assertion, so it also trips the probe's
  `saml_not_processing` INFO finding — expected for this lab.

## Local validation (7 Nov 2026)

Run the service, then run the REAL probe code against it:

```bash
python3 app.py   # → http://127.0.0.1:8000/
node /tmp/xxe_lab_test.mjs   # probeXxe + probeSaml + real OOB collaborator
```

Verified findings: `xxe` (high), `xxe_oob` (high, `oobHit: true`),
`saml_xxe_entities` (info), `saml_xxe_oob` (high, `oobHit: true`).

## Gotcha — proxy environment variables

libxml2 honours `http_proxy`/`https_proxy` when fetching external entities.
If an egress proxy is set in the process environment, the OOB fetch is
routed to the proxy and never reaches the collaborator — the probe times
out with no hit and no finding, even though the parser is vulnerable
(reproduced 7 Nov 2026: zero hits with proxy vars set, hits arrive the
moment they are unset). `app.py` strips all proxy variables at startup
and sets `NO_PROXY` for the docker gateway; the compose service sets none.

## Safety

Lab-only by design: binds `172.17.0.1:3500` (docker bridge gateway) via
`docker/labs-compose.yml` — reachable from the backend, NOT exposed on the
EC2 public interface. No external network access, no secrets, no state.
Never point the scanner at this service outside an authorised lab hunt.
