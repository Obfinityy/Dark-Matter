# XML External Entity (XXE)

## What it is
An XML parser resolves attacker-defined entities, enabling file reads and
SSRF from the server.

## How Dark Matter checks it
The scanner POSTs XML documents to the target and watches for the oracle
below. Probe: `backend/src/scanner/probes/xxe.js` (`probeXxe`),
phase `'xxe'`.

Legs, in order:

- **(a) Internal entity expansion (v1).** A benign DOCTYPE defines
  `<!ENTITY dmxxe "DMXXE123">` and references it in the body.
  `Content-Type: application/xml`.
- **(b) Blind out-of-band (v2).** An external parameter entity points
  at a collaborator canary URL; a callback hit CONFIRMS blind XXE
  in-scan (`xxe_oob`, high). Lab-gated (`isLabTargetHost`); without a
  waiter the dispatch is recorded as info `xxe_oob_sent` only.
- **(c) Classic file disclosure (row #301).**
  `<!ENTITY dmxxefile SYSTEM "file:///etc/passwd">` — confirmed ONLY
  on the passwd root line in the response, absent from a benign
  control document, repeat-stable. Lab-gated like the OOB leg. Mere
  reflection of the entity declaration never confirms.
- **(d) SOAP-envelope file disclosure (row #304).** The same SYSTEM
  file entity inside a SOAP 1.1 envelope (`Content-Type: text/xml`,
  `SOAPAction: "urn:dmxxe#Probe"`) — confirmed ONLY on the passwd
  root line, absent from the benign control envelope, repeat-stable.
  Lab-gated like leg (c).
- **(e) OOXML file disclosure (row #304).** A crafted minimal `.docx`
  (hand-built stored ZIP: `[Content_Types].xml`, `_rels/.rels`,
  `word/document.xml`) whose `document.xml` carries the SYSTEM file
  entity, uploaded to the `<input type="file">` forms the target page
  exposes (same form discovery as `fileUpload.js`, max 2 forms).
  Confirmed ONLY on the passwd root line — in the upload response or
  in a fetch-back of the disclosed file URL — absent from the benign
  control `.docx` upload, repeat-stable. Gated twice: `allowWrite`
  (it WRITES a file to the target, the file-upload gate) AND
  `isLabTargetHost` re-checked before any upload.

## Payloads used
The documents above (`Content-Type: application/xml`, except the SOAP
leg which uses `text/xml` + `SOAPAction`, and the OOXML leg which
uploads a `.docx` as
`application/vnd.openxmlformats-officedocument.wordprocessingml.document`).

## What counts as proof (oracle)
- Leg (a): the response contains the expanded value `DMXXE123`
  (`signalCorrelated: true`).
- Leg (b): the collaborator receives a hit for the probe token
  (`oobHit: true`).
- Legs (c)–(e): the passwd root line (`root:…:0:0:…`) appears in the
  probe response, is absent from the benign control, and re-appears
  on a repeat (`signalCorrelated: true`). Only the matched root-line
  fragment is quoted in evidence — never a file dump.

## Limits
- The file legs key on `/etc/passwd`, so they cannot confirm
  inclusion on a non-Unix target; the OOB leg is the portable
  confirmation path there.
- No dedicated XXE lab exists today — legs (c)–(e) are verified
  against local mock servers only (a file-resolving stub, a
  reflecting stub, a strict stub, and OOXML upload stubs). A live
  target proof is a later lane.
- The OOXML leg only runs where the target page exposes a file-upload
  form; a document-processing API that takes a raw `.docx` body is
  not probed.
