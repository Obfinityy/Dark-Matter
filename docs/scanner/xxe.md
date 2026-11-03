# XML External Entity (XXE)

## What it is
An XML parser resolves attacker-defined entities, enabling file reads and
SSRF from the server.

## How Dark Matter checks it
The scanner POSTs an XML document with a custom entity to the target:

```xml
<?xml version="1.0"?><!DOCTYPE r [<!ENTITY dmxxe "DMXXE123">]><r>&dmxxe;</r>
```

Probe: `backend/src/scanner/probes/xxe.js` (`probeXxe`).

## Payloads used
The entity-expansion document above (`Content-Type: application/xml`).

## What counts as proof (oracle)
The response contains the expanded value `DMXXE123`
(`signalCorrelated: true`) — the parser resolved our entity.

## Limits
Entity-expansion only in v1 (no external file read attempted). Blind/OOB
XXE via a collaborator listener is a documented next step.
