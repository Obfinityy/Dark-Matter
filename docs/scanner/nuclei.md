# Nuclei Template Battery

## What it is
[ProjectDiscovery Nuclei](https://github.com/projectdiscovery/nuclei) (MIT)
ships ~13,000 YAML templates: CVEs, misconfigurations, default credentials,
exposed panels — every template encodes the exact request/response workflow
that **confirms** a vulnerability (near-zero false positives by construction).

## How Dark Matter uses it
`backend/src/scanner/nuclei.js` (`runNuclei`) shells out to the existing
wrapper `docker/tools/nuclei/run-nuclei.sh`:

```bash
run-nuclei.sh <target-url> [severity]   # e.g. critical,high,medium
```

Output is JSONL, one finding per line (`template-id`, `info.severity`,
`matched-at`). Each finding is normalized into the scanner's finding shape
with structured evidence (`request`, `response`, `impact_demo`,
`signalCorrelated: true`) and passes through the same differential verifier
as the built-in probes.

## What counts as proof (oracle)
A verified-check template match at the reported URL. Templates are updated
from upstream on a weekly cadence (`-update-templates` is not run per scan —
too slow).

## Limits
Docker must be available where the scan runs. A full run takes 1–5 minutes;
focused subsets (by `-tags`/`-severity`) finish in seconds. Template quality
is upstream's; Dark Matter adds the verifier + reporting layer on top.
License: Nuclei is MIT — kept in `THIRD_PARTY_NOTICES.md` per repo rules.
